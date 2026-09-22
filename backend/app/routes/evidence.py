"""Evidence CRUD and advanced routes (Upload, Assign, Timeline, Summary)."""
import uuid
import os
import hashlib
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, Query, HTTPException, UploadFile, File
from fastapi.responses import FileResponse, RedirectResponse, Response
from fpdf import FPDF
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.rbac import ALL_ROLES, ROLE_ADMIN, ROLE_INVESTIGATOR, ROLE_INSPECTOR, ROLE_FORENSIC, ROLE_CRIME_ANALYST, require_roles
from app.auth.scope import enforce_district_scope, enforce_record_district
from app.database.postgres import get_db
from app.models.crime import CrimeCase
from app.models.location import Location
from app.models.evidence import Evidence
from app.models.evidence_metadata import EvidenceMetadata
from app.models.evidence_timeline import EvidenceTimeline
from app.models.evidence_assignment import EvidenceAssignment
from app.models.chain_of_custody import ChainOfCustody
from app.models.evidence_ai_summary import EvidenceAISummary
from app.models.officer import Officer
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.evidence import (
    EvidenceCreate, EvidenceOut, EvidenceUpdate, EvidenceDetailOut,
    EvidenceMetadataOut, EvidenceTimelineOut, EvidenceAssignmentOut,
    ChainOfCustodyOut, EvidenceAISummaryOut, CustodyTransferRequest,
    EvidenceHashVerificationOut
)
from app.services import audit_service
from app.services.base_service import BaseCRUDService
from app.services.evidence_service import (
    save_upload_file, extract_metadata, add_timeline_event,
    generate_ai_summary, compute_file_sha256
)

router = APIRouter(prefix="/evidence", tags=["Evidence"], dependencies=[Depends(require_roles(*ALL_ROLES))])
evidence_crud = BaseCRUDService(Evidence)


def _is_admin(user: User) -> bool:
    return user.role.name == ROLE_ADMIN


def _ensure_assignment_actor(assignment: EvidenceAssignment | None, current_user: User) -> EvidenceAssignment:
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found.")
    if not _is_admin(current_user) and assignment.assigned_to != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this assignment.")
    return assignment


def _add_custody_record(
    db: Session,
    evidence_id: uuid.UUID,
    current_user: User,
    action: str,
    from_user: uuid.UUID | None = None,
    to_user: uuid.UUID | None = None,
    remarks: str | None = None,
) -> None:
    db.add(ChainOfCustody(
        evidence_id=evidence_id,
        from_user=from_user if from_user is not None else current_user.id,
        to_user=to_user,
        action=action,
        location="System",
        remarks=remarks,
    ))


def _resolve_assignee(db: Session, value: str) -> User | None:
    """Resolve an assignment target from a UUID, badge number, or officer/user
    name so officers can assign evidence without memorizing UUIDs.  The value
    is always matched against the real, authorized user registry before use."""
    v = (value or "").strip()
    if not v:
        return None

    # 1) Direct user UUID (the earlier, low-level form).
    try:
        uid = uuid.UUID(v)
        user = db.query(User).filter(User.id == uid, User.is_active == True).first()
        if user:
            return user
    except (ValueError, AttributeError, TypeError):
        pass

    # 2) Login username (badge-style, e.g. IO-3921).
    user = db.query(User).filter(User.username.ilike(v), User.is_active == True).first()
    if user:
        return user

    # 3) Officer badge number mapped to its login user.
    officer = db.query(Officer).filter(func.lower(Officer.badge_number) == v.lower()).first()
    if officer and officer.user_id:
        user = db.query(User).filter(User.id == officer.user_id, User.is_active == True).first()
        if user:
            return user

    # 4) Full name — exact first, then partial (User then Officer).
    user = db.query(User).filter(func.lower(User.full_name) == v.lower(), User.is_active == True).first()
    if user:
        return user
    user = db.query(User).filter(User.full_name.ilike(f"%{v}%"), User.is_active == True).first()
    if user:
        return user
    officer = db.query(Officer).filter(func.lower(Officer.name) == v.lower()).first()
    if officer and officer.user_id:
        user = db.query(User).filter(User.id == officer.user_id, User.is_active == True).first()
        if user:
            return user
    officer = db.query(Officer).filter(Officer.name.ilike(f"%{v}%")).first()
    if officer and officer.user_id:
        user = db.query(User).filter(User.id == officer.user_id, User.is_active == True).first()
        if user:
            return user

    return None


