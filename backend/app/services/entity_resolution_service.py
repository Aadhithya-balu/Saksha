import uuid
from typing import List, Optional
from sqlalchemy.orm import Session
from datetime import datetime

from app.models.ai_processing import AIEntity, AIMatchRecord
from app.models.criminal import Criminal
from app.models.identity import IdentityRelationship, REL_SAME_PERSON_POSSIBLE

class EntityResolutionService:
    @staticmethod
    def generate_candidates(db: Session, ai_entity_id: uuid.UUID) -> List[AIMatchRecord]:
        ai_entity = db.query(AIEntity).filter(AIEntity.id == ai_entity_id).first()
        if not ai_entity or ai_entity.entity_type != "PERSON":
            return []
            
        # Basic mock candidate generation for demonstration
        candidates = []
        name = ai_entity.attributes.get("name")
        if not name:
            return []
            
        criminals = db.query(Criminal).filter(Criminal.full_name.ilike(f"%{name}%")).limit(5).all()
        for c in criminals:
            match = AIMatchRecord(
                candidate_ai_entity_id=ai_entity.id,
                source_entity_type="criminal",
                source_entity_id=c.id,
                match_score=0.85, # Mock score
                matching_attributes={"name": name, "matched_with": c.full_name},
                status="PENDING"
            )
            db.add(match)
            candidates.append(match)
            
        db.commit()
        return candidates

    @staticmethod
    def list_pending_matches(db: Session, limit: int = 50) -> List[AIMatchRecord]:
        return db.query(AIMatchRecord).filter(AIMatchRecord.status == "PENDING").limit(limit).all()

    @staticmethod
    def verify_match(db: Session, match_id: uuid.UUID, decision: str, user_id: uuid.UUID) -> Optional[AIMatchRecord]:
        match = db.query(AIMatchRecord).filter(AIMatchRecord.id == match_id).first()
        if not match:
            return None
            
        if decision == "CONFIRM":
            match.status = "CONFIRMED"
            if match.candidate_ai_entity:
                match.candidate_ai_entity.verification_status = "CONFIRMED"
            
            rel = IdentityRelationship(
                source_entity_type=match.source_entity_type,
                source_entity_id=match.source_entity_id,
                target_entity_type="ai_entity",
                target_entity_id=match.candidate_ai_entity_id,
                relationship_type=REL_SAME_PERSON_POSSIBLE,
                assessment="CONFIRMED_BY_INVESTIGATOR",
                confidence=match.match_score,
                status="confirmed_same",
                reviewed_by_id=user_id,
                reviewed_at=datetime.utcnow()
            )
            db.add(rel)
            
        elif decision == "REJECT":
            match.status = "REJECTED"
        
        match.reviewed_by_id = user_id
        match.reviewed_at = datetime.utcnow()
        db.commit()
        db.refresh(match)
        return match
