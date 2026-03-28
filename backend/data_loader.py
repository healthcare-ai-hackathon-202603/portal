"""Load CSV data into SQLite database."""

import csv
import sqlite3
from pathlib import Path

from .database import DATA_DIR, get_connection, create_tables


def _load_csv(conn: sqlite3.Connection, table: str, filepath: Path) -> int:
    with open(filepath, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        if not rows:
            return 0
        columns = list(rows[0].keys())
        placeholders = ", ".join(["?"] * len(columns))
        col_names = ", ".join(columns)
        conn.executemany(
            f"INSERT OR IGNORE INTO {table} ({col_names}) VALUES ({placeholders})",
            [[row[c] for c in columns] for row in rows],
        )
    return len(rows)


def load_all_data() -> dict[str, int]:
    conn = get_connection()
    create_tables(conn)

    files = {
        "patients": "patients.csv",
        "encounters": "encounters.csv",
        "vitals": "vitals.csv",
        "lab_results": "lab_results.csv",
        "medications": "medications.csv",
    }

    counts = {}
    for table, filename in files.items():
        filepath = DATA_DIR / filename
        if not filepath.exists():
            raise FileNotFoundError(f"Missing data file: {filepath}")
        counts[table] = _load_csv(conn, table, filepath)

    conn.commit()
    return counts


# --- Query functions ---

def get_patient(patient_id: str) -> dict | None:
    conn = get_connection()
    row = conn.execute("SELECT * FROM patients WHERE patient_id = ?", (patient_id,)).fetchone()
    return dict(row) if row else None


def get_all_patients() -> list[dict]:
    conn = get_connection()
    rows = conn.execute("SELECT * FROM patients ORDER BY patient_id").fetchall()
    return [dict(r) for r in rows]


def get_encounters(patient_id: str) -> list[dict]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM encounters WHERE patient_id = ? ORDER BY encounter_date",
        (patient_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def get_labs(patient_id: str) -> list[dict]:
    conn = get_connection()
    rows = conn.execute(
        """SELECT lr.*, e.encounter_date, e.facility
           FROM lab_results lr
           JOIN encounters e ON lr.encounter_id = e.encounter_id
           WHERE lr.patient_id = ?
           ORDER BY lr.collected_date""",
        (patient_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def get_vitals(patient_id: str) -> list[dict]:
    conn = get_connection()
    rows = conn.execute(
        """SELECT v.*, e.encounter_date, e.facility
           FROM vitals v
           JOIN encounters e ON v.encounter_id = e.encounter_id
           WHERE v.patient_id = ?
           ORDER BY v.recorded_at""",
        (patient_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def get_medications(patient_id: str) -> list[dict]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM medications WHERE patient_id = ? ORDER BY start_date",
        (patient_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def get_patient_alert_counts() -> dict[str, int]:
    """Get count of abnormal labs + active meds per patient for list sorting."""
    conn = get_connection()
    rows = conn.execute("""
        SELECT p.patient_id,
               COALESCE(lab_counts.abnormal_count, 0) +
               COALESCE(med_counts.active_count, 0) as alert_score
        FROM patients p
        LEFT JOIN (
            SELECT patient_id, COUNT(*) as abnormal_count
            FROM lab_results WHERE abnormal_flag != 'N'
            GROUP BY patient_id
        ) lab_counts ON p.patient_id = lab_counts.patient_id
        LEFT JOIN (
            SELECT patient_id, COUNT(*) as active_count
            FROM medications WHERE active = 'True'
            GROUP BY patient_id
        ) med_counts ON p.patient_id = med_counts.patient_id
        ORDER BY alert_score DESC
    """).fetchall()
    return {row["patient_id"]: row["alert_score"] for row in rows}
