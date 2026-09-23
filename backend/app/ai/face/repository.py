"""Repository / storage abstraction for the face-recognition dataset.

Keeps the recognition *service* decoupled from how identity records and images
are stored, so an authorized production dataset can replace the bundled DEMO
dataset without touching the recognition logic. The demo records are seeded
into the ``face_identities`` table (metadata only) while the synthetic images
live under the fallback/local upload directory (never raw binaries in the DB).
"""
from __future__ import annotations

import os

from sqlalchemy.orm import Session

from app.ai.face import synthetic
from app.ai.face.local_engine import cosine_similarity, embedding_from_region
from app.core.logging_config import logger
from app.models.face_identity import FaceIdentity


class FaceRepositoryError(Exception):
    """Raised when the face dataset cannot be read or seeded."""


def ensure_seeded(db: Session) -> None:
    """Seed the DEMO identity rows and image set if not already present."""
    # Materialize synthetic images to disk (idempotent).
    try:
        root = synthetic.ensure_demo_dataset()
    except Exception as exc:  # pragma: no cover
        raise FaceRepositoryError(f"Cannot materialize demo dataset: {exc}") from exc

    existing = {r.demo_id: r for r in db.query(FaceIdentity).all()}
    for spec in synthetic.IDENTITIES:
        person_dir = os.path.join(root, spec.demo_id)
        images = [f for f in os.listdir(person_dir) if f.lower().endswith(".png")] if os.path.isdir(person_dir) else []
        rec = existing.get(spec.demo_id)
        if rec is None:
            rec = FaceIdentity(
                demo_id=spec.demo_id,
                display_name=spec.display_name,
                image_ref=os.path.join("face_demo_dataset", spec.demo_id),
                image_count=len(images),
                dataset_type="DEMO",
            )
            db.add(rec)
        else:
            rec.display_name = spec.display_name
            rec.image_ref = os.path.join("face_demo_dataset", spec.demo_id)
            rec.image_count = len(images)
            rec.dataset_type = "DEMO"
    db.commit()


def list_identities(db: Session) -> list[dict]:
    """Return DEMO identity metadata (never image paths) for the UI gallery."""
    rows = db.query(FaceIdentity).filter(FaceIdentity.dataset_type == "DEMO").order_by(FaceIdentity.demo_id).all()
    return [
        {
            "id": r.demo_id,
            "name": r.display_name,
            "dataset_type": r.dataset_type,
            "image_count": r.image_count,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


def _root() -> str:
    try:
        return synthetic.ensure_demo_dataset()
    except Exception as exc:  # pragma: no cover
        raise FaceRepositoryError(str(exc)) from exc


def list_sample_images(db: Session) -> list[dict]:
    """Return the demo image gallery (safe public reference values, no abs paths).

    Public reference uses a logical key (``DEMO-001/frontal``) that the route
    resolves via the demo constant map alias to an internal path — internal
    storage locations are never exposed to the client.
    """
    root = _root()
    out: list[dict] = []
    alias = {
        "frontal": "frontal",
        "left-angle": "left-angle",
        "right-angle": "right-angle",
        "pose": "pose",
        "expression": "expression",
    }
    for ident in list_identities(db):
        person_dir = os.path.join(root, ident["id"])
        if not os.path.isdir(person_dir):
            continue
        for fname in sorted(f for f in os.listdir(person_dir) if f.lower().endswith(".png")):
            logical = os.path.splitext(fname)[0]
            # Only expose well-known demo variations through the UI.
            alias_key = alias.get(logical)
            if alias_key is None:
                continue
            out.append(
                {
                    "id": ident["id"],
                    "name": ident["name"],
                    "image_ref": f"{ident['id']}/{logical}",
                    "variation": logical,
                }
            )
    return out


_DEMO_IDS = frozenset(spec.demo_id for spec in synthetic.IDENTITIES)


def resolve_image_bytes(ref: str) -> bytes | None:
    """Resolve a logical ref like ``DEMO-001/frontal`` to raw bytes (internal use).

    Confined to the bundled DEMO dataset: ``person`` must be one of the known
    demo identities and ``var`` is reduced to its file name, so a crafted ref
    (``..``, arbitrary dirs, etc.) can never read outside the demo image root.
    """
    root = _root()
    if "/" not in ref:
        return None
    person, var = ref.split("/", 1)
    if person not in _DEMO_IDS:
        return None
    var = var.replace("\\", "/").split("/")[-1]
    if not var:
        return None
    path = os.path.join(root, person, f"{var}.png")
    if not os.path.isfile(path):
        return None
    with open(path, "rb") as fh:
        return fh.read()


def image_embedding_for(ref: str):
    """Return the primary-face embedding for a stored sample, or None."""
    data = resolve_image_bytes(ref)
    if data is None:
        return None
    from app.ai.face import local_engine

    count, faces = local_engine.detect_faces(data)
    if count == 0 or not faces:
        return None
    return embedding_from_region(faces[0]["region_gray"])


def reference_embeddings(db: Session) -> list[dict]:
    """Precompute embeddings per identity by scanning its stored sample images."""
    return reference_embeddings_from_disk()


def reference_embeddings_from_disk() -> list[dict]:
    """Scan the on-disk DEMO images and build reference embeddings per identity.

    DB-independent so pure matching still works before/without seeding the table.
    """
    root = _root()
    refs: list[dict] = []
    for spec in synthetic.IDENTITIES:
        person_dir = os.path.join(root, spec.demo_id)
        if not os.path.isdir(person_dir):
            continue
        embeds: list = []
        for fname in sorted(f for f in os.listdir(person_dir) if f.lower().endswith(".png")):
            with open(os.path.join(person_dir, fname), "rb") as fh:
                data = fh.read()
            count, faces = _detect(data)
            if count == 0 or not faces:
                continue
            embeds.append(embedding_from_region(faces[0]["region_gray"]))
        if embeds:
            refs.append({"id": spec.demo_id, "name": spec.display_name, "embeddings": embeds})
    return refs


def _detect(data: bytes):
    from app.ai.face import local_engine

    return local_engine.detect_faces(data)


def match_best(query_embedding, references: list[dict]) -> tuple[dict | None, float]:
    """Return (best_identity, score) using max similarity across a person's images."""
    best = None
    best_score = 0.0
    for ref in references:
        score = max((cosine_similarity(query_embedding, e) for e in ref["embeddings"]), default=0.0)
        if score > best_score:
            best_score = score
            best = ref
    return (best, best_score)
