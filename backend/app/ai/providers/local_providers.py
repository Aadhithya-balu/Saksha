"""Deterministic, honest local providers for the Phase 2 AI pipeline.

These replace the placeholder ``Mock*Provider`` classes where local
signal exists:

* ``LocalTextOCRProvider`` — real PDF/DOCX/TXT text extraction (PyPDF2,
  python-docx); deterministic, no external models.
* ``RuleBasedNERProvider`` — gazetteer + regex named-entity extraction reusing
  the MO semantic extractor; never fabricates entities.
* ``OpenCVVisionProvider`` — Haar-cascade face detection on images and a
  lightweight scene-change pass on video; returns *no* events when nothing is
  found, so downstream review surfaces never show invented detections.

Nothing here calls hosted models. Hosted-LLM integration remains opt-in via the
existing provider ABCs; when it is absent these local providers are used and the
results are labelled with the actual provider name.
"""
import os
import tempfile
from pathlib import Path
from typing import List

try:
    import cv2
except ImportError:
    cv2 = None
import numpy as np

from app.ai.providers.base import (
    EntityExtractionResult,
    LLMProvider,
    OCRProvider,
    OcrResult,
    VisionEventResult,
    VisionProvider,
)

_REVIEWABLE_ENTITY_TYPES = {"PERSON", "VEHICLE", "PHONE_NUMBER", "CONTROLLED_SUBSTANCE"}


class LocalTextOCRProvider(OCRProvider):
    """Extract text from PDF/DOCX/TXT artifacts using the shared extractors."""

    async def process_document(self, document_bytes: bytes, filename: str) -> List[OcrResult]:
        ext = Path(filename or "doc.bin").suffix.lower()
        if ext in (".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"):
            # Image OCR requires tesseract (not installed) — return nothing
            # rather than fabricating text.
            return []

        from app.services.ingestion.extractors import extract_for_kind

        tmp_dir = Path(tempfile.mkdtemp(prefix="saksha-ocr-"))
        try:
            tmp_path = tmp_dir / f"artifact{ext or '.txt'}"
            tmp_path.write_bytes(document_bytes)
            result = extract_for_kind("document", tmp_path, filename or "artifact")
        finally:
            try:
                tmp_dir.unlink(missing_ok=True) if hasattr(tmp_dir, "unlink") else None
            except Exception:  # noqa: BLE001
                pass

        text = (result.normalized_payload or {}).get("text", "")
        if not text.strip():
            return []
        pages = (result.normalized_payload or {}).get("pages") or [text]
        return [
            OcrResult(
                raw_text=page,
                page_number=i + 1,
                confidence=0.97,  # deterministic extraction — not a model score
                provider="local_text_ocr",
            )
            for i, page in enumerate(pages)
        ]


class RuleBasedNERProvider(LLMProvider):
    """Gazetteer + regex entity extraction (mo_semantic_service)."""

    _ENTITY_MAP = {
        "person_names": "PERSON",
        "vehicle_plates": "VEHICLE",
        "phone_numbers": "PHONE_NUMBER",
        "money_amounts": "MONEY",
        "dates": "DATE",
        "times": "TIME",
        "weapons": "WEAPON",
        "controlled_substances": "CONTROLLED_SUBSTANCE",
        "places": "PLACE",
    }
    _GAZETTEER_TYPES = {"weapons", "controlled_substances", "places"}

    async def extract_entities(self, text: str) -> List[EntityExtractionResult]:
        from app.services.mo_semantic_service import extract_entities as run_extract

        if not (text or "").strip():
            return []
        extracted = run_extract(text)
        entities: List[EntityExtractionResult] = []
        for key, values in (extracted.get("entities") or {}).items():
            entity_type = self._ENTITY_MAP.get(key)
            if not entity_type or not values:
                continue
            confidence = 0.7 if key in self._GAZETTEER_TYPES else 0.85
            for value in values:
                entities.append(
                    EntityExtractionResult(
                        entity_type=entity_type,
                        attributes={"value": value} if entity_type != "PERSON" else {"name": value},
                        confidence=confidence,
                        extraction_method=extracted.get("method", "rule_based_regex+gazetteer"),
                        provider="rule_based_ner",
                    )
                )
        return entities


