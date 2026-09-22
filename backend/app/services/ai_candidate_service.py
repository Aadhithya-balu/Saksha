"""Review-gated knowledge candidate lifecycle (issue #269, Phase 2).

Candidates are human-review-gated knowledge records: an AI pass proposes a
record (crime case / FIR), and only a reviewer accepting it materializes a real
record in the database. No auto-confirmation, per the bare-metal rules.
"""
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundException
from app.models.ai_candidates import AICandidateRecord
from app.models.fir import FIR
from app.models.user import User
from app.schemas.crime import CrimeCaseCreate
from app.schemas.fir import FIRCreate
from app.services import audit_service
from app.ai.inference.refresh import mark_data_changed
from app.services.base_service import BaseCRUDService
from app.services.case_status import InvalidStatusTransitionError, validate_transition
from app.services.crime_service import crime_crud

logger = logging.getLogger(__name__)

candidate_crud = BaseCRUDService(AICandidateRecord)


class CandidateReviewError(ValueError):
    pass


def create_candidate(
    db: Session,
    *,
    candidate_type: str,
    source_entity_type: str,
    source_entity_id: uuid.UUID | None,
    proposed_payload: dict,
    confidence: float = 0.0,
    provenance: dict | None = None,
) -> AICandidateRecord:
    candidate = AICandidateRecord(
        candidate_type=candidate_type,
        source_entity_type=source_entity_type,
        source_entity_id=source_entity_id,
        proposed_payload=proposed_payload,
        confidence=confidence,
        status="PROPOSED",
        provenance=provenance,
    )
    db.add(candidate)
    db.commit()
    db.refresh(candidate)
    return candidate


def list_candidates(
    db: Session,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict:
    query = db.query(AICandidateRecord)
    if status:
        query = query.filter(AICandidateRecord.status == status)
    query = query.order_by(AICandidateRecord.created_at.desc())
    total = query.count()
    items = query.offset(offset).limit(limit).all()
    return {"items": items, "total": total}


def get_candidate(db: Session, candidate_id: uuid.UUID) -> AICandidateRecord:
    candidate = db.query(AICandidateRecord).filter(AICandidateRecord.id == candidate_id).first()
    if not candidate:
        raise NotFoundException("Candidate not found")
    return candidate


def accept_candidate(
    db: Session,
    candidate_id: uuid.UUID,
    reviewer: User,
    review_note: str | None = None,
    overrides: dict | None = None,
) -> tuple[AICandidateRecord, dict]:
    """Accept a PROPOSED candidate and materialize its real record.

    The merged payload must satisfy the target create schema (CrimeCaseCreate /
    FIRCreate). Missing or invalid fields raise CandidateReviewError so
    reviewers can correct via overrides — records are never fabricated from
    partial data.
    """
    candidate = get_candidate(db, candidate_id)
    if candidate.status != "PROPOSED":
        raise CandidateReviewError(f"Candidate is already {candidate.status}")

    merged = {**(candidate.proposed_payload or {}), **(overrides or {})}

    if candidate.candidate_type == "CRIME_CASE":
        try:
            payload = CrimeCaseCreate(**merged).model_dump()
        except Exception as exc:  # pydantic ValidationError
            raise CandidateReviewError(f"Invalid crime-case payload: {exc}")
        # Schema-only flag (validated, never persisted) — mirrors the route.
        payload.pop("found_by_police", None)
        try:
            payload["status"] = validate_transition(None, payload.get("status", "active"))
        except InvalidStatusTransitionError as exc:
            raise CandidateReviewError(exc.message)
        case = crime_crud.create(db, payload)
        mark_data_changed("crime_case", db=db)
        created = {"type": "CRIME_CASE", "id": str(case.id)}
    elif candidate.candidate_type == "FIR":
        try:
            payload = FIRCreate(**merged).model_dump(
                exclude={"criminal_ids", "victim_ids", "attachments", "found_by_police"}
            )
        except Exception as exc:
            raise CandidateReviewError(f"Invalid FIR payload: {exc}")
        payload["attachments"] = "[]"
        fir_obj = FIR(**payload)
        db.add(fir_obj)
        db.flush()
        db.refresh(fir_obj)
        db.commit()
        mark_data_changed("fir", db=db)
        created = {"type": "FIR", "id": str(fir_obj.id)}
    else:
        raise CandidateReviewError(f"Unsupported candidate_type {candidate.candidate_type}")

    candidate.status = "ACCEPTED"
    candidate.reviewed_by_id = reviewer.id
    candidate.reviewed_at = _utc_now_naive()
    candidate.review_note = review_note
    candidate.resolved_record_type = created["type"]
    candidate.resolved_record_id = uuid.UUID(created["id"])
    db.commit()
    db.refresh(candidate)

    audit_service.log_action(
        db, reviewer, "UPDATE", "AICandidateRecord", str(candidate.id),
        details=f"accepted as {created['type']} {created['id']}",
    )
    return candidate, created


def reject_candidate(
    db: Session,
    candidate_id: uuid.UUID,
    reviewer: User,
    review_note: str | None = None,
) -> AICandidateRecord:
    candidate = get_candidate(db, candidate_id)
    if candidate.status != "PROPOSED":
        raise CandidateReviewError(f"Candidate is already {candidate.status}")

    candidate.status = "REJECTED"
    candidate.reviewed_by_id = reviewer.id
    candidate.reviewed_at = _utc_now_naive()
    candidate.review_note = review_note
    db.commit()
    db.refresh(candidate)
    audit_service.log_action(
        db, reviewer, "UPDATE", "AICandidateRecord", str(candidate.id),
        details="rejected",
    )
    return candidate


def _utc_now_naive():
    return datetime.now(timezone.utc).replace(tzinfo=None)