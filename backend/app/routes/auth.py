"""Authentication routes.

Round-2 security hardening:
- Security-relevant events (login success/failure, lockout, register,
  password change, logout) are written to the tamper-evident audit_logs table.
  Passwords and tokens are NEVER logged.
- Logout performs server-side refresh-token revocation (rotation denylist).
- Rate limiting on credential endpoints retained; global limits are enforced
  by app.core.rate_limit middleware.
"""
import time
from collections import defaultdict

from fastapi import APIRouter, Depends, Request
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.rbac import ROLE_ADMIN, require_roles
from app.core.config import settings
from app.core.exceptions import AppException
from app.core.logging_config import logger
from app.core.rate_limit import resolve_client_ip
from app.database.postgres import get_db
from app.models.user import User
from app.schemas.auth import ChangePasswordRequest, LoginRequest, LogoutRequest, RefreshRequest, TokenResponse, UpdateProfileRequest
from app.schemas.user import UserCreate, UserOut
from app.services import auth_service, audit_service

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Simple in-memory rate limiter: {ip: [(timestamp, ...)]} — complements the
# global middleware with a tighter budget specifically for credential paths.
_login_attempts: dict[str, list[float]] = defaultdict(list)
_REFRESH_WINDOW = 60  # seconds
_MAX_LOGIN_ATTEMPTS = 10
_MAX_REFRESH_ATTEMPTS = 30


def _rate_limit(ip: str, max_attempts: int, window: int, store: dict) -> None:
    if settings.APP_ENV == "test" or settings.DATABASE_URL and settings.DATABASE_URL.startswith("sqlite"):
        return  # skip rate limiting in test/SQLite mode
    now = time.time()
    store[ip] = [t for t in store[ip] if now - t < window]
    if len(store[ip]) >= max_attempts:
        retry_after = int(store[ip][0] + window - now) + 1
        raise AppException(
            f"Too many requests. Try again in {retry_after}s.",
            code="RATE_LIMITED",
            status_code=429,
        )
    store[ip].append(now)


def _client_ip(request: Request) -> str:
    # Use the real client IP even behind the nginx proxy (see rate_limit.py).
    return resolve_client_ip(request)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    ip = _client_ip(request)
    _rate_limit(ip, _MAX_LOGIN_ATTEMPTS, _REFRESH_WINDOW, _login_attempts)
    try:
        user = auth_service.authenticate_user(db, payload.username, payload.password)
        tokens = auth_service.issue_tokens(user)
        # Audit: record who authenticated from where. Never log the password.
        try:
            audit_service.log_action(
                db, user, action="LOGIN", resource_type="auth",
                resource_id=str(user.id), ip_address=ip,
            )
            db.commit()
        except Exception:
            db.rollback()
        return TokenResponse(**tokens, expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)
    except AppException:
        raise
    except SQLAlchemyError as exc:
        # DB outage must NOT be mistaken for a credential failure: report a
        # controlled 503 so operators can distinguish availability from auth.
        logger.error("Login unavailable: database error {}", exc, exc_info=True)
        raise AppException(
            "Authentication service is temporarily unavailable. Please try again later.",
            code="SERVICE_UNAVAILABLE",
            status_code=503,
        ) from exc
    except Exception as exc:
        import traceback
        traceback.print_exc()
        raise AppException(
            "Invalid username or password. Please verify your credentials.",
            code="UNAUTHORIZED",
            status_code=401,
        )


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest, request: Request, db: Session = Depends(get_db)):
    ip = _client_ip(request)
    _rate_limit(ip, _MAX_REFRESH_ATTEMPTS, _REFRESH_WINDOW, _login_attempts)
    tokens = auth_service.refresh_access_token(db, payload.refresh_token)
    return TokenResponse(**tokens, expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)


