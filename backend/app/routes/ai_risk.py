"""
SAKSHA – District Risk Prediction & Forecast API Router

Endpoints
---------
GET  /ai/predictions/risk-scores   – district risk scores (frontend already calls this)
POST /ai/predictions/risk-scores   – risk scores from submitted records
POST /ai/predictions/forecast      – crime count forecast from submitted records
POST /ai/predictions/train         – admin-triggered retrain (issue #145, gap 133.3)
GET  /ai/predictions/model-info    – model metadata
GET  /ai/predictions/refresh-status– staleness/auto-refresh status (issue #145)
GET  /ai/predictions/health        – liveness check

Delegates all ML logic to app.ai.inference.risk.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from app.ai.inference.risk import get_model_info, invalidate_caches, predict_forecast, predict_risk
from app.auth.dependencies import get_current_user
from app.auth.rbac import ALL_ROLES, ROLE_ADMIN, ROLE_CRIME_ANALYST, ROLE_INVESTIGATOR, require_roles
from app.database.postgres import get_db
from app.models.crime import CrimeCase
from app.models.user import User

router = APIRouter(prefix="/ai/predictions", tags=["District Risk Prediction"], dependencies=[Depends(require_roles(*ALL_ROLES))])


def _predict_filtered(records: list[dict], district_id: str | None) -> list[dict]:
    """Run district risk inference, optionally narrowing to a single district."""
    results = predict_risk(records)
    if district_id:
        results = [r for r in results if r["district"] == district_id]
    return results


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class RiskRecord(BaseModel):
    occurred_at: str
    district: str
    category: str
    model_config = {"extra": "allow"}

class RiskPredictRequest(BaseModel):
    records: list[RiskRecord] = Field(
        ..., min_length=1, description="Raw crime records with occurred_at, district, category."
    )
    
    @property
    def record_dicts(self) -> list[dict[str, Any]]:
        return [r.model_dump() for r in self.records]

class RiskScoreItem(BaseModel):
    district: str
    year_month: str
    risk_score: float
    predicted_crime_count: float
    risk_band: str
    confidence: float
    prediction_mode: str | None = "ML"
    top_factors: list[dict[str, Any]]
    resource_recommendation: str


class RiskScoresResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    district_id: str | None = None
    window: str
    model_version: str
    validation_status: str | None = None
    baseline_comparison: dict[str, Any] | None = None
    grid_predictions: list[dict[str, Any]]
    # Authoritative status metadata (issue 9) — additive, backward compatible.
    prediction_mode: str = "UNKNOWN"  # "ML" | "FALLBACK" | "UNKNOWN"
    risk_model_loaded: bool | None = None
    data_provenance: str = "LIVE_DB"  # recorded cases from the operational DB


class ForecastItem(BaseModel):
    district: str
    year_month: str
    predicted_crime_count: float
    lower_bound: float
    upper_bound: float
    trend: str
    prediction_mode: str | None = "ML"


class ForecastResponse(BaseModel):
    forecasts: list[ForecastItem]
    total: int
    prediction_mode: str = "ML"
    model_version: str | None = None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/risk-scores", response_model=RiskScoresResponse)
def get_risk_scores(
    window: str = Query(default="next_7d", description="Forecast window label"),
    district_id: str | None = Query(default=None, description="Filter by district"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return latest district risk scores based on crime records."""
    from app.auth.scope import enforce_district_scope
    district_id = enforce_district_scope(current_user, district_id, db)
    try:
        cases = db.query(CrimeCase).options(joinedload(CrimeCase.location), joinedload(CrimeCase.category)).all()
        from app.services.analytics_service import derive_data_provenance
        provenance = derive_data_provenance(cases)
        info = get_model_info()
        if not cases:
            return RiskScoresResponse(
                district_id=district_id,
                window=window,
                model_version=info.get("version", "untrained"),
                validation_status=info.get("validation_status", "INSUFFICIENT_DATA"),
                grid_predictions=[],
                prediction_mode="UNAVAILABLE",
                risk_model_loaded=bool(info.get("risk_model_loaded")),
                data_provenance=provenance,
            )

        records = [
            {
                "occurred_at": case.occurred_at.isoformat() if case.occurred_at else None,
                "district": case.location.district if case.location else "Unknown",
                "category": case.category.name if case.category else "Unknown",
            }
            for case in cases
        ]

        from app.services.ttl_cache import ttl_cached
        results = ttl_cached(
            "ai_risk.get_risk_scores",
            (window, district_id),
            ttl_seconds=60,
            compute=lambda: _predict_filtered(records, district_id),
            scope=db.bind,
        )

        pred_mode = results[0].get("prediction_mode", "ML") if results else info.get("prediction_mode", "FALLBACK")
        return RiskScoresResponse(
            district_id=district_id,
            window=window,
            model_version=info.get("version", "trained"),
            prediction_mode=pred_mode,
            validation_status=info.get("validation_status", "VALIDATED" if pred_mode == "ML" else "FALLBACK"),
            baseline_comparison=info.get("risk_baseline_comparison"),
            grid_predictions=results,
            risk_model_loaded=bool(info.get("risk_model_loaded")),
            data_provenance=provenance,
        )
    except Exception:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Risk prediction service unavailable.")


