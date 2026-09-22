"""Phase 1 (issue #269): ingestion API — sources, uploads, jobs, provenance."""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Form, HTTPException, Query, UploadFile, File, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.rbac import ALL_ROLES, ROLE_ADMIN, ROLE_CRIME_ANALYST, ROLE_INSPECTOR, ROLE_INVESTIGATOR, require_roles
from app.auth.scope import enforce_district_scope
from app.database.postgres import get_db
from app.models.user import User
from app.schemas.ingestion import (
    DataSourceCreate,
    DataSourceOut,
    DataSourceUpdate,
    IngestionJobDetailOut,
    IngestionJobOut,
    IngestionJobProvenanceOut,
    IngestionStatusOut,
    SourceKindListItem,
)
from app.services.audit_service import log_action
from app.services.ingestion.ingestion_service import INGESTION_ARTIFACT_KINDS, IngestionService

router = APIRouter(prefix="/ingestion", tags=["ingestion"])

_UPLOAD_ROLES = (ROLE_ADMIN, ROLE_INVESTIGATOR, ROLE_CRIME_ANALYST, ROLE_INSPECTOR)
_SOURCE_ADMIN_ROLES = (ROLE_ADMIN, ROLE_CRIME_ANALYST, ROLE_INVESTIGATOR)

_KIND_LABELS: dict[str, str] = {
    "document": "Documents (PDF, DOCX, TXT)",
    "image": "Images / Scanned documents",
    "video": "Video / CCTV",
    "csv": "Tabular exports (CSV)",
    "json": "Structured JSON",
    "database": "Database pulls",
    "api": "External APIs / feeds",
    "manual": "Manual structured entry",
}


@router.get("/kinds", response_model=list[SourceKindListItem])
def list_kinds(current_user: User = Depends(get_current_user)):
    return [
        SourceKindListItem(
            value=kind,
            label=_KIND_LABELS.get(kind, kind),
            ai_eligible=kind in ("document", "image", "video"),
        )
        for kind in sorted(INGESTION_ARTIFACT_KINDS)
    ]


@router.get("/sources", response_model=list[DataSourceOut])
def list_sources(
    active_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return IngestionService.list_sources(db, active_only=active_only)


@router.post("/sources", response_model=DataSourceOut, dependencies=[Depends(require_roles(*_SOURCE_ADMIN_ROLES))])
def create_source(payload: DataSourceCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    source = IngestionService.create_source(db, payload.model_dump(), current_user.id)
    log_action(db, current_user, "CREATE", "DataSource", str(source.id), metadata_json='{"name": "%s"}' % source.name)
    return source


@router.put("/sources/{source_id}", response_model=DataSourceOut, dependencies=[Depends(require_roles(*_SOURCE_ADMIN_ROLES))])
def update_source(source_id: uuid.UUID, payload: DataSourceUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    source = IngestionService.update_source(db, source_id, payload.model_dump(exclude_unset=True))
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    log_action(db, current_user, "UPDATE", "DataSource", str(source.id))
    return source


@router.delete("/sources/{source_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_roles(*_SOURCE_ADMIN_ROLES))])
def delete_source(source_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not IngestionService.delete_source(db, source_id):
        raise HTTPException(status_code=404, detail="Source not found")
    log_action(db, current_user, "DELETE", "DataSource", str(source_id))


@router.post("/upload", response_model=IngestionJobOut)
async def upload_artifact(
    file: UploadFile = File(...),
    source_id: Optional[str] = Form(default=None),
    jurisdiction: Optional[str] = Form(default=None),
    origin: Optional[str] = Form(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Ingest a file artifact. Kicks off background validation/normalisation."""
    if not any(current_user.role.name == r for r in _UPLOAD_ROLES):
        raise HTTPException(status_code=403, detail="Not authorized to ingest artifacts")

    source_uuid: Optional[uuid.UUID] = None
    if source_id:
        try:
            source_uuid = uuid.UUID(source_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid source_id")

    jurisdiction_payload = None
    if jurisdiction:
        import json as _json
        try:
            jurisdiction_payload = _json.loads(jurisdiction)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid jurisdiction JSON")

    try:
        job = IngestionService.create_upload_job(
            db, file, current_user,
            source_id=source_uuid,
            jurisdiction=jurisdiction_payload,
            origin=origin,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to store artifact: {exc}")

    log_action(db, current_user, "CREATE", "IngestionJob", str(job.id), metadata_json='{"kind": "%s"}' % job.artifact_kind)
    return job


@router.post("/jobs/manual", response_model=IngestionJobOut)
def create_manual_job(
    artifact_kind: str = Form(...),
    origin: Optional[str] = Form(default=None),
    jurisdiction: Optional[str] = Form(default=None),
    source_id: Optional[str] = Form(default=None),
    manifest: Optional[str] = Form(default="{}"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Register a structured database/API/manual artifact (no file upload)."""
    if not any(current_user.role.name == r for r in _UPLOAD_ROLES):
        raise HTTPException(status_code=403, detail="Not authorized to ingest artifacts")

    import json as _json

    source_uuid: Optional[uuid.UUID] = None
    if source_id:
        try:
            source_uuid = uuid.UUID(source_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid source_id")
    try:
        manifest_payload = _json.loads(manifest or "{}")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid manifest JSON")

    jurisdiction_payload = None
    if jurisdiction:
        try:
            jurisdiction_payload = _json.loads(jurisdiction)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid jurisdiction JSON")

    job = IngestionService.create_manual_job(
        db, current_user,
        artifact_kind=artifact_kind,
        manifest=manifest_payload,
        jurisdiction=jurisdiction_payload,
        origin=origin,
        source_id=source_uuid,
    )
    log_action(db, current_user, "CREATE", "IngestionJob", str(job.id), metadata_json='{"kind": "%s"}' % job.artifact_kind)
    return job


@router.get("/jobs", response_model=list[IngestionJobOut])
def list_jobs(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    kind: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return IngestionService.list_jobs(db, status=status_filter, kind=kind, limit=limit, offset=offset)


@router.get("/jobs/status", response_model=IngestionStatusOut)
def ingestion_status(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return IngestionService.aggregate_status(db)


@router.get("/jobs/{job_id}", response_model=IngestionJobDetailOut)
def get_job(job_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    job = IngestionService.get_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Ingestion job not found")
    return job


@router.get("/jobs/{job_id}/provenance", response_model=IngestionJobProvenanceOut)
def get_provenance(job_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Lineage view — intentionally excludes any server-side storage detail."""
    job = IngestionService.get_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Ingestion job not found")
    return IngestionJobProvenanceOut(
        id=job.id,
        status=job.status,
        artifact_kind=job.artifact_kind,
        original_filename=job.original_filename,
        content_hash=job.content_hash,
        provenance=job.provenance,
        source=job.source,
        received_at=job.received_at,
        processed_at=job.completed_at,
        record_count=job.record_count,
    )


@router.post("/jobs/{job_id}/retry", response_model=IngestionJobOut, dependencies=[Depends(require_roles(*_SOURCE_ADMIN_ROLES))])
def retry_job(job_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    job = IngestionService.retry_job(db, job_id)
    if not job:
        raise HTTPException(status_code=400, detail="Job not found or not in a retryable state")
    log_action(db, current_user, "UPDATE", "IngestionJob", str(job.id), details="retry")
    return job