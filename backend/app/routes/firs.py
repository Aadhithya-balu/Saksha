"""FIR search + CRUD routes."""
import json
import os
import uuid
from datetime import datetime

import httpx
from fastapi import APIRouter, Depends, Query, HTTPException, UploadFile, File
from fastapi.responses import FileResponse, Response
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.rbac import ALL_ROLES, ROLE_ADMIN, ROLE_INVESTIGATOR, require_roles
from app.auth.scope import enforce_district_scope, enforce_record_district
from app.database.postgres import get_db
from app.models.fir import FIR, FIRCriminalLink, FIRVictimLink
from app.models.crime import CrimeCase
from app.models.location import Location
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.fir import FIRCreate, FIROut, FIRUpdate, FIRDetailOut
from app.ai.inference.refresh import mark_data_changed
from app.services import audit_service
from app.services.base_service import BaseCRUDService
from app.services.evidence_service import UPLOAD_DIR, save_upload_file

router = APIRouter(prefix="/firs", tags=["FIRs"], dependencies=[Depends(require_roles(*ALL_ROLES))])
fir_crud = BaseCRUDService(FIR)


@router.get("", response_model=PaginatedResponse[FIROut])
def list_firs(
    status: str | None = None,
    section: str | None = None,
    search: str | None = None,
    district: str | None = None,
    officer_id: uuid.UUID | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(FIR)
    if search:
        query = query.filter(
            or_(
                FIR.fir_number.ilike(f"%{search}%"),
                FIR.complainant_name.ilike(f"%{search}%"),
                FIR.sections.ilike(f"%{search}%"),
                FIR.narrative.ilike(f"%{search}%")
            )
        )
    if status:
        query = query.filter(FIR.status == status)
    if section:
        query = query.filter(FIR.sections.ilike(f"%{section}%"))
    if officer_id:
        query = query.filter(FIR.investigating_officer_id == officer_id)
    if start_date:
        query = query.filter(FIR.filed_at >= start_date)
    if end_date:
        query = query.filter(FIR.filed_at <= end_date)

    # District-bound roles are always narrowed to their own district; the
    # client-supplied value can never widen scope.
    effective_district = enforce_district_scope(current_user, district, db)
    if effective_district:
        query = query.join(CrimeCase).join(Location).filter(Location.district == effective_district)

    total = query.count()
    results = query.order_by(FIR.filed_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"total": total, "page": page, "page_size": page_size, "results": results}


@router.get("/{fir_id}", response_model=FIRDetailOut)
def get_fir(fir_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    fir = db.query(FIR).filter(FIR.id == fir_id).first()
    if not fir:
        raise HTTPException(status_code=404, detail="FIR not found")

    case_location = fir.crime_case.location if (fir.crime_case and fir.crime_case.location) else None
    enforce_record_district(current_user, case_location.district if case_location else None, db)

    crime_case = fir.crime_case
    officer = fir.investigating_officer
    criminals = [link.criminal for link in fir.criminal_links if link.criminal]
    victims = [link.victim for link in fir.victim_links if link.victim]
    evidence = crime_case.evidence if crime_case else []

    # Calculate AI risk score
    risk_score = 45
    reasons = []
    if crime_case:
        severity = crime_case.category.severity if crime_case.category else "medium"
        if severity == "high":
            risk_score += 25
            reasons.append("Accused sections carry a high-severity penal classification")
        elif severity == "medium":
            risk_score += 10
            reasons.append("Accused sections carry a medium-severity classification")
        
        if crime_case.status == "open":
            risk_score += 15
            reasons.append("Primary crime investigation is open")
        
        if crime_case.mo_tags:
            tag_count = len([t for t in crime_case.mo_tags.split(",") if t.strip()])
            risk_score += min(15, tag_count * 5)
            reasons.append(f"Multiple Modus Operandi markers detected ({tag_count})")
    
    if len(criminals) > 1:
        risk_score += 15
        reasons.append(f"Multi-offender conspiracy: {len(criminals)} accused named")
    
    if fir.status == "closed":
        risk_score = max(15, risk_score - 35)
        reasons.append("FIR investigation closed and filed in court")
    else:
        # If open for more than 30 days
        days_open = (datetime.now().astimezone() - fir.filed_at.astimezone()).days if fir.filed_at else 0
        if days_open > 30:
            risk_score += min(15, (days_open // 30) * 5)
            reasons.append(f"FIR has been active and unresolved for {days_open} days")

    risk_score = min(98, max(5, risk_score))

    # Parse attachments
    attachments_list = []
    if fir.attachments:
        try:
            attachments_list = json.loads(fir.attachments)
        except Exception:
            attachments_list = []

    return {
        "id": fir.id,
        "fir_number": fir.fir_number,
        "crime_case_id": fir.crime_case_id,
        "investigating_officer_id": fir.investigating_officer_id,
        "complainant_name": fir.complainant_name,
        "complainant_contact": fir.complainant_contact,
        "sections": fir.sections,
        "narrative": fir.narrative,
        "status": fir.status,
        "filed_at": fir.filed_at,
        "created_at": fir.created_at,
        "crime_case": crime_case,
        "investigating_officer": officer,
        "criminals": criminals,
        "victims": victims,
        "evidence": evidence,
        "attachments": _public_attachments(attachments_list),
        "ai_risk_score": risk_score,
        "ai_analysis_reasons": reasons
    }


@router.get("/{fir_id}/linked-crimes")
def linked_crimes(fir_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    fir = fir_crud.get(db, fir_id)
    return {"crime_case_id": fir.crime_case_id}


@router.post("", response_model=FIROut, dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_INVESTIGATOR))])
def create_fir(payload: FIRCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    data = payload.model_dump(exclude={"criminal_ids", "victim_ids", "attachments", "found_by_police"})
    
    if payload.attachments:
        data["attachments"] = json.dumps(payload.attachments)
    else:
        data["attachments"] = "[]"

    fir = fir_crud.create(db, data)

    for criminal_id in payload.criminal_ids:
        db.add(FIRCriminalLink(fir_id=fir.id, criminal_id=criminal_id, role="accused"))
    for victim_id in payload.victim_ids:
        db.add(FIRVictimLink(fir_id=fir.id, victim_id=victim_id))
    db.flush()

    audit_service.log_action(db, current_user, "CREATE", "FIR", str(fir.id))
    mark_data_changed("fir", db=db)
    return fir


@router.put("/{fir_id}", response_model=FIROut, dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_INVESTIGATOR))])
def update_fir(fir_id: uuid.UUID, payload: FIRUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    update_data = payload.model_dump(exclude={"criminal_ids", "victim_ids", "attachments"}, exclude_unset=True)
    
    if payload.attachments is not None:
        update_data["attachments"] = json.dumps(payload.attachments)

    fir = fir_crud.update(db, fir_id, update_data)

    if payload.criminal_ids is not None:
        db.query(FIRCriminalLink).filter(FIRCriminalLink.fir_id == fir_id).delete()
        for criminal_id in payload.criminal_ids:
            db.add(FIRCriminalLink(fir_id=fir_id, criminal_id=criminal_id, role="accused"))

    if payload.victim_ids is not None:
        db.query(FIRVictimLink).filter(FIRVictimLink.fir_id == fir_id).delete()
        for victim_id in payload.victim_ids:
            db.add(FIRVictimLink(fir_id=fir_id, victim_id=victim_id))

    db.flush()
    audit_service.log_action(db, current_user, "UPDATE", "FIR", str(fir_id))
    mark_data_changed("fir", db=db)
    return fir


@router.delete("/{fir_id}", dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_INVESTIGATOR))])
def delete_fir(fir_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db.query(FIRCriminalLink).filter(FIRCriminalLink.fir_id == fir_id).delete()
    db.query(FIRVictimLink).filter(FIRVictimLink.fir_id == fir_id).delete()
    
    fir_crud.delete(db, fir_id)
    audit_service.log_action(db, current_user, "DELETE", "FIR", str(fir_id))
    mark_data_changed("fir", db=db)
    return {"message": "FIR deleted successfully"}


# ---------------------------------------------------------------------------
# FIR attachments — real binary upload/download (issue: FIR attachment storage)
# ---------------------------------------------------------------------------

def _load_attachments(fir: FIR) -> list[dict]:
    if not fir or not fir.attachments:
        return []
    try:
        data = json.loads(fir.attachments)
        return data if isinstance(data, list) else []
    except Exception:
        return []


def _public_attachments(attachments: list[dict]) -> list[dict]:
    """Strip internal storage fields so paths/keys never reach the client."""
    out = []
    for a in attachments:
        item = {k: v for k, v in a.items() if k not in ("stored_name", "storage_url")}
        item["has_file"] = bool(a.get("stored_name") or a.get("storage_url"))
        out.append(item)
    return out


def _attachment_file_path(stored_name: str | None):
    if not stored_name:
        return None
    path = (UPLOAD_DIR / stored_name).resolve()
    if not str(path).startswith(str(UPLOAD_DIR.resolve())):
        return None
    return path


@router.post("/{fir_id}/attachments", dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_INVESTIGATOR))])
def upload_fir_attachment(
    fir_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    fir = fir_crud.get(db, fir_id)
    if not fir:
        raise HTTPException(status_code=404, detail="FIR not found")

    file_path, storage_url = save_upload_file(file, fir_id, category="fir")
    stored_name = os.path.basename(file_path)
    file_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0

    record = {
        "id": str(uuid.uuid4()),
        "name": file.filename,
        "size": file_size,
        "mime_type": file.content_type or "application/octet-stream",
        "uploaded_at": datetime.utcnow().isoformat(),
        "uploaded_by": current_user.full_name or current_user.username,
        "storage_url": storage_url,
        "stored_name": stored_name,
    }

    attachments = _load_attachments(fir)
    attachments.append(record)
    fir.attachments = json.dumps(attachments)
    db.add(fir)
    db.commit()

    audit_service.log_action(db, current_user, "UPLOAD", "FIR", str(fir_id))
    return _public_attachments(attachments)


@router.get("/{fir_id}/attachments/{attachment_id}/download")
def download_fir_attachment(
    fir_id: uuid.UUID,
    attachment_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    fir = fir_crud.get(db, fir_id)
    if not fir:
        raise HTTPException(status_code=404, detail="FIR not found")

    record = next((a for a in _load_attachments(fir) if a.get("id") == str(attachment_id)), None)
    if not record:
        raise HTTPException(status_code=404, detail="Attachment not found")

    mime_type = record.get("mime_type") or "application/octet-stream"
    filename = record.get("name") or "attachment"

    storage_url = record.get("storage_url")
    if storage_url:
        try:
            resp = httpx.get(storage_url, timeout=60)
            if resp.status_code == 200:
                return Response(
                    content=resp.content,
                    media_type=mime_type,
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'},
                )
        except Exception:  # noqa: BLE001 — fall back to the local copy
            pass

    path = _attachment_file_path(record.get("stored_name"))
    if path and path.exists() and path.is_file():
        return FileResponse(str(path), media_type=mime_type, filename=filename)

    raise HTTPException(status_code=404, detail="Attachment file is no longer available")


@router.delete("/{fir_id}/attachments/{attachment_id}", dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_INVESTIGATOR))])
def delete_fir_attachment(
    fir_id: uuid.UUID,
    attachment_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    fir = fir_crud.get(db, fir_id)
    if not fir:
        raise HTTPException(status_code=404, detail="FIR not found")

    attachments = _load_attachments(fir)
    record = next((a for a in attachments if a.get("id") == str(attachment_id)), None)
    if not record:
        raise HTTPException(status_code=404, detail="Attachment not found")

    path = _attachment_file_path(record.get("stored_name"))
    if path and path.exists() and path.is_file():
        try:
            os.remove(path)
        except OSError:
            pass

    attachments = [a for a in attachments if a.get("id") != str(attachment_id)]
    fir.attachments = json.dumps(attachments)
    db.add(fir)
    db.commit()

    audit_service.log_action(db, current_user, "DELETE", "FIR", str(fir_id))
    return _public_attachments(attachments)


