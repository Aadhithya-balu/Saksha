"""
Import every model here so SQLAlchemy's mapper registry is fully populated
before Base.metadata.create_all() or Alembic autogenerate runs.
"""
from app.models.role import Role
from app.models.user import User
from app.models.location import Location
from app.models.crime_category import CrimeCategory
from app.models.officer import Officer
from app.models.criminal import Criminal
from app.models.victim import Victim
from app.models.crime import CrimeCase
from app.models.fir import FIR, FIRCriminalLink, FIRVictimLink
from app.models.evidence import Evidence
from app.models.evidence_metadata import EvidenceMetadata
from app.models.evidence_timeline import EvidenceTimeline
from app.models.evidence_assignment import EvidenceAssignment
from app.models.chain_of_custody import ChainOfCustody
from app.models.evidence_ai_summary import EvidenceAISummary
from app.models.report import Report, ReportVersion, ReportSourceLink, ReportEvidenceLink
from app.models.audit_log import AuditLog
from app.models.notification import Notification
from app.models.investigation_note import InvestigationNote
from app.models.chat import ChatConversation, ChatMessage
from app.models.import_job import ImportJob, ImportStagedRecord
from app.models.intervention import Intervention
from app.models.mo_tag import MOTag, CaseMOTag, CriminalMOTag
from app.models.revoked_token import RevokedToken
from app.models.intelligence_report import IntelligenceReportRun
from app.models.identity import (
    IdentityRelationship,
    IdentityAlias,
    IdentityIdentifier,
    IdentityEvidence,
    IdentityConflict,
    IntegrityAlert,
    ProxyPattern,
    ProxyPatternEvidence,
)
from app.models.model_update import ModelUpdateJob
from app.models.face_identity import FaceIdentity
from app.models.ai_processing import AIProcessingJob, AIOcrResult, AIEntity, AIEvent, AIMatchRecord
from app.models.forensic_report import ForensicReport
from app.models.ai_candidates import AICandidateRecord
from app.models.knowledge_graph import KGNode, KGRelationship
from app.models.ingestion import DataSource, IngestionJob
from app.models.alert_finding import AlertFinding

__all__ = [
    "Role", "User", "Location", "CrimeCategory", "Officer", "Criminal",
    "Victim", "CrimeCase", "FIR", "FIRCriminalLink", "FIRVictimLink",
    "Evidence", "EvidenceMetadata", "EvidenceTimeline", "EvidenceAssignment",
    "ChainOfCustody", "EvidenceAISummary", "Report", "ReportVersion", "ReportSourceLink", "ReportEvidenceLink", "AuditLog",
    "Notification", "InvestigationNote", "ChatConversation", "ChatMessage",
    "ImportJob", "ImportStagedRecord", "Intervention", "MOTag", "CaseMOTag", "CriminalMOTag",
    "RevokedToken",
    "IntelligenceReportRun",
    "IdentityRelationship", "IdentityAlias", "IdentityIdentifier",
    "IdentityEvidence", "IdentityConflict", "IntegrityAlert",
    "ProxyPattern", "ProxyPatternEvidence",
    "ModelUpdateJob",
    "FaceIdentity",
    "AIProcessingJob", "AIOcrResult", "AIEntity", "AIEvent", "AIMatchRecord",
    "ForensicReport",
    "AICandidateRecord",
    "KGNode", "KGRelationship",
    "DataSource", "IngestionJob",
    "AlertFinding",
]