@router.post("/risk-scores", response_model=RiskScoresResponse, dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_CRIME_ANALYST, ROLE_INVESTIGATOR))])
def predict_risk_scores(
    payload: RiskPredictRequest,
    window: str = Query(default="next_7d"),
    current_user: User = Depends(get_current_user),
):
    """Compute district risk scores from submitted crime records."""
    try:
        results = predict_risk(payload.record_dicts)
    except Exception:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Risk score computation failed. Ensure records contain required fields.")

    info = get_model_info()
    pred_mode = results[0].get("prediction_mode", "ML") if results else info.get("prediction_mode", "FALLBACK")
    return RiskScoresResponse(
        district_id=None,
        window=window,
        model_version=info.get("version", "trained"),
        prediction_mode=pred_mode,
        validation_status=info.get("validation_status", "VALIDATED" if pred_mode == "ML" else "FALLBACK"),
        baseline_comparison=info.get("risk_baseline_comparison"),
        grid_predictions=results,
        risk_model_loaded=bool(info.get("risk_model_loaded")),
        data_provenance="UNKNOWN",
    )


@router.post("/forecast", response_model=ForecastResponse, dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_CRIME_ANALYST, ROLE_INVESTIGATOR))])
def predict_crime_forecast(
    payload: RiskPredictRequest,
    current_user: User = Depends(get_current_user),
):
    """Forecast next-month crime counts per district."""
    try:
        results = predict_forecast(payload.record_dicts)
    except Exception:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Forecast computation failed. Ensure records contain required fields.")
    info = get_model_info()
    pred_mode = results[0].get("prediction_mode", "ML") if results else info.get("prediction_mode", "FALLBACK")
    return ForecastResponse(
        forecasts=[ForecastItem(**r) for r in results],
        total=len(results),
        prediction_mode=pred_mode,
        model_version=info.get("version", "trained"),
    )


@router.post("/train", dependencies=[Depends(require_roles(ROLE_ADMIN))])
def train_risk_models(current_user: User = Depends(get_current_user)):
    """Retrain district risk + forecast models from live DB data (issue #145, gap 133.3).

    Documented previously but never implemented; now backed by
    app.ai.pipelines.risk.train.run_training with post-train cache invalidation.
    """
    from app.ai.inference.refresh import record_refresh_success
    from app.ai.pipelines.risk.train import run_training

    try:
        metrics = run_training()
    except ModuleNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Risk trainer dependency missing: {exc.name}",
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Risk training failed: {exc}")
    invalidate_caches()
    record_refresh_success("risk")
    return {"status": "ok", "retrained_by": current_user.username, "metrics": metrics}


@router.get("/refresh-status")
def risk_refresh_status(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Staleness + auto-refresh status for every model domain (issue #145)."""
    from app.ai.inference.refresh import get_refresh_status

    return get_refresh_status(db=db)


# CONTEXT.md documents POST /api/v2/ai/risk/train — expose that exact path
# as an alias of the /train implementation above (issue #145, gap 133.3).
alias_router = APIRouter(tags=["District Risk Prediction"], dependencies=[Depends(require_roles(ROLE_ADMIN))])


@alias_router.post("/ai/risk/train")
def train_risk_models_documented_path(current_user: User = Depends(get_current_user)):
    return train_risk_models(current_user)


@router.get("/model-info")
def risk_model_info(current_user: User = Depends(get_current_user)):
    try:
        return get_model_info()
    except Exception:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Risk model info unavailable.")


@router.get("/health")
def risk_health():
    try:
        info = get_model_info()
        return {
            "status": "ok",
            "risk_model": info.get("risk_model_loaded"),
            "forecast_model": info.get("forecast_model_loaded"),
            "version": info.get("version"),
        }
    except Exception:
        return {"status": "unavailable", "detail": "Models not loaded"}
