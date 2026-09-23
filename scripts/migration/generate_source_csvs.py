"""Generate Catalyst-import-ready CSVs for every Saksha table.

Steps:
  1. Build a LOCAL SQLite database using the real app ORM + seed (never
     touches the Supabase credentials in backend/.env — DATABASE_URL is
     overridden to an absolute sqlite path here).
  2. Export each table to data/catalyst_<table>.csv (UTF-8, app columns
     only; Catalyst adds ROWID/CREATORID/CREATEDTIME/MODIFIEDTIME itself).
  3. Also stage the socioeconomic indicators CSV (the only pre-existing
     data file in the repo).

Dependency order intended for a later catalyst ds:import pass:
  roles, crime_categories, locations, system_settings, users, officers,
  criminals, victims, crime_cases, firs, fir_criminal_links,
  fir_victim_links, evidence, evidence_metadata, evidence_timeline,
  evidence_assignments, chain_of_custody, evidence_ai_summary, reports,
  report_versions, report_source_links, report_evidence_links, audit_logs,
  notifications, investigation_notes, chat_conversations, chat_messages,
  import_jobs, import_staging_records, interventions, mo_tags,
  case_mo_tags, criminal_mo_tags, revoked_tokens, socioeconomic_indicators
"""
from __future__ import annotations

import csv
import io
import json
import os
import sys
from datetime import date, datetime, time
from pathlib import Path
from decimal import Decimal

HERE = Path(__file__).resolve().parent
BACKEND = HERE.parents[1] / "backend"
DATA_DIR = HERE / "data"
LOGS_DIR = HERE / "logs"
SRC_DB = HERE / "migration_source.db"

os.environ["DATABASE_URL"] = f"sqlite:///{SRC_DB.as_posix()}"
os.environ["SAKSHA_DATA_MODE"] = "demo"
os.environ["APP_ENV"] = "development"

sys.path.insert(0, str(BACKEND))

# ---------------------------------------------------------------------------
# argon2 is not installed in the generation Python. Seed data must be the
# canonical app dataset, so stub minimal Argon2 behavior for the offline
# seed run (hashing itself is irrelevant to the CSV rows). Do NOT use this
# stub for anything security-sensitive.
# ---------------------------------------------------------------------------
import types as _types

_argon2 = _types.ModuleType("argon2")
_argon2_exc = _types.ModuleType("argon2.exceptions")


class _StubPasswords:
    def __init__(self, *a, **k):
        pass

    def hash(self, password: str) -> str:
        return f"$argon2id$migration-stub${password}"

    def verify(self, hashed: str, password: str) -> bool:
        return hashed == self.hash(password)

    def check_needs_rehash(self, hashed: str) -> bool:
        return False


for _cls in ("InvalidHashError", "VerificationError", "VerifyMismatchError"):
    setattr(_argon2_exc, _cls, ValueError)
_argon2.PasswordHasher = _StubPasswords
_argon2.exceptions = _argon2_exc
sys.modules["argon2"] = _argon2
sys.modules["argon2.exceptions"] = _argon2_exc


def csv_value(v):
    if v is None:
        return ""
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, datetime):
        return v.strftime("%Y-%m-%d %H:%M:%S")
    if isinstance(v, date):
        return v.isoformat()
    if isinstance(v, time):
        return v.isoformat()
    if isinstance(v, (dict, list)):
        return json.dumps(v, ensure_ascii=False)
    if isinstance(v, (Decimal, float)):
        return repr(float(v))
    if isinstance(v, bytes):
        import base64
        return base64.b64encode(v).decode("ascii")
    s = str(v)
    # neutralize embedded NULs / control chars that break CSV parsing
    return "".join(ch if ch > "\x1f" or ch in "\t" else " " for ch in s)


def export_table(db, table_name, table, summary):
    cols = [c.name for c in table.columns]
    order_cols = [c.name for c in table.columns if c.primary_key]
    query = db.query(table)
    if order_cols:
        query = query.order_by(*[table.c[c] for c in order_cols])
    rows = [list(r) for r in query.all()]

    out = DATA_DIR / f"catalyst_{table_name}.csv"
    with io.open(out, "w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(cols)
        for row in rows:
            writer.writerow([csv_value(v) for v in row])

    summary[table_name] = {
        "rows": len(rows),
        "csv": out.name,
        "columns": cols,
    }
    print(f"  {table_name:26s} {len(rows):5d} rows -> {out.name}")


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    if SRC_DB.exists():
        SRC_DB.unlink()

    from app.database.seed_db import seed

    # Two app tables are declared inline in a route module (app/routes/admin.py)
    # and are never part of app.models, so Base.metadata.create_all() misses
    # them. Register them here so they exist (empty) in the source DB and are
    # exported as header-only CSVs. Mirrors backend/app/routes/admin.py:52-70.
    from sqlalchemy import Column, String, Text, DateTime, Table
    from app.database.postgres import Base

    Table(
        "system_settings",
        Base.metadata,
        Column("id", String(36), primary_key=True),
        Column("key", String(100), nullable=False),
        Column("value", Text),
        Column("description", String(500)),
        Column("created_at", DateTime),
        Column("updated_at", DateTime),
    )
    Table(
        "role_permissions",
        Base.metadata,
        Column("id", String(36), primary_key=True),
        Column("role_id", String(36), nullable=False),
        Column("permission", String(100), nullable=False),
        Column("resource", String(100), nullable=False),
        Column("created_at", DateTime),
    )

    seed()

    from app.database.postgres import Base, SessionLocal
    from sqlalchemy import create_engine
    import os as _os

    # ensure engine/session reference the same sqlite file
    engine = create_engine(f"sqlite:///{SRC_DB.as_posix()}", connect_args={"check_same_thread": False})
    SessionLocal.configure(bind=engine)
    db = SessionLocal()

    summary: dict = {}
    try:
        for name, table in Base.metadata.tables.items():
            export_table(db, name, table, summary)
    finally:
        db.close()

    # Staged reference tables (not ORM-defined):
    socio = here = BACKEND / "data" / "socioeconomic" / "karnataka_socioeconomic_indicators.csv"
    import shutil
    if socio.exists():
        dest = DATA_DIR / "catalyst_socioeconomic_indicators.csv"
        shutil.copyfile(socio, dest)
        n = sum(1 for _ in io.open(dest, encoding="utf-8")) - 1
        summary["socioeconomic_indicators"] = {
            "rows": n,
            "csv": dest.name,
            "columns": ["district", "population_lakhs", "area_sq_km", "literacy_rate",
                        "sex_ratio", "avg_income_lakhs", "unemployment_rate",
                        "urbanization_type", "urbanization_share_pct", "data_year"],
        }
        print(f"  {'socioeconomic_indicators':26s} {n:5d} rows -> copied from repo CSV")

    (LOGS_DIR / "seed_summary.json").write_text(
        json.dumps(summary, indent=2), encoding="utf-8"
    )
    total = sum(s["rows"] for s in summary.values())
    print(f"\nTOTAL rows: {total} across {len(summary)} tables")
    print(f"Summary: {LOGS_DIR / 'seed_summary.json'}")


if __name__ == "__main__":
    main()