class OpenCVVisionProvider(VisionProvider):
    """Haar face detection (images) + scene-change pass (video)."""

    _FACE_CASCADE = None

    @classmethod
    def _face_cascade(cls):
        if cv2 is None:
            return None
        if cls._FACE_CASCADE is None:
            cascade_path = os.path.join(cv2.data.haarcascades, "haarcascade_frontalface_default.xml")
            cls._FACE_CASCADE = cv2.CascadeClassifier(cascade_path)
        return cls._FACE_CASCADE

    async def process_media(self, media_bytes: bytes, filename: str) -> List[VisionEventResult]:
        if not media_bytes:
            return []
        try:
            ext = Path(filename or "media.bin").suffix.lower()
            if ext in (".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"):
                return self._detect_faces(media_bytes)
            if ext in (".mp4", ".mkv", ".mov", ".avi", ".webm"):
                return self._detect_scenes(media_bytes)
        except Exception:  # noqa: BLE001 — detection is best-effort
            return []
        return []

    def _detect_faces(self, image_bytes: bytes) -> List[VisionEventResult]:
        if cv2 is None or self._face_cascade() is None:
            return []
        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            return []
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = self._face_cascade().detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(40, 40))
        if len(faces) == 0:
            return []
        # Confidence is bounded by detection strength; per-face boxes omitted.
        confidence = min(0.9, 0.65 + 0.05 * len(faces))
        return [
            VisionEventResult(
                event_type="PERSON_DETECTED",
                confidence=round(confidence, 3),
                timestamp="frame-0",
                provider="opencv_haar",
            )
        ]

    def _detect_scenes(self, video_bytes: bytes) -> List[VisionEventResult]:
        if cv2 is None:
            return []
        tmp_dir = Path(tempfile.mkdtemp(prefix="saksha-vision-"))
        events: List[VisionEventResult] = []
        try:
            tmp_path = tmp_dir / "clip.mp4"
            tmp_path.write_bytes(video_bytes)
            cap = cv2.VideoCapture(str(tmp_path))
            if not cap.isOpened():
                return []
            prev_frame = None
            frame_index = 0
            scene_count = 0
            while frame_index < 60:
                ok, frame = cap.read()
                if not ok:
                    break
                if frame_index % 5 == 1 and prev_frame is not None:
                    diff = cv2.absdiff(cv2.resize(prev_frame, (80, 45)), cv2.resize(frame, (80, 45)))
                    mean_diff = float(diff.mean())
                    if mean_diff > 18.0:  # significant visual discontinuity
                        scene_count += 1
                        events.append(
                            VisionEventResult(
                                event_type="SCENE_CHANGE",
                                confidence=round(min(0.9, 0.6 + mean_diff / 250.0), 3),
                                timestamp=f"{frame_index // 5}",
                                provider="opencv_scene_diff",
                            )
                        )
                prev_frame = frame
                frame_index += 1
            cap.release()
            return events
        except Exception:  # noqa: BLE001
            return []
        finally:
            try:
                if hasattr(tmp_dir, "unlink"):
                    tmp_dir.unlink(missing_ok=True)
            except Exception:  # noqa: BLE001
                pass


def should_require_review(entities: List[EntityExtractionResult]) -> bool:
    """Entities tied to identity carry review burden (never auto-confirmed).

    Per the bare-metal rules, AI-proposed identity findings always need a human
    decision. We require review when a PERSON / VEHICLE / phone / substance is
    proposed from unstructured text.
    """
    return any(e.entity_type in _REVIEWABLE_ENTITY_TYPES for e in entities)


__all__ = [
    "LocalTextOCRProvider",
    "RuleBasedNERProvider",
    "OpenCVVisionProvider",
    "should_require_review",
]