"""Report lifecycle business logic (issue #176).

Owns the report state machine:

    draft -> generating -> generated -> under_review -> final -> archived
    (any state may transition to `failed`)

plus source/evidence linking, provenance derivation, integrity hashing and
AI-reference validation. Routers stay thin: validation, authn/z, formatting.
"""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Iterable
from uuid import UUID, uuid4

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth.rbac import ROLE_ADMIN
from app.auth.scope import enforce_district_scope
from app.core.exceptions import ConflictException, ForbiddenException, NotFoundException
from app.models.crime import CrimeCase
from app.models.criminal import Criminal
from app.models.evidence import Evidence
from app.models.fir import FIR
from app.models.intervention import Intervention
from app.models.location import Location
from app.models.officer import Officer
from app.models.audit_log import AuditLog
from app.models.report import (
    GEN_METHOD_AI_ASSISTED,
    GEN_METHOD_DATABASE_EXPORT,
    LEGACY_REPORT_STATUSES,
    PROVENANCE_LIVE,
    PROVENANCE_MIGRATED,
    PROVENANCE_MIXED,
    PROVENANCE_UNKNOWN,
    REPORT_GEN_METHODS,
    REPORT_PROVENANCES,
    REPORT_SOURCE_TYPES,
    REPORT_STATUS_ARCHIVED,
    REPORT_STATUS_DRAFT,
    REPORT_STATUS_FAILED,
    REPORT_STATUS_FINAL,
    REPORT_STATUS_GENERATED,
    REPORT_STATUS_GENERATING,
    REPORT_STATUS_UNDER_REVIEW,
    SOURCE_TYPE_ANALYTICAL,
    SOURCE_TYPE_CASE,
    SOURCE_TYPE_CRIMINAL,
    SOURCE_TYPE_EVIDENCE,
    SOURCE_TYPE_FIR,
    SOURCE_TYPE_NETWORK,
    SOURCE_TYPE_OFFICER,
    SOURCE_TYPE_VICTIM,
    Report,
    ReportEvidenceLink,
    ReportSourceLink,
    ReportVersion,
)
from app.models.user import User
from app.models.victim import Victim
from app.services import audit_service

# Supported lifetime statuses (schema-level constants).
LIFECYCLE_STATUSES = {
    REPORT_STATUS_DRAFT,
    REPORT_STATUS_GENERATING,
    REPORT_STATUS_GENERATED,
    REPORT_STATUS_UNDER_REVIEW,
    REPORT_STATUS_FINAL,
    REPORT_STATUS_ARCHIVED,
    REPORT_STATUS_FAILED,
}

# Report types actually supported by SAKSHA (§3).
REPORT_TYPE_CASES = "cases"
REPORT_TYPE_OFFICERS = "officers"
REPORT_TYPE_CRIMINALS = "criminals"
REPORT_TYPE_EVIDENCE = "evidence"
REPORT_TYPE_DOSSIER = "dossier"
REPORT_TYPE_INVESTIGATION = "investigation"
REPORT_TYPE_HOTSPOTS = "hotspots"
REPORT_TYPE_INTERVENTIONS = "interventions"
REPORT_TYPE_NETWORK = "network"
REPORT_TYPE_VICTIMOLOGY = "victimology"
REPORT_TYPE_STRATEGIC = "strategic"
REPORT_TYPES = {
    REPORT_TYPE_CASES,
    REPORT_TYPE_OFFICERS,
    REPORT_TYPE_CRIMINALS,
    REPORT_TYPE_EVIDENCE,
    REPORT_TYPE_DOSSIER,
    REPORT_TYPE_INVESTIGATION,
    REPORT_TYPE_HOTSPOTS,
    REPORT_TYPE_INTERVENTIONS,
    REPORT_TYPE_NETWORK,
    REPORT_TYPE_VICTIMOLOGY,
    REPORT_TYPE_STRATEGIC,
}


def utcnow() -> datetime:
    """Server-side timestamp helper — never trust client clocks (§18)."""
    return datetime.now(timezone.utc)


