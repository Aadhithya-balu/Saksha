"""Phase 1 (issue #269): universal data ingestion package."""
from app.services.ingestion.ingestion_service import IngestionService, process_ingestion_job

__all__ = ["IngestionService", "process_ingestion_job"]