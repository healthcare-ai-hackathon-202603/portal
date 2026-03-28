"""FastAPI application for HealthSync pre-visit intelligence system."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .data_loader import (
    get_all_patients,
    get_encounters,
    get_labs,
    get_medications,
    get_patient,
    get_patient_alert_counts,
    get_vitals,
    load_all_data,
)
from .models import (
    Encounter,
    LabTrajectory,
    MedicationAlerts,
    Patient,
    PatientListItem,
    PatientSummary,
    SessionDelta,
)
from .session_delta import (
    compute_full_delta,
    compute_lab_trajectories,
    compute_vital_trajectories,
    detect_care_gaps,
    detect_medication_alerts,
)
from .templates import generate_patient_summary, render_medication_for_patient


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    counts = load_all_data()
    print(f"Loaded data: {counts}")
    yield


# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(
    title="HealthSync API",
    description="AI-Powered Pre-Visit Intelligence & Patient Navigation",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _require_patient(patient_id: str) -> dict:
    """Fetch a patient or raise 404."""
    patient = get_patient(patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found")
    return patient


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/patients", response_model=list[PatientListItem])
async def list_patients():
    """Return all patients sorted by alert score (descending)."""
    patients = get_all_patients()
    alert_counts = get_patient_alert_counts()

    # Pre-compute encounter counts and facility counts
    items: list[PatientListItem] = []
    for p in patients:
        pid = p["patient_id"]
        encounters = get_encounters(pid)
        facilities = {e["facility"] for e in encounters if e.get("facility")}

        items.append(PatientListItem(
            patient_id=pid,
            first_name=p["first_name"],
            last_name=p["last_name"],
            age=int(p["age"]),
            sex=p["sex"],
            primary_language=p["primary_language"],
            alert_score=alert_counts.get(pid, 0),
            encounter_count=len(encounters),
            facility_count=len(facilities),
        ))

    items.sort(key=lambda i: i.alert_score, reverse=True)
    return items


@app.get("/api/patients/{patient_id}", response_model=Patient)
async def get_patient_detail(patient_id: str):
    """Return a single patient's demographics."""
    p = _require_patient(patient_id)
    return Patient(**p)


@app.get("/api/patients/{patient_id}/summary", response_model=PatientSummary)
async def get_patient_summary(
    patient_id: str,
    lang: str = Query(default="en", description="Language code (en, fr, zh, pa)"),
):
    """Patient-facing plain-language summary with alerts."""
    _require_patient(patient_id)
    delta = compute_full_delta(patient_id)
    return generate_patient_summary(delta, language=lang)


@app.get("/api/patients/{patient_id}/clinical-brief", response_model=SessionDelta)
async def get_clinical_brief(patient_id: str):
    """Clinician-facing structured session delta."""
    _require_patient(patient_id)
    return compute_full_delta(patient_id)


@app.get("/api/patients/{patient_id}/timeline", response_model=list[Encounter])
async def get_patient_timeline(patient_id: str):
    """Return patient encounters sorted by date descending."""
    _require_patient(patient_id)
    encounters = get_encounters(patient_id)
    # get_encounters returns sorted ascending; reverse for timeline view
    encounters.reverse()
    return [Encounter(**e) for e in encounters]


@app.get("/api/patients/{patient_id}/labs")
async def get_patient_labs(patient_id: str):
    """Return lab trajectories for a patient."""
    _require_patient(patient_id)
    trajectories = compute_lab_trajectories(patient_id)
    return trajectories


@app.get("/api/patients/{patient_id}/vitals")
async def get_patient_vitals(patient_id: str):
    """Return vital trajectories for a patient."""
    _require_patient(patient_id)
    trajectories = compute_vital_trajectories(patient_id)
    return trajectories


@app.get("/api/patients/{patient_id}/medications")
async def get_patient_medications(patient_id: str, lang: str = Query(default="en")):
    """Return medications with alerts and patient-friendly descriptions."""
    _require_patient(patient_id)

    # Raw medication list with patient-friendly rendering
    raw_meds = get_medications(patient_id)
    medications = [render_medication_for_patient(m, lang) for m in raw_meds]

    # Medication alerts (duplications, correlations, expiring)
    alerts = detect_medication_alerts(patient_id)

    return {
        "medications": medications,
        "alerts": alerts,
    }


# ---------------------------------------------------------------------------
# Run config
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
