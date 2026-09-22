from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, List, Optional, Dict

@dataclass
class OcrResult:
    raw_text: str
    page_number: int
    confidence: float
    bounding_boxes: Optional[Dict[str, Any]] = None
    provider: str = ""

@dataclass
class EntityExtractionResult:
    entity_type: str
    attributes: Dict[str, Any]
    confidence: float
    extraction_method: str
    provider: str = ""

@dataclass
class VisionEventResult:
    event_type: str
    confidence: float
    timestamp: Optional[str] = None
    provider: str = ""

class OCRProvider(ABC):
    @abstractmethod
    async def process_document(self, document_bytes: bytes, filename: str) -> List[OcrResult]:
        """Extract text and layout from supported documents (PDF, image, etc.)"""
        pass

class LLMProvider(ABC):
    @abstractmethod
    async def extract_entities(self, text: str) -> List[EntityExtractionResult]:
        """Extract named entities (PERSON, LOCATION, etc) from text"""
        pass
    
class VisionProvider(ABC):
    @abstractmethod
    async def process_media(self, media_bytes: bytes, filename: str) -> List[VisionEventResult]:
        """Extract objects, tracking, and events from image/video"""
        pass

class EmbeddingProvider(ABC):
    @abstractmethod
    async def generate_embedding(self, text: str) -> List[float]:
        """Generate vector embedding for semantic search / RAG"""
        pass

class SpeechProvider(ABC):
    @abstractmethod
    async def process_audio(self, audio_bytes: bytes, filename: str) -> str:
        """Transcribe speech to text"""
        pass
