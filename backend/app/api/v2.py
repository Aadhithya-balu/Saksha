"""
API v2 router aggregator.
All module routers are mounted here under settings.API_V2_PREFIX,
giving a clean path for future v3 versioning without touching main.py.
"""
from fastapi import APIRouter

from app.routes import (
    admin,
    auth,
    crimes,
    criminals,
    dashboard,
    evidence,
    firs,
    investigation,
    locations,
    notifications,
    officers,
    realtime,
    reports,
    users,
    victims,
    crime_cases,
)

# AI/ML routes — heavy imports (numpy, pandas, sklearn, etc.) are deferred
# inside each module to avoid blocking startup.
from app.routes import (
    ai_support,
    ai_chat,
    ai_chat_history,
    ai_chat_evaluation,
    ai_anomaly,
    ai_criminal,
    ai_hotspot,
    ai_risk,
    ai_mo,
    network,
    sociological,
    strategic,
)

# Gap-closure modules (issue #139): legacy ingestion, victimology, interventions
from app.routes import (
    data_import,
    interventions,
    victimology,
)

# Issue #146: station drill-down + red-zone spike alerts
from app.routes import (
    alerts,
    stations,
)

# Issue #162: system data-mode and provenance endpoint
from app.routes import system

# Issue #200: officer-centric investigation hub
from app.routes import investigation_hub

# Issue #225: identity resolution + proxy detection + data integrity engine
from app.routes import identity

# Issue #228: isolated face recognition (DEMO enhancement)
from app.routes import face_recognition

# Intelligence Engine: unified investigation intelligence builder
from app.routes import intelligence

# Unified model management (continuous retraining, versioning, status)
from app.routes import model_management

# AI Processing (Phase 2)
from app.routes import ai_processing


api_router = APIRouter()

# Core routes
api_router.include_router(auth.router)
api_router.include_router(admin.router)
api_router.include_router(users.router)
api_router.include_router(dashboard.router)
api_router.include_router(crimes.router)
api_router.include_router(firs.router)
api_router.include_router(criminals.router)
api_router.include_router(victims.router)
api_router.include_router(officers.router)
api_router.include_router(evidence.router)
api_router.include_router(locations.router)
api_router.include_router(reports.router)
api_router.include_router(crime_cases.router)
api_router.include_router(realtime.router)
api_router.include_router(investigation.router)
api_router.include_router(notifications.router)

# AI/ML routes (heavy imports deferred inside each module)
api_router.include_router(ai_support.router)
api_router.include_router(ai_chat.router)
api_router.include_router(ai_chat_history.router)
api_router.include_router(ai_chat_evaluation.router)
api_router.include_router(ai_anomaly.router)
api_router.include_router(ai_criminal.router)
api_router.include_router(ai_hotspot.router)
api_router.include_router(ai_risk.router)
api_router.include_router(ai_risk.alias_router)
api_router.include_router(network.router)
api_router.include_router(sociological.router)
api_router.include_router(strategic.router)

# Gap-closure modules (issue #139)
api_router.include_router(data_import.router)
api_router.include_router(victimology.router)
api_router.include_router(ai_mo.router)
api_router.include_router(interventions.router)

# Issue #146: station drill-down + red-zone spike alerts
api_router.include_router(stations.router)
api_router.include_router(alerts.router)

# Issue #162: system data-mode and provenance endpoint
api_router.include_router(system.router)

# Issue #200: officer-centric investigation hub
api_router.include_router(investigation_hub.router)

# Issue #225: identity resolution + proxy detection + data integrity engine
api_router.include_router(identity.router)

# Issue #228: isolated face recognition (DEMO enhancement)
api_router.include_router(face_recognition.router)
api_router.include_router(face_recognition._public_router)

# Intelligence Engine: unified investigation intelligence builder
api_router.include_router(intelligence.router)

# Unified model management (continuous retraining, versioning, status)
api_router.include_router(model_management.router)

# AI Processing (Phase 2)
api_router.include_router(ai_processing.router)
