import uuid
from sqlalchemy import JSON, Float, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.postgres import Base
from app.models.mixins import TimestampMixin, UUIDPKMixin


class KGNode(Base, UUIDPKMixin, TimestampMixin):
    """Knowledge-graph vertex, pointing at a real record (criminal, victim,
    crime case, FIR, location) or an extracted entity candidate.

    ``ref_type``/``ref_id`` address the underlying record; nodes are unique per
    ref so the graph is idempotently rebuildable from the authoritative tables.
    """
    __tablename__ = "kg_nodes"
    __table_args__ = (
        Index("ix_kg_node_ref", "ref_type", "ref_id", unique=True),
        Index("ix_kg_node_type", "node_type"),
    )

    node_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # CRIMINAL | VICTIM | CASE | FIR | LOCATION | VEHICLE
    ref_type: Mapped[str] = mapped_column(String(50), nullable=False)
    ref_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)

    label: Mapped[str] = mapped_column(String(300), nullable=False)
    attributes: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    # Districts this node belongs to (case: its location's district; a person:
    # the union across their linked cases). Used for district scoping.
    districts: Mapped[list] = mapped_column(JSON, nullable=False, default=list)

    status: Mapped[str] = mapped_column(String(30), default="ACTIVE", nullable=False, index=True)
    provenance: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    source_edges: Mapped[list["KGRelationship"]] = relationship(
        back_populates="source_node", foreign_keys="KGRelationship.source_node_id",
        cascade="all, delete-orphan",
    )
    target_edges: Mapped[list["KGRelationship"]] = relationship(
        back_populates="target_node", foreign_keys="KGRelationship.target_node_id",
        cascade="all, delete-orphan",
    )


class KGRelationship(Base, UUIDPKMixin, TimestampMixin):
    """Knowledge-graph edge.

    ``direction`` distinguishes attested links (DIRECT — expressed in the source
    data, e.g. FIR accused link) from inferred ones (DERIVED — shared FIR,
    shared location, proposed identity), which must carry a lower strength and
    an explicit ``basis`` so consumers never treat inference as fact.
    """
    __tablename__ = "kg_relationships"
    __table_args__ = (
        Index("ix_kg_rel_pair", "source_node_id", "target_node_id"),
        Index("ix_kg_rel_type", "relationship_type"),
    )

    source_node_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kg_nodes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    source_node: Mapped["KGNode"] = relationship(
        back_populates="source_edges", foreign_keys="KGRelationship.source_node_id"
    )
    target_node_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kg_nodes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    target_node: Mapped["KGNode"] = relationship(
        back_populates="target_edges", foreign_keys="KGRelationship.target_node_id"
    )

    relationship_type: Mapped[str] = mapped_column(String(80), nullable=False)
    direction: Mapped[str] = mapped_column(String(20), nullable=False, index=True)  # DIRECT | DERIVED
    strength: Mapped[float] = mapped_column(Float, default=0.5)
    basis: Mapped[str | None] = mapped_column(String(200), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="ACTIVE", nullable=False, index=True)
    provenance: Mapped[dict | None] = mapped_column(JSON, nullable=True)