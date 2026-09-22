"""Sociological Insights routes — demographic, geographic, and socio-economic crime analysis."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.rbac import ALL_ROLES, require_roles
from app.database.postgres import get_db
from app.models.user import User
from app.services import sociological_service
from app.services.ttl_cache import ttl_cached

router = APIRouter(prefix="/sociological", tags=["Sociological Insights"], dependencies=[Depends(require_roles(*ALL_ROLES))])


@router.get("/dataset-info")
def socioeconomic_dataset_info(current_user: User = Depends(get_current_user)):
    """Provenance of the versioned socio-economic dataset backing this module."""
    from app.services.sociological_service import dataset_info

    return dataset_info()


@router.get("/data-quality")
def socioeconomic_data_quality(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Coverage + district-mapping validation for the socio-economic pipeline.

    Reports which districts each indicator covers, how records map to SAKSHA
    districts, per-record period/completeness, and explicit limitations —
    all computed live (issue 7 §3-§7).
    """
    return sociological_service.get_data_quality_report(db)


@router.get("/demographics")
def get_demographics(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Crime distribution by victim age groups and gender demographics."""
    return sociological_service.get_demographic_analysis(db)


@router.get("/urban-rural")
def get_urban_rural(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Crime distribution by urban vs rural classification with population density."""
    return sociological_service.get_urban_rural_analysis(db)


@router.get("/socioeconomic")
def get_socioeconomic(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Crime correlation with socio-economic indicators by district."""
    return sociological_service.get_socioeconomic_overlay(db)


@router.get("/population-correlation")
def get_population_correlation(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Crime rate vs population density scatter data."""
    return sociological_service.get_population_crime_correlation(db)


@router.get("/temporal-demographics")
def get_temporal_demographics(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Crime by hour of day, day of week, and monthly patterns."""
    return ttl_cached(
        "sociological:temporal-demographics",
        (),
        60,
        lambda: sociological_service.get_temporal_demographic_analysis(db),
        scope=db.get_bind(),
    )


@router.get("/temporal-matrix")
def get_temporal_matrix(
    district: str | None = None,
    location_id: str | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Hour x day-of-week incident matrix with optional district/station filter.

    Closes issue #143 gap 131.3: true observed cross-tabulation (no synthetic
    baseline) with statistically flagged peak cells for patrol planning.
    """
    from app.auth.scope import enforce_district_scope, is_multi_district
    effective_district = enforce_district_scope(current_user, district, db)
    if effective_district and not is_multi_district(current_user):
        district = effective_district
    return ttl_cached(
        "sociological:temporal-matrix",
        (district, location_id),
        90,
        lambda: sociological_service.get_temporal_hotspot_matrix(db, district=district, location_id=location_id),
        scope=db.get_bind(),
    )


@router.get("/offender-demographics")
def get_offender_demographics(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Criminal offender demographic analysis (age, gender, status)."""
    return sociological_service.get_offender_demographics(db)
