"""Anomaly detection endpoints.

This router is intentionally minimal and only supports real-time anomaly detection
+ alert generation for incoming event batches.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth.dependencies import get_current_user
from app.auth.rbac import ALL_ROLES, ROLE_ADMIN, ROLE_CRIME_ANALYST, ROLE_INVESTIGATOR, require_roles
from app.models.user import User

from app.ai.inference.anomaly import run_anomaly_inference

router = APIRouter(prefix="/ai", tags=["Crime Anomaly Detection"], dependencies=[Depends(require_roles(*ALL_ROLES))])


class AnomalyDetectRequest(BaseModel):
    model_config = {"protected_namespaces": ()}
    # Each event is a best-effort dictionary with keys consumed by feature engineering.
    # The backend will tolerate missing keys.
    events: list[dict[str, Any]] = Field(default_factory=list)
    model_path: str | None = None


class AnomalyAlertItem(BaseModel):
    event_id: str | None
    is_anomaly: bool
    score: float
    threshold: float
    explanation: dict[str, Any]


class AnomalyDetectResponse(BaseModel):
    alerts: list[AnomalyAlertItem]


@router.post(
    "/anomaly/detect",
    response_model=AnomalyDetectResponse,
    dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_CRIME_ANALYST, ROLE_INVESTIGATOR))],
)
def detect_anomalies(
    payload: AnomalyDetectRequest,
    current_user: User = Depends(get_current_user),
):
    import logging
    logger = logging.getLogger(__name__)
    try:
        model_path = None
        if payload.model_path:
            from pathlib import Path as _Path
            resolved = _Path(payload.model_path).resolve()
            # Confine reads to this deployment's model store so a crafted path
            # can never point at arbitrary JSON files elsewhere on disk.
            models_root = _Path(__file__).resolve().parents[1] / "models"
            try:
                resolved.relative_to(models_root)
            except ValueError:
                raise HTTPException(status_code=400, detail="model_path must point inside this deployment's model store")
            if not str(resolved).endswith(".json"):
                raise HTTPException(status_code=400, detail="model_path must reference a .json model file")
            model_path = str(resolved)
        alerts = run_anomaly_inference(payload.events, model_path=model_path)
        return AnomalyDetectResponse(alerts=alerts)
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("Anomaly detection failed: %s", exc)
        raise HTTPException(status_code=500, detail="Anomaly detection service temporarily unavailable")
