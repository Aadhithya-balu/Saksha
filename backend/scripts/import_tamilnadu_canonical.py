"""Map the raw Tamil Nadu CSV tables into SAKSHA canonical tables.

This adapter preserves the raw ``t_*`` tables and writes canonical CSV
artifacts under ``backend/data/tamilnadu_canonical`` before inserting them.
IDs are deterministic UUID5 values derived from source identifiers, so a
rerun is idempotent and every row carries import provenance.
"""
from __future__ import annotations

import csv
import os
import uuid
from datetime import date, datetime, timezone
from pathlib import Path

import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "tamilnadu_canonical"
SCHEMA = "public"
NS = uuid.uuid5(uuid.NAMESPACE_URL, "saksha://tamilnadu-crime-intelligence")
PROVENANCE = "imported"
SOURCE_SYSTEM = "tamilnadu_crime_intelligence"
JOB_ID = uuid.uuid5(NS, "import-job:tamilnadu-crime-intelligence:v1")


def uid(kind: str, value: object) -> str:
    return str(uuid.uuid5(NS, f"{kind}:{value}"))


def parse_dt(value: object) -> datetime | None:
    if not value:
        return None
    text = str(value).strip()
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        return None


def parse_date(value: object) -> date | None:
    dt = parse_dt(value)
    if dt:
        return dt.date()
    if value:
        try:
            return date.fromisoformat(str(value)[:10])
        except ValueError:
            return None
    return None


def clean_gender(value: object) -> str | None:
    if not value:
        return None
    text = str(value).strip().lower()
    return {"male": "Male", "female": "Female", "other": "Other"}.get(text, "Other")


def age_from_dob(dob: date | None) -> int | None:
    if not dob:
        return None
    today = date.today()
    return max(0, today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day)))


def write_csv(name: str, headers: list[str], rows: list[dict]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    with (OUT / name).open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=headers)
        writer.writeheader()
        writer.writerows(rows)


def insert_rows(cur, table: str, columns: list[str], rows: list[dict]) -> None:
    if not rows:
        return
    values = [[row.get(column) for column in columns] for row in rows]
    query = f"INSERT INTO {SCHEMA}.{table} ({', '.join(columns)}) VALUES %s ON CONFLICT DO NOTHING"
    execute_values(cur, query, values, page_size=1000)


