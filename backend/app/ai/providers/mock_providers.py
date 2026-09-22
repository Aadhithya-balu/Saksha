from typing import List
from app.ai.providers.base import (
    OCRProvider, LLMProvider, VisionProvider, EmbeddingProvider, SpeechProvider,
    OcrResult, EntityExtractionResult, VisionEventResult
)

class MockOCRProvider(OCRProvider):
    async def process_document(self, document_bytes: bytes, filename: str) -> List[OcrResult]:
        # Return mock OCR results
        return [
            OcrResult(
                raw_text=f"Mock extracted text from {filename}. Includes John Doe and Case CR-001.",
                page_number=1,
                confidence=0.92,
                provider="mock_ocr"
            )
        ]

class MockLLMProvider(LLMProvider):
    async def extract_entities(self, text: str) -> List[EntityExtractionResult]:
        # Mock simple entity extraction
        return [
            EntityExtractionResult(
                entity_type="PERSON",
                attributes={"name": "John Doe", "gender": "Male"},
                confidence=0.88,
                extraction_method="mock_ner",
                provider="mock_llm"
            ),
            EntityExtractionResult(
                entity_type="CASE_NUMBER",
                attributes={"value": "CR-001"},
                confidence=0.99,
                extraction_method="mock_ner",
                provider="mock_llm"
            )
        ]

class MockVisionProvider(VisionProvider):
    async def process_media(self, media_bytes: bytes, filename: str) -> List[VisionEventResult]:
        return [
            VisionEventResult(
                event_type="PERSON_DETECTED",
                confidence=0.85,
                timestamp="00:00:10",
                provider="mock_vision"
            )
        ]

class MockEmbeddingProvider(EmbeddingProvider):
    async def generate_embedding(self, text: str) -> List[float]:
        return [0.1, 0.2, 0.3, 0.4, 0.5]

class MockSpeechProvider(SpeechProvider):
    async def process_audio(self, audio_bytes: bytes, filename: str) -> str:
        return "Mock transcribed text."
