"""Generate a Catalyst Data Store schema manifest from the Saksha ORM.

Outputs:
  schema/catalyst_schema_manifest.json   - machine-readable per-table column spec
  schema/catalyst_schema_manifest.md     - human-readable console creation guide

The manifest is derived directly from SQLAlchemy metadata so it cannot drift
from the application schema. Catalyst system columns (ROWID, CREATORID,
CREATEDTIME, MODIFIEDTIME) are auto-added by Catalyst and intentionally omitted.

Mapping rules (Catalyst Data Store data types):
  String(n<=255) -> varchar(n)   | String(n>255) -> text(10000)
  Text           -> text(10000)  | UUID -> varchar(36)
  Integer        -> int          | BigInteger -> bigint
  Float/Numeric  -> double       | Boolean -> boolean
  Date           -> date         | DateTime -> datetime | Time -> time
  JSON/JSONB     -> text         | else -> text (flagged in notes)
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[2] / "backend"
HERE = Path(__file__).resolve().parent
SCHEMA_DIR = HERE / "schema"

os.environ.setdefault("DATABASE_URL", "sqlite:///./migration_source.db")
os.environ.setdefault("SAKSHA_DATA_MODE", "demo")
os.environ.setdefault("APP_ENV", "development")

sys.path.insert(0, str(BACKEND))

import sqlalchemy.types as sat
from sqlalchemy import ForeignKey, MetaData, Table, Column

from app.database.postgres import Base
import app.models  # noqa: F401  (populates Base.metadata with all ORM tables)

# ---------------------------------------------------------------------------
# Two app tables are declared inline in a route module and are NOT part of
# app.models' __init__. They are registered here so every app table is
# covered by the manifest without importing the heavy admin route module.
# (Sources: backend/app/routes/admin.py lines 52-70)
# ---------------------------------------------------------------------------
_extra_meta = MetaData()
Table(
    "system_settings",
    _extra_meta,
    Column("id", sat.String(36), primary_key=True),
    Column("key", sat.String(100), nullable=False),
    Column("value", sat.Text),
    Column("description", sat.String(500)),
    Column("created_at", sat.DateTime),
    Column("updated_at", sat.DateTime),
)
Table(
    "role_permissions",
    _extra_meta,
    Column("id", sat.String(36), primary_key=True),
    Column("role_id", sat.String(36), ForeignKey("roles.id"), nullable=False, index=True),
    Column("permission", sat.String(100), nullable=False, index=True),
    Column("resource", sat.String(100), nullable=False),
    Column("created_at", sat.DateTime),
)
# Reference table loaded by sociological_service from
# backend/data/socioeconomic/karnataka_socioeconomic_indicators.csv
Table(
    "socioeconomic_indicators",
    _extra_meta,
    Column("district", sat.String(50), primary_key=True),
    Column("population_lakhs", sat.Float),
    Column("area_sq_km", sat.Float),
    Column("literacy_rate", sat.Float),
    Column("sex_ratio", sat.Float),
    Column("avg_income_lakhs", sat.Float),
    Column("unemployment_rate", sat.Float),
    Column("urbanization_type", sat.String(20)),
    Column("urbanization_share_pct", sat.Float),
    Column("data_year", sat.Integer),
)

# ---------------------------------------------------------------------------
CATALYST_MAX_VARCHAR = 255
CATALYST_MAX_TEXT = 10000


def map_type(col) -> dict:
    ctype = col.type
    notes: list[str] = []
    base = ctype

    # unwrap variance like Enum etc.; keep it simple
    cat = "text"
    max_len = CATALYST_MAX_TEXT

    if isinstance(ctype, sat.String):
        length = ctype.length
        if length is not None and 0 < int(length) <= CATALYST_MAX_VARCHAR:
            cat = "varchar"
            max_len = int(length)
        else:
            cat = "text"
            max_len = CATALYST_MAX_TEXT
            notes.append(f"app String({length}) > {CATALYST_MAX_VARCHAR} -> text")
    elif isinstance(ctype, sat.Text):
        cat, max_len = "text", CATALYST_MAX_TEXT
    elif isinstance(ctype, (sat.UUID, getattr(sat, "Uuid", ()))):
        cat, max_len = "varchar", 36
        notes.append("UUID stored as varchar(36)")
    elif isinstance(ctype, sat.BigInteger):
        cat, max_len = "bigint", 19
    elif isinstance(ctype, sat.Integer):
        cat, max_len = "int", 10
    elif isinstance(ctype, sat.Float):
        cat, max_len = "double", 17
    elif isinstance(ctype, sat.Numeric):
        cat, max_len = "double", 17
        notes.append("Numeric/Decimal -> double")
    elif isinstance(ctype, sat.Boolean):
        cat, max_len = "boolean", 0
    elif isinstance(ctype, sat.Date):
        cat, max_len = "date", 0
    elif isinstance(ctype, sat.DateTime):
        cat, max_len = "datetime", 0
    elif isinstance(ctype, sat.Time):
        cat, max_len = "time", 0
    elif isinstance(ctype, sat.JSON):
        cat, max_len = "text", CATALYST_MAX_TEXT
        notes.append("JSON/JSONB stored as text")
    else:
        notes.append(f"unmapped app type {base!r} -> text")

    return {
        "name": col.name,
        "app_type": str(base),
        "catalyst_type": cat,
        "catalyst_max_length": max_len,
        "mandatory": not bool(col.nullable),
        "unique": bool(col.unique),
        "primary_key": bool(col.primary_key),
        "foreign_key": None,
        "default": None if col.default is None else str(col.default.arg)
        if hasattr(col.default, "arg") else str(col.default),
        "notes": notes,
    }


def collect_table(name: str, table) -> dict:
    fks = {}
    for fk in table.foreign_keys:
        fks[fk.parent.name] = str(fk.target_fullname)

    columns = []
    for col in table.columns:
        spec = map_type(col)
        if col.name in fks:
            spec["foreign_key"] = fks[col.name]
        spec["indexed_in_app"] = any(col.name in [c.name for c in i.columns] for i in table.indexes) or col.primary_key
        columns.append(spec)

    unique_constraints = sorted(
        {tuple(_c.name for _c in uc.columns) for uc in table.constraints if uc.__class__.__name__ == "UniqueConstraint"}
    )
    indexes = sorted(
        {
            (i.name, tuple(_c.name for _c in i.columns))
            for i in table.indexes
        }
    )
    return {
        "table": name,
        "app_table": True,
        "rowid_needs_import": False,
        "columns": columns,
        "unique_constraints": [list(u) for u in unique_constraints],
        "indexes": [[n, list(cols)] for n, cols in indexes] if indexes else [],
    }


def main() -> None:
    SCHEMA_DIR.mkdir(parents=True, exist_ok=True)

    tables: dict[str, dict] = {}
    for name, table in Base.metadata.tables.items():
        tables[name] = collect_table(name, table)
    for name, table in _extra_meta.tables.items():
        tables[name] = collect_table(name, table)

    # deterministic, dependency-sorted-ish order
    order = [
        "roles", "crime_categories", "locations", "system_settings",
        "users", "officers", "criminals", "victims",
        "crime_cases", "firs", "fir_criminal_links", "fir_victim_links",
        "evidence", "evidence_metadata", "evidence_timeline", "evidence_assignments",
        "chain_of_custody", "evidence_ai_summary",
        "reports", "report_versions", "report_source_links", "report_evidence_links",
        "audit_logs", "notifications", "investigation_notes",
        "chat_conversations", "chat_messages",
        "import_jobs", "import_staging_records",
        "interventions", "mo_tags", "case_mo_tags", "criminal_mo_tags", "revoked_tokens",
        "socioeconomic_indicators",
    ]
    manifest = {
        "project": "Datathon-1",
        "project_id": "49978000000018001",
        "environment": "Development",
        "generated_by": "scripts/migration/generate_catalyst_schema.py",
        "source_of_truth": "SQLAlchemy metadata (backend/app/models/*.py + backend/app/routes/admin.py)",
        "note": "Catalyst auto-adds ROWID/CREATORID/CREATEDTIME/MODIFIEDTIME; they are omitted here. Tables/columns are created in the Catalyst console (Data Store) using these definitions.",
        "tables": {n: tables[n] for n in order if n in tables},
    }

    bare = [n for n in order if n not in tables]
    if bare:
        manifest["not_generated"] = bare

    json_path = SCHEMA_DIR / "catalyst_schema_manifest.json"
    json_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    md_path = SCHEMA_DIR / "catalyst_schema_manifest.md"
    md_path.write_text(render_markdown(manifest), encoding="utf-8")

    txt_path = SCHEMA_DIR / "catalyst_schema_manifest.txt"
    txt_path.write_text(render_compact(manifest), encoding="utf-8")
    print(f"WROTE {json_path}")
    print(f"WROTE {md_path}")
    print(f"WROTE {txt_path}")
    print(f"tables in manifest: {len(manifest['tables'])}")


def render_compact(manifest: dict) -> str:
    lines = [
        "Catalyst Data Store console checklist — create these tables and columns exactly.",
        "Format: column:type(max)|PK|U|M   (PK primary key, U unique, M mandatory)",
        "",
    ]
    for name, tbl in manifest["tables"].items():
        parts = []
        for c in tbl["columns"]:
            spec = f"{c['name']}:{c['catalyst_type']}"
            if c["catalyst_max_length"]:
                spec += f"({c['catalyst_max_length']})"
            flags = []
            if c["primary_key"]:
                flags.append("PK")
            if c["unique"]:
                flags.append("U")
            if c["mandatory"]:
                flags.append("M")
            if flags:
                spec += "|" + ",".join(flags)
            parts.append(spec)
        lines.append(f"[{name}] " + " ; ".join(parts))
        lines.append("")
    lines.append("_Catalyst auto-adds ROWID/CREATORID/CREATEDTIME/MODIFIEDTIME — do not create them._")
    return "\n".join(lines)


def render_markdown(manifest: dict) -> str:
    lines = [
        "# Catalyst Data Store — Console Table Creation Guide",
        "",
        f"Project: **{manifest['project']}** (`{manifest['project_id']}`) — {manifest['environment']}",
        "",
        "Create each table below in the Catalyst console using the [Data Store → Tables](https://console.catalyst.zoho.com) editor, then add the columns exactly as specified. Catalyst automatically adds `ROWID`, `CREATORID`, `CREATEDTIME`, `MODIFIEDTIME` — do NOT create those.",
        "",
        "Legend: **PK** primary key · **M** mandatory · **U** unique · **FK→table.column** foreign key.",
        "",
    ]
    for name, tbl in manifest["tables"].items():
        lines.append(f"## {name}")
        lines.append("")
        lines.append("| Column | Data Type | Max Length | M | U | PK | FK | Notes |")
        lines.append("|---|---|---|---|---|---|---|---|")
        for c in tbl["columns"]:
            m = "Y" if c["mandatory"] else ""
            u = "Y" if c["unique"] else ""
            pk = "Y" if c["primary_key"] else ""
            fk = c.get("foreign_key") or ""
            notes = "; ".join(c["notes"]) if c.get("notes") else ("app type " + c["app_type"] if c["catalyst_type"]
                                                                   in ("text", "varchar") else "")
            maxlen = c["catalyst_max_length"] or ""
            lines.append(
                f"| {c['name']} | {c['catalyst_type']} | {maxlen} | {m} | {u} | {pk} | {fk} | {notes} |"
            )
        if tbl.get("unique_constraints"):
            lines.append("")
            lines.append("Unique constraints: " + ", ".join(
                f"({', '.join(u)})" for u in tbl["unique_constraints"]))
        lines.append("")
    lines.append("---")
    lines.append("_Generated by `scripts/migration/generate_catalyst_schema.py` from the ORM. "
                 "UUID columns are stored as `varchar(36)`.")
    return "\n".join(lines)


if __name__ == "__main__":
    main()