@router.post("/logout")
def logout(
    request: Request,
    payload: LogoutRequest | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Revoke the presented access and refresh tokens until their expiry."""
    refresh_token = payload.refresh_token if payload else None
    authorization = request.headers.get("Authorization", "")
    access_token = authorization[7:] if authorization.startswith("Bearer ") else None
    # get_current_user has already validated the access token.  Decode again
    # only to read its jti/expiry for the shared denylist helper.
    auth_service.revoke_token(db, access_token)
    auth_service.revoke_token(db, refresh_token)
    try:
        audit_service.log_action(db, current_user, action="LOGOUT", resource_type="auth",
                                 resource_id=str(current_user.id))
        db.commit()
    except SQLAlchemyError:
        db.rollback()
    logger.info("User logged out (revocation applied where token presented)")
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    org_name = current_user.organization.name if current_user.organization else None
    authority = current_user.organization.authority_type if current_user.organization else None
    return UserOut(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        full_name=current_user.full_name,
        district=current_user.district,
        station=current_user.station,
        organization_id=current_user.organization_id,
        organization_name=org_name,
        authority_type=authority,
        designation=current_user.designation,
        jurisdiction=current_user.jurisdiction,
        scope_level=current_user.scope_level or "DISTRICT",
        is_active=current_user.is_active,
        role=current_user.role.name,
        created_at=current_user.created_at,
    )


@router.post("/register", response_model=UserOut, dependencies=[Depends(require_roles(ROLE_ADMIN))])
def register(payload: UserCreate, request: Request, db: Session = Depends(get_db)):
    user = auth_service.register_user(db, payload)  # enforces password policy
    try:
        audit_service.log_action(
            db, user, action="REGISTER", resource_type="auth", resource_id=str(user.id),
            details=f"role={payload.role_name}", ip_address=_client_ip(request),
        )
        db.commit()
    except SQLAlchemyError:
        db.rollback()
    return UserOut(
        id=user.id, username=user.username, email=user.email, full_name=user.full_name,
        district=user.district, station=user.station, is_active=user.is_active,
        role=payload.role_name, created_at=user.created_at,
    )


@router.put("/change-password")
def change_password(payload: ChangePasswordRequest, request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    auth_service.change_password(db, current_user, payload.old_password, payload.new_password)
    try:
        audit_service.log_action(db, current_user, action="PASSWORD_CHANGE", resource_type="auth",
                                 resource_id=str(current_user.id), ip_address=_client_ip(request))
        db.commit()
    except SQLAlchemyError:
        db.rollback()
    return {"message": "Password updated successfully"}


@router.patch("/profile", response_model=UserOut)
def update_profile(
    payload: UpdateProfileRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update mutable profile fields. Badge ID (username) and role are immutable."""
    changed: list[str] = []
    if payload.full_name is not None and payload.full_name != current_user.full_name:
        current_user.full_name = payload.full_name
        changed.append("full_name")
    if payload.email is not None and payload.email != current_user.email:
        existing = db.query(User).filter(User.email == payload.email, User.id != current_user.id).first()
        if existing:
            raise AppException("Email already in use.", code="EMAIL_TAKEN", status_code=409)
        current_user.email = payload.email
        changed.append("email")
    if payload.district is not None:
        current_user.district = payload.district or None
        changed.append("district")
    if payload.station is not None:
        current_user.station = payload.station or None
        changed.append("station")
    try:
        db.commit()
        db.refresh(current_user)
        if changed:
            audit_service.log_action(
                db, current_user, action="PROFILE_UPDATE", resource_type="auth",
                resource_id=str(current_user.id),
                details=f"updated={','.join(changed)}",
                ip_address=_client_ip(request),
            )
            db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        raise AppException("Failed to update profile.", code="DB_ERROR", status_code=500) from exc
    return UserOut(
        id=current_user.id, username=current_user.username, email=current_user.email,
        full_name=current_user.full_name, district=current_user.district,
        station=current_user.station, is_active=current_user.is_active,
        role=current_user.role.name, created_at=current_user.created_at,
    )


# ---------------------------------------------------------------------------
# Issue #118 — Face ID authentication (server-side biometric verification)
# ---------------------------------------------------------------------------