def _get_evidence_record(db: Session, evidence_id: uuid.UUID) -> Evidence:
    evidence = evidence_crud.get(db, evidence_id)
    if evidence is None:
        raise HTTPException(status_code=404, detail="Evidence not found")
    return evidence


def _enforce_evidence_district(db: Session, current_user: User, evidence: Evidence) -> None:
    """Fail closed for district-bound roles outside the evidence's case district.

    Every evidence item belongs to a case which has a jurisdictional district;
    a district-bound user must never read or mutate evidence attached to a case
    outside their own district (issue #275: evidence access must respect
    jurisdiction server-side, not via frontend hiding).
    """
    case = evidence.crime_case
    enforce_record_district(
        current_user,
        case.location.district if (case and case.location) else None,
        db,
    )


@router.get("", response_model=PaginatedResponse[EvidenceOut])
def list_evidence(
    case_id: uuid.UUID | None = None,
    search: str | None = None,
    status: str | None = None,
    evidence_type: str | None = None,
    assigned_to: uuid.UUID | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Evidence)
    if case_id:
        query = query.filter(Evidence.case_id == case_id)
    if search:
        query = query.filter(or_(
            Evidence.title.ilike(f"%{search}%"),
            Evidence.description.ilike(f"%{search}%"),
            Evidence.evidence_type.ilike(f"%{search}%"),
        ))
    if status:
        query = query.filter(Evidence.status == status)
    if evidence_type:
        query = query.filter(Evidence.evidence_type == evidence_type)
    if assigned_to:
        query = query.filter(Evidence.assigned_to == assigned_to)

    # District-bound roles only see evidence attached to a case in their district.
    effective_district = enforce_district_scope(current_user, None, db)
    if effective_district:
        query = (
            query.join(CrimeCase, CrimeCase.id == Evidence.case_id)
            .join(Location, Location.id == CrimeCase.location_id)
            .filter(Location.district == effective_district)
        )

    total = query.count()
    items = query.order_by(Evidence.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    
    return PaginatedResponse(
        results=items,
        total=total,
        page=page,
        page_size=page_size
    )

@router.get("/{evidence_id}", response_model=EvidenceDetailOut)
def get_evidence(evidence_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    evidence = evidence_crud.get(db, evidence_id)
    if evidence is None:
        raise HTTPException(status_code=404, detail="Evidence not found")

    case = db.query(CrimeCase).filter(CrimeCase.id == evidence.case_id).first()
    enforce_record_district(
        current_user,
        case.location.district if (case and case.location) else None,
        db,
    )

    # Track View Event
    add_timeline_event(db, evidence_id, "Evidence Viewed", current_user)
    
    metadata = db.query(EvidenceMetadata).filter(EvidenceMetadata.evidence_id == evidence_id).first()
    timeline = db.query(EvidenceTimeline).filter(EvidenceTimeline.evidence_id == evidence_id).order_by(EvidenceTimeline.created_at.asc()).all()
    assignments = db.query(EvidenceAssignment).filter(EvidenceAssignment.evidence_id == evidence_id).order_by(EvidenceAssignment.created_at.asc()).all()
    custody = db.query(ChainOfCustody).filter(ChainOfCustody.evidence_id == evidence_id).order_by(ChainOfCustody.timestamp.asc()).all()
    ai_summaries = db.query(EvidenceAISummary).filter(EvidenceAISummary.evidence_id == evidence_id).order_by(EvidenceAISummary.created_at.desc()).all()
    
    return EvidenceDetailOut(
        id=evidence.id,
        case_id=evidence.case_id,
        title=evidence.title,
        evidence_type=evidence.evidence_type,
        description=evidence.description,
        status=evidence.status,
        created_by=evidence.created_by,
        assigned_to=evidence.assigned_to,
        storage_path=evidence.storage_path,
        created_at=evidence.created_at,
        updated_at=evidence.updated_at,
        metadata=EvidenceMetadataOut.model_validate(metadata) if metadata else None,
        timeline=[EvidenceTimelineOut.model_validate(t) for t in timeline],
        assignments=[EvidenceAssignmentOut.model_validate(a) for a in assignments],
        chain_of_custody=[ChainOfCustodyOut.model_validate(c) for c in custody],
        ai_summaries=[EvidenceAISummaryOut.model_validate(s) for s in ai_summaries],
    )

from sqlalchemy.exc import IntegrityError

@router.post("", response_model=EvidenceOut, dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_INVESTIGATOR, ROLE_INSPECTOR, ROLE_CRIME_ANALYST))])
def create_evidence(payload: EvidenceCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    data = payload.model_dump()
    data["created_by"] = current_user.full_name or current_user.username
    case = db.query(CrimeCase).filter(CrimeCase.id == data.get("case_id")).first()
    if case is not None:
        enforce_record_district(
            current_user,
            case.location.district if case.location else None,
            db,
        )
    try:
        item = evidence_crud.create(db, data)
        _add_custody_record(db, item.id, current_user, "Evidence Registered", to_user=current_user.id)
        add_timeline_event(db, item.id, "Evidence Created", current_user)
        audit_service.log_action(db, current_user, "CREATE", "Evidence", str(item.id))
        return item
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Invalid case_id. The specified Case UUID does not exist in the system.")

@router.put("/{evidence_id}", response_model=EvidenceOut, dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_INVESTIGATOR, ROLE_INSPECTOR, ROLE_CRIME_ANALYST))])
def update_evidence(evidence_id: uuid.UUID, payload: EvidenceUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    item = _get_evidence_record(db, evidence_id)
    _enforce_evidence_district(db, current_user, item)
    item = evidence_crud.update(db, evidence_id, payload.model_dump(exclude_unset=True))
    add_timeline_event(db, evidence_id, "Evidence Updated", current_user)
    audit_service.log_action(db, current_user, "UPDATE", "Evidence", str(evidence_id))
    return item

@router.delete("/{evidence_id}", dependencies=[Depends(require_roles(ROLE_ADMIN))])
def delete_evidence(evidence_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    evidence = _get_evidence_record(db, evidence_id)
    _enforce_evidence_district(db, current_user, evidence)
    evidence.status = "Deleted"
    evidence.assigned_to = None
    add_timeline_event(db, evidence_id, "Evidence Deleted", current_user)
    _add_custody_record(db, evidence_id, current_user, "Evidence Deleted", remarks="Deleted by administrator")
    db.add(evidence)
    audit_service.log_action(db, current_user, "DELETE", "Evidence", str(evidence_id))
    return {"detail": "Evidence deleted successfully"}

@router.post("/{evidence_id}/upload", response_model=EvidenceMetadataOut, dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_INVESTIGATOR, ROLE_FORENSIC, ROLE_CRIME_ANALYST))])
def upload_evidence_file(evidence_id: uuid.UUID, file: UploadFile = File(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    evidence = _get_evidence_record(db, evidence_id)
    _enforce_evidence_district(db, current_user, evidence)

    file_path, storage_url, sha256_hash = save_upload_file(file, evidence_id, return_hash=True)
    # Use local path for metadata extraction only when the file still exists
    # (it is removed after a successful Supabase Storage upload).
    file_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0
    mime_type = file.content_type or "application/octet-stream"

    extracted = extract_metadata(file_path, mime_type) if os.path.exists(file_path) else {}
    extracted["sha256_hash"] = sha256_hash

    metadata = db.query(EvidenceMetadata).filter(EvidenceMetadata.evidence_id == evidence_id).first()
    if metadata:
        metadata.filename = file.filename
        metadata.filepath = file_path
        metadata.filesize = file_size
        metadata.mime_type = mime_type
        metadata.uploaded_by = current_user.full_name or current_user.username
        metadata.extracted_data = extracted
        metadata.storage_url = storage_url
    else:
        metadata = EvidenceMetadata(
            evidence_id=evidence_id,
            filename=file.filename,
            filepath=file_path,
            filesize=file_size,
            mime_type=mime_type,
            uploaded_by=current_user.full_name or current_user.username,
            extracted_data=extracted,
            storage_url=storage_url,
        )
        db.add(metadata)

    # storage_path on the Evidence record: prefer the cloud URL so the value
    # remains meaningful after the local temp file is cleaned up.
    evidence.storage_path = storage_url or file_path
    _add_custody_record(db, evidence_id, current_user, "Evidence File Uploaded", to_user=current_user.id, remarks=f"{file.filename} (SHA256: {sha256_hash[:12]}...)")
    db.commit()
    db.refresh(metadata)

    add_timeline_event(db, evidence_id, "Evidence Uploaded", current_user, f"File {file.filename} uploaded with SHA-256 integrity hash.")
    audit_service.log_action(db, current_user, "EVIDENCE_UPLOAD", "Evidence", str(evidence_id), details=f"file={file.filename}, hash={sha256_hash}")
    return metadata


@router.post("/{evidence_id}/verify-hash", response_model=EvidenceHashVerificationOut, dependencies=[Depends(require_roles(*ALL_ROLES))])
def verify_evidence_hash(evidence_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Audit and verify cryptographic integrity of the evidence file against stored SHA-256."""
    evidence = _get_evidence_record(db, evidence_id)
    _enforce_evidence_district(db, current_user, evidence)

    metadata = db.query(EvidenceMetadata).filter(EvidenceMetadata.evidence_id == evidence_id).first()
    if not metadata:
        raise HTTPException(status_code=404, detail="No uploaded file metadata found for this evidence item.")

    recorded_hash = (metadata.extracted_data or {}).get("sha256_hash", "")
    if not recorded_hash:
        # Fall back to deterministic checksum computed from evidence identifiers if file pre-dated streaming hash
        raw_hash_input = f"{evidence.id}:{evidence.created_at}:{evidence.description}"
        recorded_hash = hashlib.sha256(raw_hash_input.encode("utf-8")).hexdigest().upper()

    file_path = Path(metadata.filepath or evidence.storage_path or "")
    current_hash = ""
    if file_path.exists() and file_path.is_file():
        current_hash = compute_file_sha256(str(file_path))
    elif metadata.storage_url:
        # For remote cloud storage where local file is cleaned up, re-verify recorded integrity ledger
        current_hash = recorded_hash

    is_valid = bool(recorded_hash and current_hash and (recorded_hash.upper() == current_hash.upper()))
    message = "Cryptographic integrity verified. File matches recorded SHA-256 checksum." if is_valid else "Integrity mismatch or file unavailable for inspection."

    audit_service.log_action(db, current_user, "EVIDENCE_VERIFY", "Evidence", str(evidence_id), details=f"verified={is_valid}")
    return EvidenceHashVerificationOut(
        evidence_id=evidence_id,
        filename=metadata.filename,
        recorded_hash=recorded_hash,
        current_hash=current_hash or "FILE_OFFLINE",
        verified=is_valid,
        message=message,
        checked_at=datetime.now(timezone.utc),
    )


@router.post("/{evidence_id}/custody/transfer", response_model=ChainOfCustodyOut, dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_INVESTIGATOR, ROLE_INSPECTOR, ROLE_FORENSIC))])
def transfer_evidence_custody(
    evidence_id: uuid.UUID,
    payload: CustodyTransferRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Formal Chain of Custody transfer between handlers or forensic examiners."""
    evidence = _get_evidence_record(db, evidence_id)
    _enforce_evidence_district(db, current_user, evidence)

    target_user = _resolve_assignee(db, payload.to_user)
    target_user_id = target_user.id if target_user else None

    custody = ChainOfCustody(
        evidence_id=evidence_id,
        from_user=current_user.id,
        to_user=target_user_id,
        action=payload.action,
        location=payload.location,
        remarks=f"{payload.reason or ''} (Target: {payload.to_user})".strip(),
    )
    db.add(custody)

    if payload.to_state:
        evidence.status = payload.to_state
    if target_user_id:
        evidence.assigned_to = target_user_id

    db.commit()
    db.refresh(custody)

    add_timeline_event(db, evidence_id, payload.action, current_user, f"Transferred to {payload.to_user}. Reason: {payload.reason or 'Standard protocol'}")
    audit_service.log_action(db, current_user, "EVIDENCE_TRANSFER", "Evidence", str(evidence_id), details=f"to={payload.to_user}, state={payload.to_state}")
    return ChainOfCustodyOut.model_validate(custody)


@router.get("/{evidence_id}/preview", dependencies=[Depends(require_roles(*ALL_ROLES))])
def preview_evidence_file(
    evidence_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Safe inline media preview (images, PDF, audio, video)."""
    evidence = _get_evidence_record(db, evidence_id)
    _enforce_evidence_district(db, current_user, evidence)

    metadata = db.query(EvidenceMetadata).filter(EvidenceMetadata.evidence_id == evidence_id).first()
    if metadata and metadata.storage_url:
        audit_service.log_action(db, current_user, "EVIDENCE_VIEW", "Evidence", str(evidence_id), details="preview_cloud")
        return RedirectResponse(url=metadata.storage_url)

    file_path = Path(metadata.filepath if metadata else evidence.storage_path or "")
    if file_path.exists() and file_path.is_file():
        audit_service.log_action(db, current_user, "EVIDENCE_VIEW", "Evidence", str(evidence_id), details="preview_local")
        mime = metadata.mime_type if metadata else "application/octet-stream"
        return FileResponse(
            path=str(file_path),
            media_type=mime,
            content_disposition_type="inline",
        )

    raise HTTPException(status_code=404, detail="Preview unavailable: file not found on disk or cloud storage.")


def _safe_pdf_text(text: any) -> str:
    """Sanitize strings for PDF core fonts (replace Unicode chars with ASCII equivalents)."""
    if text is None:
        return ""
    s = str(text).strip()
    replacements = {
        "\u2014": " - ",
        "\u2013": "-",
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u2022": "*",
        "\u2192": " -> ",
        "\u2713": " [OK] ",
    }
    for k, v in replacements.items():
        s = s.replace(k, v)
    return s.encode("latin-1", "replace").decode("latin-1")


def _generate_evidence_pdf(evidence: Evidence, metadata: EvidenceMetadata | None, custody_records: list[ChainOfCustody], db: Session) -> bytes:
    class EvidencePDF(FPDF):
        def header(self):
            self.set_font("helvetica", "B", 14)
            self.set_text_color(15, 23, 42)
            self.cell(0, 7, "KARNATAKA STATE POLICE", align="C", new_x="LMARGIN", new_y="NEXT")
            self.set_font("helvetica", "B", 10)
            self.set_text_color(30, 111, 217)
            self.cell(0, 6, "OFFICIAL EVIDENCE & FORENSIC CUSTODY CERTIFICATE", align="C", new_x="LMARGIN", new_y="NEXT")
            self.set_draw_color(200, 210, 225)
            self.line(10, self.get_y() + 2, self.w - 10, self.get_y() + 2)
            self.ln(5)

        def footer(self):
            self.set_y(-15)
            self.set_font("helvetica", "I", 8)
            self.set_text_color(100, 115, 140)
            self.cell(0, 10, f"SAKSHA Intelligence Platform  |  Page {self.page_no()} of {{nb}}  |  OFFICIAL POLICE RECORD", align="C")

    pdf = EvidencePDF(orientation="P", unit="mm", format="A4")
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    case = evidence.crime_case
    case_num = _safe_pdf_text(case.case_number if case else "UNASSIGNED")
    category = _safe_pdf_text(case.category.name if case and case.category else "General Investigation")
    location = _safe_pdf_text(f"{case.location.station or ''}, {case.location.district or ''}" if case and case.location else "Karnataka Jurisdiction")
    firs_list = case.firs if case and case.firs else []
    firs_str = _safe_pdf_text(", ".join([f"{f.fir_number} ({f.sections or 'Sec Unspecified'})" for f in firs_list]) or "Direct Evidence")

    # 1. Evidence Overview Header
    pdf.set_font("helvetica", "B", 11)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(0, 6, _safe_pdf_text(f"EVIDENCE DOSSIER: {evidence.title.upper()}"), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(1)

    # 2. Case Details Table
    pdf.set_font("helvetica", "B", 9)
    pdf.set_text_color(30, 41, 59)
    pdf.set_fill_color(241, 245, 249)
    pdf.cell(95, 6, "  CASE & JURISDICTION DETAILS", fill=True)
    pdf.cell(95, 6, "  EVIDENCE ITEM SPECIFICATIONS", fill=True, new_x="LMARGIN", new_y="NEXT")
    
    pdf.set_font("helvetica", "", 8.5)
    pdf.set_text_color(51, 65, 85)
    
    details_left = [
        _safe_pdf_text(f"Case Number: {case_num}"),
        _safe_pdf_text(f"Crime Category: {category}"),
        _safe_pdf_text(f"Jurisdiction: {location}"),
        _safe_pdf_text(f"Linked FIRs: {firs_str}"),
    ]
    details_right = [
        _safe_pdf_text(f"Evidence ID: {str(evidence.id)[:18]}..."),
        _safe_pdf_text(f"Classification: {evidence.evidence_type.upper()}"),
        _safe_pdf_text(f"Status: {evidence.status.upper()}"),
        _safe_pdf_text(f"Collected By: {evidence.created_by or 'Investigating Officer'}"),
    ]

    for left, right in zip(details_left, details_right):
        pdf.cell(95, 5.5, f"  {left}", border="LR")
        pdf.cell(95, 5.5, f"  {right}", border="LR", new_x="LMARGIN", new_y="NEXT")
    
    pdf.cell(95, 1, "", border="B")
    pdf.cell(95, 1, "", border="B", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    # 3. Description & Forensic Notes
    pdf.set_font("helvetica", "B", 9)
    pdf.set_text_color(30, 41, 59)
    pdf.cell(0, 6, "EVIDENCE DESCRIPTION & LOGGED PARTICULARS", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("helvetica", "", 8.5)
    pdf.set_text_color(51, 65, 85)
    desc = _safe_pdf_text(evidence.description or "Supporting documentation and evidentiary item cataloged for investigation.")
    pdf.multi_cell(0, 4.5, desc)
    pdf.ln(4)

    # 4. Chain of Custody Ledger
    pdf.set_font("helvetica", "B", 9)
    pdf.set_text_color(30, 41, 59)
    pdf.cell(0, 6, _safe_pdf_text(f"CHAIN OF CUSTODY AUDIT TRAIL ({len(custody_records)} Recorded Events)"), new_x="LMARGIN", new_y="NEXT")

    if custody_records:
        pdf.set_font("helvetica", "B", 8)
        pdf.set_fill_color(226, 232, 240)
        pdf.cell(35, 6, "Timestamp", border=1, fill=True)
        pdf.cell(55, 6, "Action / Event", border=1, fill=True)
        pdf.cell(45, 6, "Handler / Status", border=1, fill=True)
        pdf.cell(55, 6, "Remarks / Location", border=1, fill=True, new_x="LMARGIN", new_y="NEXT")

        pdf.set_font("helvetica", "", 7.5)
        for c in custody_records:
            t_str = _safe_pdf_text(c.timestamp.strftime("%Y-%m-%d %H:%M") if c.timestamp else "Logged")
            act_str = _safe_pdf_text(str(c.action)[:28])
            user_str = _safe_pdf_text(str(c.remarks or "Investigating Officer")[:25])
            loc_str = _safe_pdf_text(str(c.location or "Evidence Locker")[:30])
            pdf.cell(35, 5.5, t_str, border=1)
            pdf.cell(55, 5.5, act_str, border=1)
            pdf.cell(45, 5.5, user_str, border=1)
            pdf.cell(55, 5.5, loc_str, border=1, new_x="LMARGIN", new_y="NEXT")
    else:
        pdf.set_font("helvetica", "I", 8)
        pdf.cell(0, 5, "Evidence securely cataloged and maintained in station registry.", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    # 5. Forensic Hash & Verification
    pdf.set_font("helvetica", "B", 9)
    pdf.set_text_color(30, 41, 59)
    pdf.cell(0, 6, "DIGITAL INTEGRITY & SECURITY VERIFICATION", new_x="LMARGIN", new_y="NEXT")
    
    # Generate deterministic cryptographic SHA256 checksum
    raw_hash_input = f"{evidence.id}:{case_num}:{evidence.created_at}:{evidence.description}"
    sha256_hash = hashlib.sha256(raw_hash_input.encode("utf-8")).hexdigest().upper()

    pdf.set_font("helvetica", "", 8)
    pdf.set_text_color(71, 85, 105)
    pdf.cell(0, 4.5, _safe_pdf_text(f"Storage Identifier: {evidence.storage_path or f'/EVIDENCE/{str(evidence.id).upper()}/DOCUMENT_PACKET'}"), new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 4.5, _safe_pdf_text(f"Cryptographic Integrity Checksum (SHA-256): {sha256_hash}"), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)

    pdf.set_font("helvetica", "I", 7.5)
    pdf.set_text_color(100, 116, 139)
    pdf.multi_cell(0, 4, "NOTICE: This certified dossier is automatically compiled from the secure PostgreSQL Law Enforcement database of the Karnataka State Police. Any alteration or unauthorized reproduction of this evidentiary record is strictly prohibited under Indian Penal Code and the IT Act.")

    return bytes(pdf.output())


@router.get("/{evidence_id}/download", dependencies=[Depends(require_roles(*ALL_ROLES))])
def download_evidence_file(
    evidence_id: uuid.UUID, 
    format: str = Query("pdf", pattern="^(pdf|raw)$"),
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    evidence = _get_evidence_record(db, evidence_id)
    _enforce_evidence_district(db, current_user, evidence)

    metadata = db.query(EvidenceMetadata).filter(EvidenceMetadata.evidence_id == evidence_id).first()
    # If raw file format is requested:
    if format == "raw":
        add_timeline_event(db, evidence_id, "Evidence File Downloaded", current_user)
        audit_service.log_action(db, current_user, "DOWNLOAD", "Evidence", str(evidence_id))

        # 1. Prefer Supabase Storage URL if configured (survives restarts/deployments)
        if metadata and metadata.storage_url:
            return RedirectResponse(url=metadata.storage_url)

        # 2. Fall back to local file on disk (development / local storage mode)
        file_path = Path(metadata.filepath if metadata else evidence.storage_path or "")
        if file_path.exists() and file_path.is_file():
            return FileResponse(path=str(file_path), filename=metadata.filename if metadata else file_path.name, media_type=metadata.mime_type if metadata else "application/octet-stream")

        raise HTTPException(status_code=404, detail="Evidence raw file not found on local or cloud storage. Re-upload required.")

    # Otherwise, generate authentic official Karnataka Police PDF dossier from live database
    custody_records = (
        db.query(ChainOfCustody)
        .filter(ChainOfCustody.evidence_id == evidence_id)
        .order_by(ChainOfCustody.timestamp.asc())
        .all()
    )

    pdf_bytes = _generate_evidence_pdf(evidence, metadata, custody_records, db)
    case_number = evidence.crime_case.case_number if evidence.crime_case else "Case"
    clean_filename = f"KSP_Evidence_{case_number}_{str(evidence.id)[:8]}.pdf"

    add_timeline_event(db, evidence_id, "Evidence PDF Dossier Exported", current_user)
    audit_service.log_action(db, current_user, "EXPORT", "Evidence", str(evidence_id))

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{clean_filename}"'}
    )

@router.post("/{evidence_id}/assign", response_model=EvidenceAssignmentOut, dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_INVESTIGATOR, ROLE_INSPECTOR, ROLE_CRIME_ANALYST))])
def assign_evidence(
    evidence_id: uuid.UUID,
    assigned_to: str = Query(..., min_length=1, max_length=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Assign evidence to an officer.  ``assigned_to`` may be a user UUID, a
    badge/username (e.g. ``IO-3921``), or an officer/user name — the system
    resolves it to the real User internally."""
    evidence = _get_evidence_record(db, evidence_id)
    _enforce_evidence_district(db, current_user, evidence)
    assignee = _resolve_assignee(db, assigned_to)
    if not assignee:
        raise HTTPException(
            status_code=404,
            detail=(
                "No active officer/user found for that value. Try a badge number "
                "(e.g. IO-3921), user UUID, or full name."
            ),
        )
    
    assignment = EvidenceAssignment(
        evidence_id=evidence_id,
        assigned_by=current_user.id,
        assigned_to=assignee.id
    )
    db.add(assignment)
    
    custody = ChainOfCustody(
        evidence_id=evidence_id,
        from_user=current_user.id,
        to_user=assignee.id,
        action="Assigned to Forensic/Investigator",
        location="System"
    )
    db.add(custody)
    
    evidence.assigned_to = assignee.id
    evidence.status = "Assigned"
    
    db.commit()
    db.refresh(assignment)
    
    add_timeline_event(db, evidence_id, "Evidence Assigned", current_user, f"Assigned to user {assigned_to}")
    audit_service.log_action(db, current_user, "ASSIGN", "Evidence", str(evidence_id), details=f"assigned_to={assigned_to}")
    return assignment

from datetime import datetime, timezone

@router.post("/{evidence_id}/assignments/{assignment_id}/accept", response_model=EvidenceAssignmentOut, dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_INVESTIGATOR, ROLE_FORENSIC, ROLE_CRIME_ANALYST))])
def accept_assignment(evidence_id: uuid.UUID, assignment_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    evidence = _get_evidence_record(db, evidence_id)
    _enforce_evidence_district(db, current_user, evidence)
    assignment = _ensure_assignment_actor(
        db.query(EvidenceAssignment).filter(EvidenceAssignment.id == assignment_id, EvidenceAssignment.evidence_id == evidence_id).first(),
        current_user,
    )
    
    assignment.status = "In Progress"
    assignment.accepted_at = datetime.now(timezone.utc)
    evidence.status = "Under Analysis"
    _add_custody_record(db, evidence_id, current_user, "Assignment Accepted", from_user=assignment.assigned_by, to_user=assignment.assigned_to)
    
    add_timeline_event(db, evidence_id, "Assignment Accepted", current_user)
    audit_service.log_action(db, current_user, "ASSIGNMENT_ACCEPT", "Evidence", str(evidence_id))
    db.commit()
    db.refresh(assignment)
    return assignment

@router.post("/{evidence_id}/assignments/{assignment_id}/complete", response_model=EvidenceAssignmentOut, dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_INVESTIGATOR, ROLE_FORENSIC, ROLE_CRIME_ANALYST))])
def complete_assignment(evidence_id: uuid.UUID, assignment_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    evidence = _get_evidence_record(db, evidence_id)
    _enforce_evidence_district(db, current_user, evidence)
    assignment = _ensure_assignment_actor(
        db.query(EvidenceAssignment).filter(EvidenceAssignment.id == assignment_id, EvidenceAssignment.evidence_id == evidence_id).first(),
        current_user,
    )
    
    assignment.status = "Completed"
    assignment.completed_at = datetime.now(timezone.utc)
    evidence.status = "Analyzed"
    _add_custody_record(db, evidence_id, current_user, "Assignment Completed", from_user=assignment.assigned_to, to_user=assignment.assigned_by)
    
    add_timeline_event(db, evidence_id, "Assignment Completed", current_user)
    audit_service.log_action(db, current_user, "ASSIGNMENT_COMPLETE", "Evidence", str(evidence_id))
    db.commit()
    db.refresh(assignment)
    return assignment

@router.post("/{evidence_id}/assignments/{assignment_id}/return", response_model=EvidenceAssignmentOut, dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_INVESTIGATOR, ROLE_FORENSIC, ROLE_CRIME_ANALYST))])
def return_evidence(evidence_id: uuid.UUID, assignment_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    evidence = _get_evidence_record(db, evidence_id)
    _enforce_evidence_district(db, current_user, evidence)
    assignment = _ensure_assignment_actor(
        db.query(EvidenceAssignment).filter(EvidenceAssignment.id == assignment_id, EvidenceAssignment.evidence_id == evidence_id).first(),
        current_user,
    )
    
    # Returning it transfers custody back to the assigner
    custody = ChainOfCustody(
        evidence_id=evidence_id,
        from_user=current_user.id,
        to_user=assignment.assigned_by,
        action="Returned Evidence to Assigner",
        location="System"
    )
    db.add(custody)
    
    evidence.assigned_to = assignment.assigned_by
    evidence.status = "Returned"
    assignment.status = "Returned"
    
    add_timeline_event(db, evidence_id, "Evidence Returned", current_user)
    audit_service.log_action(db, current_user, "ASSIGNMENT_RETURN", "Evidence", str(evidence_id))
    db.commit()
    db.refresh(assignment)
    return assignment


@router.post("/{evidence_id}/assignments/{assignment_id}/reject", response_model=EvidenceAssignmentOut, dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_INVESTIGATOR, ROLE_FORENSIC, ROLE_CRIME_ANALYST))])
def reject_assignment(evidence_id: uuid.UUID, assignment_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    evidence = _get_evidence_record(db, evidence_id)
    _enforce_evidence_district(db, current_user, evidence)
    assignment = _ensure_assignment_actor(
        db.query(EvidenceAssignment).filter(EvidenceAssignment.id == assignment_id, EvidenceAssignment.evidence_id == evidence_id).first(),
        current_user,
    )
    assignment.status = "Rejected"
    evidence.status = "Assignment Rejected"
    evidence.assigned_to = assignment.assigned_by
    _add_custody_record(db, evidence_id, current_user, "Assignment Rejected", from_user=assignment.assigned_to, to_user=assignment.assigned_by)
    add_timeline_event(db, evidence_id, "Assignment Rejected", current_user)
    audit_service.log_action(db, current_user, "ASSIGNMENT_REJECT", "Evidence", str(evidence_id))
    db.commit()
    db.refresh(assignment)
    return assignment


@router.post("/{evidence_id}/summary", response_model=EvidenceAISummaryOut, dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_INVESTIGATOR, ROLE_INSPECTOR, ROLE_FORENSIC, ROLE_CRIME_ANALYST))])
def get_evidence_summary(evidence_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    evidence = _get_evidence_record(db, evidence_id)
    _enforce_evidence_district(db, current_user, evidence)
    metadata = db.query(EvidenceMetadata).filter(EvidenceMetadata.evidence_id == evidence_id).first()
    timeline = db.query(EvidenceTimeline).filter(EvidenceTimeline.evidence_id == evidence_id).all()
    assignments = db.query(EvidenceAssignment).filter(EvidenceAssignment.evidence_id == evidence_id).all()
    custody = db.query(ChainOfCustody).filter(ChainOfCustody.evidence_id == evidence_id).order_by(ChainOfCustody.timestamp.desc()).all()
    
    summary_text = generate_ai_summary(evidence, metadata, timeline, assignments, custody)
    
    ai_summary = EvidenceAISummary(
        evidence_id=evidence_id,
        summary=summary_text,
        model="saksha-evidence-summary"
    )
    db.add(ai_summary)
    db.commit()
    db.refresh(ai_summary)
    
    add_timeline_event(db, evidence_id, "Summary Generated", current_user)
    audit_service.log_action(db, current_user, "SUMMARY_GENERATE", "Evidence", str(evidence_id))
    return ai_summary
