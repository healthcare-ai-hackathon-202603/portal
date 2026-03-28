"""Triage Agent — rules-based urgency assessment from symptoms + patient history."""

from __future__ import annotations

from datetime import date, datetime, timedelta

from .. import data_loader
from ..models import TriageResult

TODAY = date(2026, 3, 28)

# ---------------------------------------------------------------------------
# Keyword → urgency mapping
# ---------------------------------------------------------------------------

EMERGENCY_KEYWORDS: list[str] = [
    "chest pain",
    "difficulty breathing",
    "severe bleeding",
    "unconscious",
    "stroke",
    "seizure",
    "heart attack",
    "not breathing",
    "choking",
    "anaphylaxis",
    "severe allergic reaction",
    "suicidal",
    "overdose",
]

URGENT_KEYWORDS: list[str] = [
    "high fever",
    "severe pain",
    "vomiting blood",
    "sudden vision loss",
    "blood in stool",
    "severe headache",
    "broken bone",
    "fracture",
    "deep cut",
    "laceration",
    "severe burn",
    "sudden numbness",
    "severe abdominal pain",
    "coughing blood",
]

# Diagnosis codes that represent chronic conditions we should watch for
CHRONIC_CONDITION_SYMPTOM_MAP: dict[str, list[str]] = {
    "E11.9": ["fatigue", "thirst", "blurred vision", "frequent urination", "dizziness", "nausea", "weight loss"],
    "I10": ["headache", "dizziness", "chest pain", "shortness of breath", "blurred vision"],
    "F32.9": ["fatigue", "insomnia", "anxiety", "mood", "depression", "hopelessness"],
    "J45.20": ["shortness of breath", "wheezing", "cough", "chest tightness"],
    "J45.50": ["shortness of breath", "wheezing", "cough", "chest tightness"],
    "E78.5": ["chest pain", "fatigue"],
    "E03.9": ["fatigue", "weight gain", "cold intolerance", "constipation"],
    "N18.3": ["swelling", "fatigue", "nausea", "shortness of breath"],
    "K21.0": ["heartburn", "acid reflux", "chest pain", "nausea"],
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_date(date_str: str | None) -> date | None:
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str[:10], "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None


def _count_recent_er_visits(patient_id: str, months: int = 6) -> int:
    """Count emergency encounters in the last N months."""
    cutoff = TODAY - timedelta(days=months * 30)
    encounters = data_loader.get_encounters(patient_id)
    count = 0
    for enc in encounters:
        enc_date = _parse_date(enc.get("encounter_date"))
        if not enc_date:
            continue
        if enc_date >= cutoff and enc.get("encounter_type", "").lower() == "emergency":
            count += 1
    return count


def _get_patient_chronic_codes(patient_id: str) -> set[str]:
    """Return set of diagnosis codes from the patient's encounter history."""
    encounters = data_loader.get_encounters(patient_id)
    codes: set[str] = set()
    for enc in encounters:
        code = enc.get("diagnosis_code", "")
        if code:
            codes.add(code)
    return codes


def _symptom_matches_chronic(symptoms: list[str], chronic_codes: set[str]) -> list[str]:
    """Return list of chronic conditions whose symptoms overlap with reported symptoms."""
    matched_conditions: list[str] = []
    symptoms_lower = [s.lower() for s in symptoms]
    joined = " ".join(symptoms_lower)

    for code, related_symptoms in CHRONIC_CONDITION_SYMPTOM_MAP.items():
        if code not in chronic_codes:
            continue
        for kw in related_symptoms:
            if kw in joined:
                matched_conditions.append(code)
                break

    return matched_conditions


# ---------------------------------------------------------------------------
# Main triage function
# ---------------------------------------------------------------------------

def assess_urgency(patient_id: str, symptoms: list[str]) -> TriageResult:
    """Assess urgency from symptoms and patient history.

    Returns a TriageResult with urgency level, reasoning, and recommended action.
    """
    symptoms_lower = [s.lower() for s in symptoms]
    joined = " ".join(symptoms_lower)

    # --- Check emergency keywords ---
    for kw in EMERGENCY_KEYWORDS:
        if kw in joined:
            return TriageResult(
                urgency="emergency",
                reasoning=f"Symptom '{kw}' indicates a potential emergency requiring immediate attention.",
                recommended_action="Call 911 or go to nearest ER immediately.",
                recommended_care_level="emergency",
            )

    # --- Check urgent keywords ---
    for kw in URGENT_KEYWORDS:
        if kw in joined:
            return TriageResult(
                urgency="urgent",
                reasoning=f"Symptom '{kw}' requires prompt medical evaluation today.",
                recommended_action="Go to urgent care or ER today.",
                recommended_care_level="urgent_care",
            )

    # --- Check chronic condition relevance ---
    chronic_codes = _get_patient_chronic_codes(patient_id)
    matched_conditions = _symptom_matches_chronic(symptoms, chronic_codes)

    # Start with base urgency
    urgency = "routine"
    reasoning_parts: list[str] = []
    action = "Schedule an appointment with your primary care provider."
    care_level = "primary_care"

    if matched_conditions:
        urgency = "semi-urgent"
        reasoning_parts.append(
            f"Reported symptoms may relate to existing conditions "
            f"({', '.join(matched_conditions)}). Recommend follow-up within 2-3 days."
        )
        action = "See your doctor within 2-3 days."
        care_level = "primary_care"
    else:
        reasoning_parts.append(
            "Symptoms do not indicate an emergency or urgent situation based on available information."
        )

    # --- ER frequency bump ---
    er_count = _count_recent_er_visits(patient_id, months=6)
    if er_count >= 3:
        reasoning_parts.append(
            f"Patient has {er_count} ER visits in the past 6 months, indicating potential "
            f"escalation pattern. Urgency bumped up one level."
        )
        if urgency == "routine":
            urgency = "semi-urgent"
            action = "See your doctor within 2-3 days."
            care_level = "primary_care"
        elif urgency == "semi-urgent":
            urgency = "urgent"
            action = "Go to urgent care or ER today."
            care_level = "urgent_care"

    return TriageResult(
        urgency=urgency,
        reasoning=" ".join(reasoning_parts),
        recommended_action=action,
        recommended_care_level=care_level,
    )
