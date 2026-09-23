"""
SAKSHA — Tamil Nadu Migration Script
=====================================
TARGET: PROJECT 2 — Tamil Nadu Supabase (nunwiqqjomvlsoferibi)
SOURCE: PROJECT 1 — Karnataka Supabase (READ ONLY — never touched here)

Usage:
    py backend/scripts/migrate_tamilnadu.py

Phases:
    0  Verify target connection (abort if not PROJECT 2)
    1  Create schema grants
    2  Create extensions
    3  Create tables (idempotent via CREATE TABLE IF NOT EXISTS)
    4  Create constraints / foreign keys
    5  Create indexes
    6  Create functions / triggers
    7  Insert roles (idempotent)
    8  Insert application users (idempotent)
    9  Load Tamil Nadu canonical geography (locations)
    10 Load crime categories
    11 Load officers
    12 Load criminals / victims
    13 Load crime cases / FIRs / links
    14 Load evidence
    15 Configure storage bucket
    16 Configure RLS policies
    17 Validate everything + write migration_report.txt
"""

import csv
import os
import sys
import traceback
from datetime import datetime, timezone
from pathlib import Path

import psycopg2
import psycopg2.extras
import requests
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).parent
BACKEND_DIR = SCRIPT_DIR.parent
CANONICAL_DIR = BACKEND_DIR / "data" / "tamilnadu_canonical"
REPORT_PATH = SCRIPT_DIR / "migration_report.txt"

load_dotenv(BACKEND_DIR / ".env")

# ---------------------------------------------------------------------------
# TARGET PROJECT 2 — Tamil Nadu
# NEVER use PROJECT 1 credentials here.
# ---------------------------------------------------------------------------
NEW_DB_HOST     = os.getenv("SUPABASE_DB_HOST", "")
NEW_DB_PORT     = int(os.getenv("SUPABASE_DB_PORT", "6543"))
NEW_DB_NAME     = os.getenv("SUPABASE_DB_NAME", "postgres")
NEW_DB_USER     = os.getenv("SUPABASE_DB_USER", "")
NEW_DB_PASSWORD = os.getenv("SUPABASE_DB_PASSWORD", "")
NEW_DB_SSLMODE  = os.getenv("SUPABASE_DB_SSLMODE", "require")
NEW_SUPABASE_URL            = os.getenv("SUPABASE_URL", "")
NEW_SUPABASE_SERVICE_ROLE   = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
NEW_SUPABASE_STORAGE_BUCKET = os.getenv("SUPABASE_STORAGE_BUCKET", "evidence-files")

TARGET_PROJECT_ID = "nunwiqqjomvlsoferibi"

# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------
report_lines: list[str] = []
stats: dict = {}


def log(msg: str) -> None:
    print(msg)
    report_lines.append(msg)


def phase(n: int, total: int, name: str) -> None:
    log(f"\n[{n}/{total}] {name}")


def ok() -> None:
    log("  → OK")


def warn(msg: str) -> None:
    log(f"  ⚠  WARNING: {msg}")


def fail(msg: str) -> None:
    log(f"  ✗  FAILED: {msg}")
    write_report()
    sys.exit(1)


def write_report() -> None:
    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(report_lines))
    print(f"\nReport written to: {REPORT_PATH}")


# ---------------------------------------------------------------------------
# PHASE 0 — Verify target connection
# ---------------------------------------------------------------------------
def phase0_verify_connection() -> psycopg2.extensions.connection:
    phase(0, 17, "Verify target connection")

    if not all([NEW_DB_HOST, NEW_DB_USER, NEW_DB_PASSWORD]):
        fail("Missing DB credentials in .env — check SUPABASE_DB_HOST / USER / PASSWORD")

    # Verify the host contains the expected project ID
    if TARGET_PROJECT_ID not in NEW_DB_HOST and TARGET_PROJECT_ID not in NEW_DB_USER:
        fail(
            f"SAFETY ABORT: Connected host '{NEW_DB_HOST}' / user '{NEW_DB_USER}' "
            f"does not match TARGET PROJECT ID '{TARGET_PROJECT_ID}'. "
            "Refusing to write to an unverified database."
        )

    try:
        conn = psycopg2.connect(
            host=NEW_DB_HOST,
            port=NEW_DB_PORT,
            dbname=NEW_DB_NAME,
            user=NEW_DB_USER,
            password=NEW_DB_PASSWORD,
            sslmode=NEW_DB_SSLMODE,
            connect_timeout=20,
        )
        conn.autocommit = False
    except Exception as e:
        fail(f"Cannot connect to PROJECT 2: {e}")

    # Double-check by querying the current_database and connection string
    with conn.cursor() as cur:
        cur.execute("SELECT current_database(), current_user, inet_server_addr()::text;")
        db, user, addr = cur.fetchone()
        log(f"  Connected: db={db}  user={user}  addr={addr}")

    # Final safety: project ID must appear in user string (pooler format: postgres.<project_id>)
    if TARGET_PROJECT_ID not in NEW_DB_USER:
        conn.close()
        fail(
            f"SAFETY ABORT: DB user '{NEW_DB_USER}' does not contain "
            f"'{TARGET_PROJECT_ID}'. Aborting to protect PROJECT 1."
        )

    log(f"\n  ✓ TARGET PROJECT VERIFIED: {TARGET_PROJECT_ID}")
    ok()
    return conn
