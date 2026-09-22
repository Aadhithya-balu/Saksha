"""Analytics alert-finding review workflow (Phase 5, issue #269).

Rule-driven findings require an explicit human review decision
(confirm | investigate | dismiss) just like identity/proxy leads. All writes
are audited; district-bound callers only ever see their own jurisdiction.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.rbac import (
    ALL_ROLES,
    REVIEW_ROLES,
    ROLE_ADMIN,
    ROLE_CRIME_ANALYST,
    require_roles,
)
from app.auth.scope import enforce_district_scope, is_multi_district
from app.database.postgres import get_db
from app.models.user import User
from app.services.alert_finding_service import (
    generate_candidate_findings,
    list_findings,
    review_finding,
)
from app.models.alert_finding import AlertFinding, finding_payload
from app.services.audit_service import log_action

router = APIRouter(
    prefix="/alerts",
    tags=["Alert Findings"],
    dependencies=[Depends(require_roles(*ALL_ROLES))],
)


@router.get("/findings")
def get_findings(
    status: str | None = Query(default=None),
    finding_type: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List analytics findings. Refreshes rule detection first so the review
    page always presents current proposed leads (deduped by grouping_key)."""
    effective_district = enforce_district_scope(current_user, None, db)
    generate_candidate_findings(
        db,
        district=None if is_multi_district(current_user) else effective_district,
    )
    scope = None if is_multi_district(current_user) else effective_district
    return {
        "total": len(list_findings(db, district=scope, limit=500)),
        "results": list_findings(
            db,
            district=scope,
            status=status,
            finding_type=finding_type,
            limit=limit,
        ),
    }


@router.get("/findings/{finding_id}")
def get_finding(
    finding_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    effective_district = enforce_district_scope(current_user, None, db)
    finding = db.query(AlertFinding).filter(AlertFinding.id == finding_id).first()
    if finding is None:
        raise HTTPException(404, "Finding not found")
    if not is_multi_district(current_user) and finding.district.lower() != effective_district.lower():
        raise HTTPException(403, "This finding belongs to another district and is outside your scope.")
    return finding_payload(finding)


@router.post(
    "/findings/generate",
    dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_CRIME_ANALYST))],
)
def regenerate_findings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Force a rule-detection pass and persist any new proposed findings."""
    effective_district = enforce_district_scope(current_user, None, db)
    stats = generate_candidate_findings(
        db,
        district=None if is_multi_district(current_user) else effective_district,
    )
    log_action(
        db, current_user, "CREATE", "AlertFinding",
        details=f"Analytics finding regeneration: {stats}",
        metadata_json=f'{{"generated":{stats["generated"]}}}',
    )
    db.commit()
    return stats


@router.post(
    "/findings/{finding_id}/review",
    dependencies=[Depends(require_roles(*REVIEW_ROLES))],
)
def review_finding_endpoint(
    finding_id: uuid.UUID,
    decision: str = Query(...),
    note: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Record a reviewer decision on a proposed finding.

    Nothing is auto-confirmed: a finding only changes lifecycle state through
    this endpoint (confirm | investigate | dismiss).
    """
    effective_district = enforce_district_scope(current_user, None, db)
    finding = db.query(AlertFinding).filter(AlertFinding.id == finding_id).first()
    if finding is None:
        raise HTTPException(404, "Finding not found")
    if not is_multi_district(current_user) and finding.district.lower() != effective_district.lower():
        raise HTTPException(403, "This finding belongs to another district and is outside your scope.")

    try:
        finding = review_finding(db, finding, decision, current_user, note=note)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    log_action(
        db, current_user, "UPDATE", "AlertFinding", str(finding.id),
        details=f"Analytics finding {finding.id} decision '{decision}'",
        metadata_json=f'{{"decision":"{decision}"}}',
    )
    db.commit()
    return finding_payload(finding)