def main() -> None:
    load_dotenv(ROOT / ".env")
    load_dotenv(ROOT / ".." / ".env")
    conn = psycopg2.connect(
        host=os.environ["SUPABASE_DB_HOST"],
        port=5432,
        dbname=os.environ.get("SUPABASE_DB_NAME", "postgres"),
        user=os.environ["SUPABASE_DB_USER"],
        password=os.environ["SUPABASE_DB_PASSWORD"],
        sslmode=os.environ.get("SUPABASE_DB_SSLMODE", "require"),
        connect_timeout=30,
    )
    conn.autocommit = False
    cur = conn.cursor()
    try:
        cur.execute(
            """INSERT INTO import_jobs
            (id, entity_type, source_format, mapping_profile, source_system,
             filename, status, total_rows, imported_rows, failed_rows, valid_rows,
             invalid_rows, warning_rows, exact_duplicate_rows, potential_duplicate_rows,
             conflict_rows, new_record_rows, matched_record_rows, updated_record_rows,
             rejected_rows, review_rows, error_count, promoted_rows, quality_grade,
             processing_started_at, processing_completed_at)
            VALUES (%s, %s, 'csv', 'tamilnadu_raw', %s, %s, 'completed',
                    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 'A', %s, %s)
            ON CONFLICT (id) DO UPDATE SET status='completed',
              processing_completed_at=EXCLUDED.processing_completed_at""",
            (str(JOB_ID), "tamilnadu_bundle", SOURCE_SYSTEM,
             "tamilnadu_crime_intelligence_bundle",
             datetime.now(timezone.utc).replace(tzinfo=None),
             datetime.now(timezone.utc).replace(tzinfo=None)),
        )

        cur.execute("SELECT offence_type_id, offence_code, offence_category, offence_subcategory, severity_band FROM t_14_offence_type")
        offence_rows = cur.fetchall()
        category_by_offence = {}
        category_by_name = {}
        categories = []
        for oid, code, category, subcategory, severity in offence_rows:
            name = " / ".join(x for x in [category, subcategory] if x) or f"Offence {oid}"
            canonical_name = name[:150]
            category_id = category_by_name.get(canonical_name)
            if category_id is None:
                category_id = uid("category", canonical_name)
                category_by_name[canonical_name] = category_id
                categories.append({"id": category_id, "name": canonical_name, "section_code": code, "severity": severity})
            category_by_offence[oid] = category_id
            name = " / ".join(x for x in [category, subcategory] if x) or f"Offence {oid}"
        insert_rows(cur, "crime_categories", ["id", "name", "section_code", "severity"], categories)
        write_csv("crime_categories.csv", ["id", "name", "section_code", "severity"], categories)

        cur.execute("SELECT district_id, district_name FROM t_02_district")
        districts = {row[0]: row[1] for row in cur.fetchall()}
        cur.execute("SELECT station_id, station_name, district_id FROM t_09_police_station")
        stations = {row[0]: row for row in cur.fetchall()}
        cur.execute("SELECT beat_id, station_id FROM t_10_police_beat")
        beats = {row[0]: row[1] for row in cur.fetchall()}

        cur.execute("SELECT location_id, district_id, beat_id, location_type, latitude, longitude FROM t_21_location")
        locations = []
        location_ids = {}
        for lid, district_id, beat_id, location_type, lat, lon in cur.fetchall():
            location_id = uid("location", lid)
            station_id = beats.get(beat_id)
            station_name = stations.get(station_id, (None, None, None))[1]
            row = {"id": location_id, "address": f"{location_type or 'Location'} [{lid}]", "district": districts.get(district_id, str(district_id))[:100],
                   "station": station_name, "latitude": float(lat or 0), "longitude": float(lon or 0),
                   "pincode": None, "dataset_provenance": PROVENANCE, "source_import_job_id": str(JOB_ID),
                   "source_file": "21_location.csv", "source_row_ref": str(lid)}
            locations.append(row)
            location_ids[lid] = location_id
        insert_rows(cur, "locations", list(locations[0]), locations)
        write_csv("locations.csv", list(locations[0]), locations)

        cur.execute("SELECT officer_id, person_id, station_id, rank, designation, officer_status FROM t_13_officer")
        officers = []
        officer_ids = {}
        for oid, person_id, station_id, rank, designation, status in cur.fetchall():
            officer_id = uid("officer", oid)
            station_name = stations.get(station_id, (None, "Unknown", None))[1]
            row = {"id": officer_id, "supabase_user_id": None, "user_id": None, "badge_number": f"TN-{oid}",
                   "name": f"Tamil Nadu Officer {oid}", "rank": rank, "station": station_name or "Unknown",
                   "district": districts.get(stations.get(station_id, (None, None, None))[2]),
                   "designation": designation, "phone": None, "email": None,
                   "status": status or "active", "image_url": None, "dataset_provenance": PROVENANCE,
                   "source_import_job_id": str(JOB_ID), "source_file": "13_officer.csv", "source_row_ref": str(oid)}
            officers.append(row)
            officer_ids[oid] = officer_id
        insert_rows(cur, "officers", list(officers[0]), officers)
        write_csv("officers.csv", list(officers[0]), officers)

        cur.execute("SELECT person_id, person_type, gender, date_of_birth, synthetic_address_id FROM t_11_person")
        criminal_rows, victim_rows = [], []
        person_ids = {}
        cur.execute("SELECT address_id, locality_name, district_id FROM t_12_address")
        addresses = {row[0]: row for row in cur.fetchall()}
        cur.execute("SELECT person_id, person_type, gender, date_of_birth, synthetic_address_id FROM t_11_person")
        for pid, ptype, gender, dob_value, address_id in cur.fetchall():
            dob = parse_date(dob_value)
            address = addresses.get(address_id)
            address_text = address[1] if address else None
            common = {"full_name": f"Tamil Nadu Person {pid}", "gender": clean_gender(gender), "address": address_text,
                      "dataset_provenance": PROVENANCE, "source_import_job_id": str(JOB_ID),
                      "source_row_ref": str(pid)}
            if ptype in ("accused", "suspect"):
                row = {"id": uid("criminal", pid), **common, "aliases": None, "date_of_birth": dob,
                       "identifying_marks": None, "mo_summary": None, "status": "at_large",
                       "gang_affiliation": None, "neo4j_node_id": None, "image_url": None,
                       "source_file": "11_person.csv"}
                criminal_rows.append(row)
                person_ids[pid] = ("criminal", row["id"])
            elif ptype == "victim":
                row = {"id": uid("victim", pid), **common, "contact_number": None, "age": age_from_dob(dob),
                       "statement": None, "neo4j_node_id": None, "image_url": None,
                       "source_file": "11_person.csv"}
                victim_rows.append(row)
                person_ids[pid] = ("victim", row["id"])
        if criminal_rows:
            insert_rows(cur, "criminals", list(criminal_rows[0]), criminal_rows)
            write_csv("criminals.csv", list(criminal_rows[0]), criminal_rows)
        if victim_rows:
            insert_rows(cur, "victims", list(victim_rows[0]), victim_rows)
            write_csv("victims.csv", list(victim_rows[0]), victim_rows)

        cur.execute("SELECT case_id, location_id FROM t_22_case_location ORDER BY case_id, sequence_number")
        case_locations = {}
        for source_case_id, source_location_id in cur.fetchall():
            case_locations.setdefault(source_case_id, source_location_id)
        cur.execute("SELECT case_id, fir_id, station_id, district_id, beat_id, offence_type_id, complainant_person_id, primary_victim_person_id, case_status, priority_level, incident_start_timestamp, report_timestamp, incident_location_type, investigation_officer_id FROM t_15_case")
        cases, case_ids, fir_ids, case_officer_ids = [], {}, {}, {}
        for cid, fir, station_id, district_id, beat_id, offence_id, complainant, primary_victim, status, priority, occurred, reported, loc_type, investigating in cur.fetchall():
            case_id = uid("case", cid)
            category_id = category_by_offence.get(offence_id)
            location_id = None
            loc = case_locations.get(cid)
            if loc:
                location_id = location_ids.get(loc)
            if not location_id:
                location_id = next(iter(location_ids.values()))
            status_map = {"open": "active", "pending": "under_investigation", "untraced": "closed"}
            row = {"id": case_id, "case_number": str(fir or cid)[:50], "category_id": category_id,
                   "location_id": location_id, "occurred_at": parse_dt(occurred) or datetime(2020, 1, 1),
                   "reported_at": parse_dt(reported) or parse_dt(occurred) or datetime(2020, 1, 1),
                   "description": loc_type, "mo_tags": None, "status": status_map.get(status, status or "active"),
                   "priority": (priority or "medium").lower(), "progress": 10,
                   "assigned_officer_id": officer_ids.get(investigating), "dataset_provenance": PROVENANCE,
                   "source_import_job_id": str(JOB_ID), "source_file": "15_case.csv", "source_row_ref": str(cid)}
            cases.append(row)
            case_ids[cid] = case_id
            fir_ids[cid] = str(fir or cid)[:50]
            case_officer_ids[cid] = officer_ids.get(investigating)
        insert_rows(cur, "crime_cases", list(cases[0]), cases)
        write_csv("crime_cases.csv", list(cases[0]), cases)

        cur.execute("SELECT case_id, offence_type_id FROM t_16_case_offence ORDER BY case_id, offence_sequence")
        sections = {}
        for cid, offence_id in cur.fetchall():
            sections.setdefault(cid, []).append(str(offence_id))
        cur.execute("SELECT case_id, person_id, role FROM t_17_case_person")
        case_people = cur.fetchall()
        complainant_by_case = {cid: pid for cid, pid, role in case_people if role in ("complainant", "informant")}
        firs = []
        for cid, case_id in case_ids.items():
            complainant = complainant_by_case.get(cid)
            row = {"id": uid("fir", cid), "fir_number": fir_ids[cid], "crime_case_id": case_id,
                   "investigating_officer_id": case_officer_ids.get(cid),
                   "complainant_name": f"Tamil Nadu Person {complainant}" if complainant else "Unknown complainant",
                   "complainant_contact": None, "sections": ",".join(sections.get(cid, []))[:255],
                   "filed_at": datetime(2020, 1, 1), "status": "registered", "narrative": None,
                   "attachments": None, "dataset_provenance": PROVENANCE, "source_import_job_id": str(JOB_ID),
                   "source_file": "15_case.csv", "source_row_ref": str(cid)}
            firs.append(row)
        insert_rows(cur, "firs", list(firs[0]), firs)
        write_csv("firs.csv", list(firs[0]), firs)

        criminal_links, victim_links = [], []
        fir_by_case = {row["crime_case_id"]: row["id"] for row in firs}
        for cid, pid, role in case_people:
            person = person_ids.get(pid)
            if not person or cid not in fir_by_case:
                continue
            if person[0] == "criminal":
                criminal_links.append({"id": uid("fir-criminal", f"{cid}:{pid}"), "fir_id": fir_by_case[cid], "criminal_id": person[1], "role": role})
            elif person[0] == "victim":
                victim_links.append({"id": uid("fir-victim", f"{cid}:{pid}"), "fir_id": fir_by_case[cid], "victim_id": person[1]})
        if criminal_links:
            insert_rows(cur, "fir_criminal_links", list(criminal_links[0]), criminal_links)
            write_csv("fir_criminal_links.csv", list(criminal_links[0]), criminal_links)
        if victim_links:
            insert_rows(cur, "fir_victim_links", list(victim_links[0]), victim_links)
            write_csv("fir_victim_links.csv", list(victim_links[0]), victim_links)

        cur.execute("SELECT evidence_id, case_id, evidence_type, description_category, forensic_status FROM t_23_evidence")
        evidence = []
        for eid, cid, evidence_type, description, status in cur.fetchall():
            if cid not in case_ids:
                continue
            evidence.append({"id": uid("evidence", eid), "case_id": case_ids[cid], "title": f"Evidence {eid}",
                             "description": description, "evidence_type": evidence_type or "document",
                             "status": status or "Pending", "created_by": None, "assigned_to": None,
                             "storage_path": None, "dataset_provenance": PROVENANCE,
                             "source_import_job_id": str(JOB_ID), "source_file": "23_evidence.csv", "source_row_ref": str(eid)})
        if evidence:
            insert_rows(cur, "evidence", list(evidence[0]), evidence)
            write_csv("evidence.csv", list(evidence[0]), evidence)

        cur.execute("UPDATE import_jobs SET total_rows=%s, imported_rows=%s, valid_rows=%s, new_record_rows=%s WHERE id=%s",
                    (len(cases) + len(criminal_rows) + len(victim_rows) + len(evidence),
                     len(cases) + len(criminal_rows) + len(victim_rows) + len(evidence),
                     len(cases) + len(criminal_rows) + len(victim_rows) + len(evidence),
                     len(cases) + len(criminal_rows) + len(victim_rows) + len(evidence), str(JOB_ID)))
        conn.commit()
        print({"job_id": str(JOB_ID), "cases": len(cases), "firs": len(firs), "criminals": len(criminal_rows),
               "victims": len(victim_rows), "locations": len(locations), "officers": len(officers),
               "evidence": len(evidence), "criminal_links": len(criminal_links), "victim_links": len(victim_links),
               "canonical_csv_dir": str(OUT)})
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()