# --------------------------------------------------------------------------- #
# Integrity
# --------------------------------------------------------------------------- #
def compute_integrity_hash(content: dict | None, metadata: dict | None = None) -> str:
    """Deterministic sha-256 over the canonical snapshot + metadata (§12).

    Integrity only — it is not encryption and adds no confidentiality.
    """
    payload = {"content": _canonicalize(content), "metadata": metadata or {}}
    canonical = json.dumps(payload, sort_keys=True, default=_json_default, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _json_default(value: Any) -> str:
    if isinstance(value, (datetime,)):
        return value.astimezone(timezone.utc).isoformat()
    if isinstance(value, UUID):
        return str(value)
    return str(value)


def _canonicalize(content: dict | None) -> dict:
    raw = content or {}
    return {"headers": list(raw.get("headers") or []), "rows": list(raw.get("rows") or [])}


def normalize_snapshot(content: dict | None) -> dict:
    return _canonicalize(content)


def snapshot_json(content: dict | None) -> str | None:
    snap = _canonicalize(content)
    if not snap["headers"] and not snap["rows"]:
        return None
    return json.dumps(snap, default=_json_default)


def _load_snapshot(report: Report) -> dict:
    if not report.content_snapshot:
        return {"headers": [], "rows": []}
    try:
        raw = json.loads(report.content_snapshot)
    except (TypeError, ValueError):
        return {"headers": [], "rows": []}
    return {"headers": list(raw.get("headers") or []), "rows": list(raw.get("rows") or [])}


# --------------------------------------------------------------------------- #
# Provenance
# --------------------------------------------------------------------------- #
def determine_provenance(values: Iterable[str]) -> str:
    """Derive report provenance from actual source-record provenance (§7).

    demo/migrated/live are distinguished; any mix becomes MIXED; nothing known
    becomes UNKNOWN. Never classified as LIVE unless the sources are.
    """
    distinct = {v for v in values if v}
    distinct -= {PROVENANCE_UNKNOWN}
    if not distinct:
        return PROVENANCE_UNKNOWN
    if len(distinct) > 1:
        return PROVENANCE_MIXED
    return next(iter(distinct))


# --------------------------------------------------------------------------- #
# Source resolution / validation
# --------------------------------------------------------------------------- #
_SOURCE_MODELS = {
    SOURCE_TYPE_CASE: (CrimeCase, "case_number", PROVENANCE_LIVE),
    SOURCE_TYPE_CRIMINAL: (Criminal, "full_name", PROVENANCE_LIVE),
    SOURCE_TYPE_VICTIM: (Victim, "full_name", PROVENANCE_LIVE),
    SOURCE_TYPE_OFFICER: (Officer, "name", PROVENANCE_LIVE),
    SOURCE_TYPE_FIR: (FIR, "fir_number", PROVENANCE_LIVE),
    SOURCE_TYPE_EVIDENCE: (Evidence, "title", PROVENANCE_LIVE),
}


def _norm_id(value: str) -> str:
    try:
        return str(UUID(value))
    except (ValueError, TypeError, AttributeError):
        return str(value)


def _is_uuid(value: str) -> bool:
    try:
        UUID(value)
        return True
    except (ValueError, TypeError, AttributeError):
        return False


def _resolve_source(db: Session, source_type: str, source_id: str) -> tuple[Any, str] | None:
    """Look a source up by stable id (UUID) or by its human label column.

    Returns ``(record, label)`` or ``None`` when the record does not exist.
    """
    if source_type in REPORT_SOURCE_TYPES and source_type not in _SOURCE_MODELS:
        # Non-persisted analytical/network results — accept a label only.
        return (None, source_id or source_type)

    entry = _SOURCE_MODELS.get(source_type)
    if entry is None:
        return None
    model, label_attr, _default = entry
    record = None
    if _is_uuid(source_id):
        record = db.query(model).filter(model.id == UUID(source_id)).first()
    if record is None:
        record = db.query(model).filter(getattr(model, label_attr) == str(source_id).strip()).first()
    if record is None:
        return None
    label = getattr(record, label_attr, None) or str(getattr(record, "id", ""))
    return (record, str(label))


def collect_provenance(db: Session, sources: list[dict], evidence_ids: list[UUID]) -> list[str]:
    values: list[str] = []
    for ref in sources:
        entry = _resolve_source(db, ref.get("source_type", ""), ref.get("source_id", ""))
        if entry and entry[0] is not None:
            record = entry[0]
            values.append(getattr(record, "dataset_provenance", PROVENANCE_UNKNOWN) or PROVENANCE_UNKNOWN)
        else:
            values.append(PROVENANCE_UNKNOWN)
    for ev_id in evidence_ids:
        ev = db.query(Evidence).filter(Evidence.id == ev_id).first()
        if ev:
            values.append(ev.dataset_provenance or PROVENANCE_UNKNOWN)
        else:
            values.append(PROVENANCE_UNKNOWN)
    return values


def validate_references(
    db: Session, sources: list[dict], evidence_ids: list[UUID]
) -> dict:
    """Check every referenced record exists (§9 / test 12-13).

    Never treats a hallucinated case/evidence as verified.
    """
    verified: list[dict] = []
    missing: list[dict] = []
    for ref in sources:
        source_type = ref.get("source_type", "")
        source_id = ref.get("source_id", "")
        entry = _resolve_source(db, source_type, source_id)
        if entry is not None:
            verified.append({
                "source_type": source_type,
                "source_id": source_id,
                "source_label": ref.get("source_label") or (entry[1] if entry else source_id),
            })
        else:
            missing.append({
                "source_type": source_type,
                "source_id": source_id,
                "reason": "record does not exist",
            })
    for ev_id in evidence_ids:
        ev = db.query(Evidence).filter(Evidence.id == ev_id).first()
        if ev:
            verified.append({
                "source_type": SOURCE_TYPE_EVIDENCE,
                "source_id": str(ev.id),
                "source_label": ev.title,
            })
        else:
            missing.append({
                "source_type": SOURCE_TYPE_EVIDENCE,
                "source_id": str(ev_id),
                "reason": "evidence record does not exist",
            })
    return {"verified_records": verified, "missing_records": missing, "can_finalize_as_verified": not missing}


# --------------------------------------------------------------------------- #
# Access control
# --------------------------------------------------------------------------- #
def can_access_report(current_user: User, report: Report) -> bool:
    """Admins access everything; other users only their own reports (20/32)."""
    if current_user.role.name == ROLE_ADMIN:
        return True
    return report.requested_by_id == current_user.id


def require_report_access(current_user: User, report: Report, db: Session | None = None) -> None:
    if not can_access_report(current_user, report):
        raise ForbiddenException("You do not have access to this report")
    # District scoping: a district-bound caller may only operate on reports
    # whose stored district matches their authorized scope. Records without a
    # district (legacy) fail closed rather than leaking content.
    if db is not None:
        effective_district = enforce_district_scope(current_user, None, db)
        if effective_district:
            report_district = (report.district or "").strip().lower()
            if report_district != effective_district.strip().lower():
                raise ForbiddenException("Report is not within your authorized district")


def get_report_or_404(db: Session, report_id: UUID) -> Report:
    report = db.query(Report).filter(Report.id == report_id).first()
    if report is None:
        raise NotFoundException("Report not found")
    return report


# --------------------------------------------------------------------------- #
# Lifecycle operations
# --------------------------------------------------------------------------- #
def create_report(db: Session, user: User, payload: dict) -> Report:
    report_type = payload.get("report_type") or REPORT_TYPE_CASES
    if report_type not in REPORT_TYPES:
        raise ConflictException(f"Unsupported report type '{report_type}'")
    # District is bound server-side to the caller's enforced scope. A
    # district-bound user can never file a report labeled for another district;
    # the client-supplied value is only honoured for state-level callers.
    effective_district = enforce_district_scope(user, None, db)
    district = effective_district or payload.get("district")
    report = Report(
        template=f"{report_type}_report",
        report_type=report_type,
        title=payload.get("title"),
        requested_by_id=user.id,
        case_id=payload.get("case_id"),
        district=district,
        format=payload.get("format") or "pdf",
        provenance=payload.get("provenance") or PROVENANCE_UNKNOWN,
        ai_reported=bool(payload.get("ai_reported")),
        status=REPORT_STATUS_DRAFT,
        version=1,
    )
    db.add(report)
    db.flush()
    audit_service.log_action(
        db, user, "REPORT_CREATE", "Report", str(report.id),
        details=f"type={report.report_type}",
    )
    return report


def _link_sources(db: Session, report: Report, sources: list[dict]) -> None:
    report.source_links = []
    db.flush()
    links = []
    for ref in sources:
        source_type = ref.get("source_type", "")
        source_id = ref.get("source_id", "")
        entry = _resolve_source(db, source_type, source_id)
        label = ref.get("source_label")
        if label is None:
            label = entry[1] if entry else (source_id or source_type)
        links.append(ReportSourceLink(
            report_id=report.id,
            source_type=source_type if source_type in REPORT_SOURCE_TYPES else SOURCE_TYPE_ANALYTICAL,
            source_id=_norm_id(source_id),
            source_label=str(label)[:255],
        ))
    report.source_links = links
    db.flush()


def _link_evidence(db: Session, report: Report, evidence_ids: list[UUID]) -> None:
    report.evidence_links = []
    db.flush()
    links = []
    for ev_id in evidence_ids:
        ev = db.query(Evidence).filter(Evidence.id == ev_id).first()
        if ev is None:
            continue
        links.append(ReportEvidenceLink(
            report_id=report.id,
            evidence_id=ev.id,
            role="supporting",
        ))
    report.evidence_links = links
    db.flush()


def _snapshot_version(
    db: Session, user: User, report: Report, *, version_number: int, reason: str | None,
    content: dict | None, hash_value: str, metadata_json: str | None, status: str,
) -> ReportVersion:
    ver = ReportVersion(
        report_id=report.id,
        version_number=version_number,
        created_by_id=user.id,
        reason=reason,
        integrity_hash=hash_value,
        content_snapshot=snapshot_json(content),
        ai_metadata=metadata_json,
        status=status,
    )
    db.add(ver)
    db.flush()
    return ver


def generate_report(
    db: Session,
    user: User,
    report: Report,
    payload: dict,
    *,
    ip_address: str | None = None,
) -> Report:
    """Persist content, link sources/evidence, validate refs, snapshot v1/vN.

    Raises ConflictException on silent regeneration of a finalized report.
    Any failure leaves the report in FAILED state (never a misleading final).
    """
    if report.status == REPORT_STATUS_FINAL:
        raise ConflictException(
            "Finalized reports cannot be silently regenerated — create a new version instead"
        )
    try:
        report.status = REPORT_STATUS_GENERATING
        report.failure_reason = None
        db.flush()

        content = normalize_snapshot(payload.get("content"))
        snapshot = snapshot_json(content)
        report.content_snapshot = snapshot
        if payload.get("title"):
            report.title = payload.get("title")

        sources = payload.get("sources") or []
        evidence_ids = payload.get("evidence_ids") or []

        if payload.get("require_verified_references", True):
            result = validate_references(db, sources, evidence_ids)
            if not result["can_finalize_as_verified"]:
                report.status = REPORT_STATUS_FAILED
                report.failure_reason = (
                    "generation rejected — referenced records do not exist; "
                    "cannot finalize as verified"
                )
                db.flush()
                audit_service.log_action(
                    db, user, "REPORT_GENERATION_FAILED", "Report", str(report.id),
                    details="unverified source reference rejected", ip_address=ip_address,
                    result="failure",
                    metadata_json=json.dumps({"missing": len(result["missing_records"])}, default=_json_default),
                )
                raise ConflictException(
                    "Report generation rejected: referenced records do not exist. "
                    "Hallucinated source references cannot become verified report evidence."
                )

        # Link records only when they exist (never fabricate relationships).
        _link_sources(db, report, sources)
        _link_evidence(db, report, evidence_ids)

        provenance_values = collect_provenance(db, sources, evidence_ids)
        report.provenance = determine_provenance(provenance_values)

        ai_metadata = payload.get("ai_metadata")
        if ai_metadata:
            report.ai_reported = True
            report.ai_metadata = snapshot_json_pretty(ai_metadata)
        else:
            report.ai_reported = False
            report.ai_metadata = None

        report.analysis_fingerprint = payload.get("analysis_fingerprint")
        report.generation_method = (GEN_METHOD_AI_ASSISTED if report.ai_reported else GEN_METHOD_DATABASE_EXPORT)
        report.source_record_count = len(report.source_links)
        report.evidence_count = len(report.evidence_links)

        hash_value = compute_integrity_hash(
            content,
            {
                "provenance": report.provenance,
                "method": report.generation_method,
                "ai": report.ai_reported,
                "case": str(report.case_id) if report.case_id else None,
            },
        )
        report.integrity_hash = hash_value

        # Versioning: first generation snapshots v1; any later content change
        # produced before finalization increments the version.
        if report.version == 1 and _version_count(db, report.id) == 0:
            _snapshot_version(
                db, user, report,
                version_number=1, reason="Initial generation", content=content,
                hash_value=hash_value, metadata_json=report.ai_metadata,
                status=REPORT_STATUS_GENERATED,
            )
        elif report.status != REPORT_STATUS_DRAFT or report.content_snapshot:
            new_version = report.version + 1
            _snapshot_version(
                db, user, report,
                version_number=new_version, reason="Regenerated after content change",
                content=content, hash_value=hash_value, metadata_json=report.ai_metadata,
                status=REPORT_STATUS_GENERATED,
            )
            report.version = new_version

        report.status = REPORT_STATUS_GENERATED
        report.generated_at = utcnow()
        db.flush()

        audit_service.log_action(
            db, user, "REPORT_GENERATE", "Report", str(report.id),
            details=f"type={report.report_type}; v{report.version}; sources={report.source_record_count}; evidence={report.evidence_count}",
            ip_address=ip_address,
            metadata_json=json.dumps({
                "provenance": report.provenance,
                "method": report.generation_method,
                "ai": report.ai_reported,
            }, default=_json_default),
        )
        return report
    except ConflictException:
        raise
    except Exception as exc:
        report.status = REPORT_STATUS_FAILED
        report.failure_reason = str(exc)[:500]
        db.flush()
        audit_service.log_action(
            db, user, "REPORT_GENERATION_FAILED", "Report", str(report.id),
            details="report generation failed", ip_address=ip_address,
            result="failure",
        )
        raise


def snapshot_json_pretty(value: Any) -> str:
    return json.dumps(value, default=_json_default, indent=2) if value is not None else None


def _version_count(db: Session, report_id: UUID) -> int:
    return db.query(func.count(ReportVersion.id)).filter(ReportVersion.report_id == report_id).scalar() or 0


def start_review(
    db: Session, user: User, report: Report, *, notes: str | None = None, ip_address: str | None = None
) -> Report:
    if report.status in (REPORT_STATUS_ARCHIVED, REPORT_STATUS_FINAL):
        raise ConflictException(f"Cannot review a {report.status} report")
    if report.status not in (REPORT_STATUS_GENERATED, REPORT_STATUS_UNDER_REVIEW, REPORT_STATUS_GENERATING):
        raise ConflictException("Only generated reports can be reviewed")
    report.status = REPORT_STATUS_UNDER_REVIEW
    report.reviewed_by_id = user.id
    report.reviewed_at = utcnow()
    db.flush()
    audit_service.log_action(
        db, user, "REPORT_REVIEW", "Report", str(report.id),
        details=notes or "review started", ip_address=ip_address,
    )
    return report


def finalize_report(
    db: Session, user: User, report: Report, *, notes: str | None = None, ip_address: str | None = None
) -> Report:
    if report.status == REPORT_STATUS_ARCHIVED:
        raise ConflictException("Archived reports cannot be finalized")
    if report.content_snapshot is None and not report.ai_metadata:
        raise ConflictException("Report has no generated content — generate it before finalizing")
    if report.provenance == PROVENANCE_UNKNOWN and not report.source_links and not report.evidence_links:
        raise ConflictException("Report has no linked source records — cannot finalize as verified")

    report.status = REPORT_STATUS_FINAL
    report.finalized_by_id = user.id
    report.finalized_at = utcnow()
    report.integrity_hash = report.integrity_hash or compute_integrity_hash(
        _load_snapshot(report), {"provenance": report.provenance}
    )
    db.flush()
    audit_service.log_action(
        db, user, "REPORT_FINALIZE", "Report", str(report.id),
        details=f"v{report.version}; provenance={report.provenance}",
        ip_address=ip_address,
        metadata_json=json.dumps({"hash": report.integrity_hash}, default=_json_default),
    )
    return report


def archive_report(
    db: Session, user: User, report: Report, *, ip_address: str | None = None
) -> Report:
    if report.status == REPORT_STATUS_ARCHIVED:
        raise ConflictException("Report is already archived")
    report.status = REPORT_STATUS_ARCHIVED
    report.archived_at = utcnow()
    db.flush()
    audit_service.log_action(
        db, user, "REPORT_ARCHIVE", "Report", str(report.id),
        details=f"v{report.version}", ip_address=ip_address,
    )
    return report


def create_version(
    db: Session, user: User, report: Report, *, reason: str | None, new_content: dict | None,
    ip_address: str | None = None,
) -> ReportVersion:
    """Explicit correction workflow (§10/§11).

    Creates a new immutable version (vN+1); previous versions stay intact.
    Allowed even on FINAL reports — with an auditable reason.
    """
    content = normalize_snapshot(new_content) if new_content is not None else _load_snapshot(report)
    hash_value = compute_integrity_hash(content, {
        "provenance": report.provenance,
        "method": report.generation_method,
        "ai": report.ai_reported,
    })
    new_number = report.version + 1
    ver = _snapshot_version(
        db, user, report,
        version_number=new_number, reason=reason or "New version",
        content=content, hash_value=hash_value, metadata_json=report.ai_metadata,
        status=report.status,
    )
    report.version = new_number
    report.content_snapshot = snapshot_json(content)
    report.integrity_hash = hash_value
    db.flush()
    audit_service.log_action(
        db, user, "REPORT_VERSION_CREATE", "Report", str(report.id),
        details=f"new version v{new_number}", ip_address=ip_address,
    )
    return ver


def fail_report(
    db: Session, user: User, report: Report, *, reason: str, ip_address: str | None = None
) -> Report:
    report.status = REPORT_STATUS_FAILED
    report.failure_reason = str(reason)[:500]
    db.flush()
    audit_service.log_action(
        db, user, "REPORT_GENERATION_FAILED", "Report", str(report.id),
        details="report generation failed", ip_address=ip_address, result="failure",
    )
    return report


# --------------------------------------------------------------------------- #
# Serialization (route-facing)
# --------------------------------------------------------------------------- #
def _user_name(user) -> str | None:
    if user is None:
        return None
    return user.full_name or user.username


def serialize_report_details(db: Session, report: Report) -> dict:
    """Build the full report detail payload (§36)."""
    snapshot = _load_snapshot(report)
    ai_metadata = None
    if report.ai_metadata:
        try:
            ai_metadata = json.loads(report.ai_metadata)
        except (TypeError, ValueError):
            ai_metadata = {"raw": report.ai_metadata[:500]}

    sources = []
    for link in report.source_links or []:
        source_label = link.source_label
        try:
            entry = _resolve_source(db, link.source_type, link.source_id)
            if entry is not None and entry[0] is not None:
                source_label = getattr(entry[0], "dataset_provenance", None) and f"{entry[1]} ({getattr(entry[0], 'dataset_provenance', '')})" or entry[1]
        except Exception:
            pass
        sources.append({
            "source_type": link.source_type,
            "source_id": link.source_id,
            "source_label": source_label,
        })

    evidence = []
    for el in report.evidence_links or []:
        evidence.append({
            "evidence_id": str(el.evidence_id),
            "title": el.evidence.title if el.evidence else None,
            "evidence_type": el.evidence.evidence_type if el.evidence else None,
            "role": el.role,
        })

    versions = []
    for ver in (report.versions or []):
        versions.append({
            "id": str(ver.id),
            "version_number": ver.version_number,
            "created_at": ver.created_at,
            "reason": ver.reason,
            "status": ver.status,
            "integrity_hash": ver.integrity_hash,
            "created_by": _user_name(ver.created_by),
        })
    versions.sort(key=lambda v: v["version_number"])

    case_number = None
    if report.case_id:
        case = db.query(CrimeCase).filter(CrimeCase.id == report.case_id).first()
        case_number = case.case_number if case else None

    return {
        "id": str(report.id),
        "report_type": report.report_type,
        "template": report.template,
        "title": report.title,
        "district": report.district,
        "status": report.status,
        "format": report.format,
        "file_url": report.file_url,
        "provenance": report.provenance,
        "version": report.version,
        "integrity_hash": report.integrity_hash,
        "generation_method": report.generation_method,
        "analysis_fingerprint": report.analysis_fingerprint,
        "ai_reported": report.ai_reported,
        "source_record_count": report.source_record_count,
        "evidence_count": report.evidence_count,
        "case_id": str(report.case_id) if report.case_id else None,
        "case_number": case_number,
        "date_from": report.date_from,
        "date_to": report.date_to,
        "created_at": report.created_at,
        "updated_at": report.updated_at,
        "requested_by": _user_name(report.requested_by),
        "generated_at": report.generated_at,
        "reviewed_at": report.reviewed_at,
        "finalized_at": report.finalized_at,
        "archived_at": report.archived_at,
        "reviewed_by": _user_name(report.reviewed_by),
        "finalized_by": _user_name(report.finalized_by),
        "failure_reason": report.failure_reason,
        "ai_metadata": ai_metadata,
        "snapshot_headers": snapshot["headers"],
        "snapshot_row_count": len(snapshot["rows"]),
        "sources": sources,
        "evidence": evidence,
        "versions": versions,
    }


def serialize_audit_entry(entry: AuditLog) -> dict:
    return {
        "id": str(entry.id),
        "timestamp": entry.timestamp,
        "user": _user_name(entry.user),
        "role": entry.user.role.name if entry.user and getattr(entry.user, "role", None) else None,
        "action": entry.action,
        "resource_type": entry.resource_type,
        "resource_id": entry.resource_id,
        "result": entry.result,
        "details": entry.details,
        "ip": entry.ip_address,
    }


def legacy_report_provenance(db: Session, report_type: str, rows: list[dict], report: Report) -> str:
    """Derived provenance for legacy live exports.

    Reports derive from the actual rows exported; demo/migrated flags in the
    data always surface as DEMO/MIGRATED (never silently LIVE).
    """
    values: set[str] = set()
    if report and report.provenance != PROVENANCE_UNKNOWN:
        values.add(report.provenance)
    model_map = {
        REPORT_TYPE_CASES: CrimeCase,
        REPORT_TYPE_CRIMINALS: Criminal,
        REPORT_TYPE_OFFICERS: Officer,
        REPORT_TYPE_EVIDENCE: Evidence,
        REPORT_TYPE_HOTSPOTS: Location,
        REPORT_TYPE_INTERVENTIONS: Intervention,
        REPORT_TYPE_NETWORK: Criminal,
        REPORT_TYPE_VICTIMOLOGY: Victim,
        REPORT_TYPE_STRATEGIC: CrimeCase,
        REPORT_TYPE_DOSSIER: CrimeCase,
    }
    model = model_map.get(report_type)
    if model is not None and hasattr(model, "dataset_provenance"):
        for prov, in db.query(model.dataset_provenance).distinct().all():
            if prov:
                values.add(prov)
    return determine_provenance(values) if values else PROVENANCE_UNKNOWN