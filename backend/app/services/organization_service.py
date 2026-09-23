"""Organization and Cross-Authority Case Access management service."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.auth.rbac import ALL_AUTHORITIES, ALL_CAPABILITIES
from app.core.exceptions import ConflictException, NotFoundException
from app.models.case_access import CaseAccess
from app.models.organization import Organization


def list_organizations(
    db: Session,
    status: str | None = None,
    authority_type: str | None = None,
) -> list[Organization]:
    query = db.query(Organization)
    if status:
        query = query.filter(Organization.status == status)
    if authority_type:
        query = query.filter(Organization.authority_type == authority_type)
    return query.order_by(Organization.name).all()


def get_organization(db: Session, org_id: uuid.UUID) -> Organization | None:
    return db.query(Organization).filter(Organization.id == org_id).first()


def create_organization(
    db: Session,
    name: str,
    code: str,
    authority_type: str,
    jurisdiction: str | None = None,
    parent_organization_id: uuid.UUID | None = None,
    org_metadata: dict[str, Any] | None = None,
    **kwargs: Any,
) -> Organization:
    existing = db.query(Organization).filter(
        (Organization.name == name) | (Organization.code == code)
    ).first()
    if existing:
        raise ConflictException("Organization with this name or code already exists")

    meta = dict(org_metadata or {})
    if kwargs:
        meta.update(kwargs)

    org = Organization(
        name=name.strip(),
        code=code.strip().upper(),
        authority_type=authority_type.strip().upper(),
        jurisdiction=jurisdiction.strip() if jurisdiction else None,
        parent_organization_id=parent_organization_id,
        status="active",
        org_metadata=meta,
    )
    db.add(org)
    db.commit()
    db.refresh(org)
    return org


def update_organization(
    db: Session,
    org_id: uuid.UUID,
    updates: dict[str, Any],
) -> Organization:
    org = get_organization(db, org_id)
    if not org:
        raise NotFoundException("Organization not found")

    for field in ("name", "code", "authority_type", "jurisdiction", "status", "parent_organization_id", "org_metadata"):
        if field in updates and updates[field] is not None:
            val = updates[field]
            if field in ("name", "code", "authority_type") and isinstance(val, str):
                val = val.strip()
            setattr(org, field, val)

    db.add(org)
    db.commit()
    db.refresh(org)
    return org


def list_authorities() -> list[dict[str, str]]:
    descriptions = {
        "LAW_ENFORCEMENT": "Police and investigative bodies managing field operations and FIR lifecycles",
        "COURT": "Judicial authorities with read-only case inspection, chain of custody, and timeline intelligence",
        "PROSECUTION": "Prosecutorial units reviewing evidential sufficiency and legal compliance",
        "FORENSIC": "Laboratories and digital forensics experts examining physical and digital evidence",
        "ANALYSIS": "Crime analysis and intelligence cells conducting predictive and network pattern detection",
        "SUPERVISORY": "Oversight and statutory review authorities monitoring compliance",
        "ADMINISTRATION": "Platform and organization governance administrators",
        "OTHER": "Authorized government or institutional user groups",
    }
    return [
        {"type": auth, "description": descriptions.get(auth, "Authorized authority")}
        for auth in ALL_AUTHORITIES
    ]


def list_capabilities() -> list[str]:
    return sorted(ALL_CAPABILITIES)


def grant_case_access(
    db: Session,
    case_id: uuid.UUID,
    organization_id: uuid.UUID,
    access_level: str = "READ",
    scope: str = "CASE",
    granted_by: uuid.UUID | None = None,
    expires_at: datetime | None = None,
    notes: str | None = None,
    purpose: str | None = None,
    **kwargs: Any,
) -> CaseAccess:
    effective_notes = notes or purpose
    # Check if grant already exists
    existing = (
        db.query(CaseAccess)
        .filter(
            CaseAccess.case_id == case_id,
            CaseAccess.organization_id == organization_id,
        )
        .first()
    )
    if existing:
        existing.access_level = access_level
        existing.scope = scope
        existing.status = "active"
        existing.granted_by = granted_by
        existing.granted_at = datetime.now(timezone.utc)
        existing.expires_at = expires_at
        existing.notes = effective_notes
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return existing

    grant = CaseAccess(
        case_id=case_id,
        organization_id=organization_id,
        access_level=access_level,
        scope=scope,
        status="active",
        granted_by=granted_by,
        granted_at=datetime.now(timezone.utc),
        expires_at=expires_at,
        notes=effective_notes,
    )
    db.add(grant)
    db.commit()
    db.refresh(grant)
    return grant


def list_case_accesses(
    db: Session,
    case_id: uuid.UUID | None = None,
    organization_id: uuid.UUID | None = None,
) -> list[CaseAccess]:
    query = db.query(CaseAccess)
    if case_id:
        query = query.filter(CaseAccess.case_id == case_id)
    if organization_id:
        query = query.filter(CaseAccess.organization_id == organization_id)
    return query.order_by(CaseAccess.created_at.desc()).all()


def revoke_case_access(db: Session, access_id: uuid.UUID) -> bool:
    grant = db.query(CaseAccess).filter(CaseAccess.id == access_id).first()
    if not grant:
        raise NotFoundException("Case access grant not found")
    grant.status = "revoked"
    db.add(grant)
    db.commit()
    return True
