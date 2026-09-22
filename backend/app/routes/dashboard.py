"""Dashboard aggregation routes backed by the crime database."""
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.rbac import ALL_ROLES, require_roles
from app.auth.scope import enforce_district_scope
from app.database.postgres import get_db
from app.models.user import User
from app.services.dashboard import dashboard_service
from app.services.ttl_cache import ttl_cached

router = APIRouter(prefix="/dashboard", tags=["Dashboard"], dependencies=[Depends(require_roles(*ALL_ROLES))])

# Dashboard analytics are expensive to recompute and are polled by the UI on a
# short interval. Cache them so repeated polls hit shared in-memory results
# instead of hammering Postgres (free-tier Supabase CPU throttling).
_TTL_FILTERED = 45
_TTL_STATIC = 60
_TTL_ML = 120


def _filter_key(
    date_from,
    date_to,
    district,
    category_id,
    officer_id,
    priority,
    status,
) -> tuple:
    return (date_from, date_to, district, category_id, officer_id, priority, status)


@router.get("/summary")
def summary(
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    district: str | None = None,
    category_id: str | None = None,
    officer_id: str | None = None,
    priority: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    district = enforce_district_scope(current_user, district, db)
    return ttl_cached(
        "dashboard:summary",
        _filter_key(date_from, date_to, district, category_id, officer_id, priority, status),
        _TTL_FILTERED,
        lambda: dashboard_service.get_filtered_summary(
            db,
            date_from=date_from,
            date_to=date_to,
            district=district,
            category_id=category_id,
            officer_id=officer_id,
            priority=priority,
            status=status,
        ),
        scope=db.get_bind(),
    )


@router.get("/crime-trends")
def crime_trends(
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    district: str | None = None,
    category_id: str | None = None,
    officer_id: str | None = None,
    priority: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    district = enforce_district_scope(current_user, district, db)
    return ttl_cached(
        "dashboard:crime-trends",
        _filter_key(date_from, date_to, district, category_id, officer_id, priority, status),
        _TTL_FILTERED,
        lambda: dashboard_service.get_filtered_trends(
            db,
            date_from=date_from,
            date_to=date_to,
            district=district,
            category_id=category_id,
            officer_id=officer_id,
            priority=priority,
            status=status,
        ),
        scope=db.get_bind(),
    )


@router.get("/category-breakdown")
def category_breakdown(
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    district: str | None = None,
    category_id: str | None = None,
    officer_id: str | None = None,
    priority: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    district = enforce_district_scope(current_user, district, db)
    return ttl_cached(
        "dashboard:category-breakdown",
        _filter_key(date_from, date_to, district, category_id, officer_id, priority, status),
        _TTL_FILTERED,
        lambda: dashboard_service.get_filtered_category_breakdown(
            db,
            date_from=date_from,
            date_to=date_to,
            district=district,
            category_id=category_id,
            officer_id=officer_id,
            priority=priority,
            status=status,
        ),
        scope=db.get_bind(),
    )


@router.get("/district-comparison")
def district_comparison(
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    district: str | None = None,
    category_id: str | None = None,
    officer_id: str | None = None,
    priority: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    district = enforce_district_scope(current_user, district, db)
    return ttl_cached(
        "dashboard:district-comparison",
        _filter_key(date_from, date_to, district, category_id, officer_id, priority, status),
        _TTL_FILTERED,
        lambda: dashboard_service.get_filtered_district_comparison(
            db,
            date_from=date_from,
            date_to=date_to,
            district=district,
            category_id=category_id,
            officer_id=officer_id,
            priority=priority,
            status=status,
        ),
        scope=db.get_bind(),
    )


@router.get("/officer-stats")
def officer_stats(
    district: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    district = enforce_district_scope(current_user, district, db)
    return ttl_cached(
        "dashboard:officer-stats",
        (district,),
        _TTL_STATIC,
        lambda: dashboard_service.get_officer_stats(db, district=district),
        scope=db.get_bind(),
    )


@router.get("/evidence-stats")
def evidence_stats(
    district: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    district = enforce_district_scope(current_user, district, db)
    return ttl_cached(
        "dashboard:evidence-stats",
        (district,),
        _TTL_STATIC,
        lambda: dashboard_service.get_evidence_stats(db, district=district),
        scope=db.get_bind(),
    )


@router.get("/recent-incidents")
def recent_incidents(
    district: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    district = enforce_district_scope(current_user, district, db)
    return ttl_cached(
        "dashboard:recent-incidents",
        (district,),
        20,
        lambda: dashboard_service.get_recent_incidents(db, district=district),
        scope=db.get_bind(),
    )


@router.get("/forecast")
def forecast(
    district: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    district = enforce_district_scope(current_user, district, db)
    return ttl_cached(
        "dashboard:forecast",
        (district,),
        _TTL_ML,
        lambda: dashboard_service.get_forecast_data(db, district=district),
        scope=db.get_bind(),
    )


@router.get("/risk-prediction")
def risk_prediction(
    district: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    district = enforce_district_scope(current_user, district, db)
    return ttl_cached(
        "dashboard:risk-prediction",
        (district,),
        _TTL_ML,
        lambda: dashboard_service.get_risk_prediction(db, district=district),
        scope=db.get_bind(),
    )


@router.get("/season-breakdown")
def season_breakdown(
    district: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    district = enforce_district_scope(current_user, district, db)
    return ttl_cached(
        "dashboard:season-breakdown",
        (district,),
        _TTL_ML,
        lambda: dashboard_service.get_season_breakdown(db, district=district),
        scope=db.get_bind(),
    )

