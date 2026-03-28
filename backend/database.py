"""SQLite database connection manager and schema setup."""

import sqlite3
import os
from pathlib import Path

DB_PATH = os.environ.get("HEALTHSYNC_DB", ":memory:")
DATA_DIR = Path(__file__).parent.parent / "data"

_connection: sqlite3.Connection | None = None


def get_connection() -> sqlite3.Connection:
    global _connection
    if _connection is None:
        _connection = sqlite3.connect(DB_PATH, check_same_thread=False)
        _connection.row_factory = sqlite3.Row
        _connection.execute("PRAGMA journal_mode=WAL")
        _connection.execute("PRAGMA foreign_keys=ON")
    return _connection


def create_tables(conn: sqlite3.Connection) -> None:
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS patients (
            patient_id TEXT PRIMARY KEY,
            first_name TEXT,
            last_name TEXT,
            date_of_birth TEXT,
            age INTEGER,
            sex TEXT,
            postal_code TEXT,
            blood_type TEXT,
            insurance_number TEXT,
            primary_language TEXT,
            emergency_contact_phone TEXT
        );

        CREATE TABLE IF NOT EXISTS encounters (
            encounter_id TEXT PRIMARY KEY,
            patient_id TEXT,
            encounter_date TEXT,
            encounter_type TEXT,
            facility TEXT,
            chief_complaint TEXT,
            diagnosis_code TEXT,
            diagnosis_description TEXT,
            triage_level INTEGER,
            disposition TEXT,
            length_of_stay_hours REAL,
            attending_physician TEXT,
            FOREIGN KEY (patient_id) REFERENCES patients(patient_id)
        );

        CREATE TABLE IF NOT EXISTS vitals (
            vitals_id TEXT PRIMARY KEY,
            patient_id TEXT,
            encounter_id TEXT,
            heart_rate INTEGER,
            systolic_bp INTEGER,
            diastolic_bp INTEGER,
            temperature_celsius REAL,
            respiratory_rate INTEGER,
            o2_saturation REAL,
            pain_scale INTEGER,
            recorded_at TEXT,
            FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
            FOREIGN KEY (encounter_id) REFERENCES encounters(encounter_id)
        );

        CREATE TABLE IF NOT EXISTS lab_results (
            lab_id TEXT PRIMARY KEY,
            patient_id TEXT,
            encounter_id TEXT,
            test_name TEXT,
            test_code TEXT,
            value REAL,
            unit TEXT,
            reference_range_low REAL,
            reference_range_high REAL,
            abnormal_flag TEXT,
            collected_date TEXT,
            FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
            FOREIGN KEY (encounter_id) REFERENCES encounters(encounter_id)
        );

        CREATE TABLE IF NOT EXISTS medications (
            medication_id TEXT PRIMARY KEY,
            patient_id TEXT,
            drug_name TEXT,
            drug_code TEXT,
            dosage TEXT,
            frequency TEXT,
            route TEXT,
            prescriber TEXT,
            start_date TEXT,
            end_date TEXT,
            active TEXT,
            FOREIGN KEY (patient_id) REFERENCES patients(patient_id)
        );

        CREATE INDEX IF NOT EXISTS idx_encounters_patient ON encounters(patient_id);
        CREATE INDEX IF NOT EXISTS idx_encounters_date ON encounters(encounter_date);
        CREATE INDEX IF NOT EXISTS idx_vitals_patient ON vitals(patient_id);
        CREATE INDEX IF NOT EXISTS idx_vitals_encounter ON vitals(encounter_id);
        CREATE INDEX IF NOT EXISTS idx_labs_patient ON lab_results(patient_id);
        CREATE INDEX IF NOT EXISTS idx_labs_encounter ON lab_results(encounter_id);
        CREATE INDEX IF NOT EXISTS idx_meds_patient ON medications(patient_id);
    """)
    conn.commit()
