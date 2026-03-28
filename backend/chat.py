"""AI Health Assistant chat handler using the Anthropic API.

Provides a patient-facing conversational interface grounded in the patient's
actual health data from the session delta engine.
"""

from __future__ import annotations

import os
import time
from collections import defaultdict

from .session_delta import compute_full_delta
from .templates import (
    _FRIENDLY_LAB_NAMES,
    render_medication_for_patient,
)
from .medication_rules import get_drug_purpose
from .models import ChatMessage, ChatRequest, ChatResponse


# ---------------------------------------------------------------------------
# Rate limiting (in-memory, per patient)
# ---------------------------------------------------------------------------

_rate_limit_store: dict[str, list[float]] = defaultdict(list)
_RATE_LIMIT_WINDOW = 60.0  # seconds
_RATE_LIMIT_MAX = 10  # requests per window


def _check_rate_limit(patient_id: str) -> bool:
    """Return True if request is allowed, False if rate-limited."""
    now = time.monotonic()
    timestamps = _rate_limit_store[patient_id]
    # Prune old timestamps outside the window
    _rate_limit_store[patient_id] = [t for t in timestamps if now - t < _RATE_LIMIT_WINDOW]
    if len(_rate_limit_store[patient_id]) >= _RATE_LIMIT_MAX:
        return False
    _rate_limit_store[patient_id].append(now)
    return True


# ---------------------------------------------------------------------------
# Context builder
# ---------------------------------------------------------------------------

def _build_patient_context(patient_id: str) -> str:
    """Build a structured plain-text context block from the patient's session delta."""
    try:
        delta = compute_full_delta(patient_id)
    except ValueError:
        return "No patient data available."

    lines: list[str] = []
    patient = delta.patient

    # --- Patient demographics ---
    lines.append(f"PATIENT: {patient.first_name} {patient.last_name}, age {patient.age}, {patient.sex}")
    lines.append(f"Language preference: {patient.primary_language}")
    lines.append("")

    # --- Active medications ---
    from . import data_loader
    raw_meds = data_loader.get_medications(patient_id)
    active_meds = [m for m in raw_meds if m.get("active") == "True"]
    if active_meds:
        lines.append("ACTIVE MEDICATIONS:")
        for m in active_meds:
            purpose = get_drug_purpose(m["drug_name"])
            dosage = m.get("dosage", "")
            freq = m.get("frequency", "")
            end_date = m.get("end_date", "")
            end_str = f", expires {end_date}" if end_date else ""
            lines.append(f"  - {m['drug_name']} {dosage} {freq} ({purpose}){end_str}")
        lines.append("")

    # --- Lab trajectories (non-stable / abnormal only to keep context tight) ---
    notable_labs = [
        t for t in delta.lab_trajectories
        if t.trend != "stable" or t.current_status != "normal"
    ]
    if notable_labs:
        lines.append("NOTABLE LAB RESULTS (non-stable or abnormal):")
        for traj in notable_labs:
            friendly = _FRIENDLY_LAB_NAMES.get(traj.test_name, traj.test_name)
            ref = f"(normal {traj.reference_range_low}–{traj.reference_range_high} {traj.unit})"
            values_summary = " → ".join(
                f"{dp.value}"
                for dp in traj.values[-5:]  # last 5 readings
            )
            lines.append(
                f"  - {friendly}: {values_summary} {traj.unit} | trend: {traj.trend} | "
                f"status: {traj.current_status} {ref}"
            )
        lines.append("")

    # --- Medication alerts ---
    alerts = delta.medication_alerts
    if alerts.duplications:
        lines.append("MEDICATION CONCERNS:")
        for dup in alerts.duplications:
            lines.append(f"  - Duplicate drug class ({dup.drug_class}): {', '.join(dup.drugs)}")
    if alerts.temporal_correlations:
        for tc in alerts.temporal_correlations:
            lines.append(
                f"  - Possible side effect: {tc.drug_name} started {tc.drug_started} "
                f"→ {tc.symptom} noted {tc.symptom_date} ({tc.mechanism})"
            )
    if alerts.expiring:
        for exp in alerts.expiring:
            lines.append(f"  - Expiring soon: {exp.drug_name} in {exp.days_remaining} days")
    if alerts.duplications or alerts.temporal_correlations or alerts.expiring:
        lines.append("")

    # --- Care gaps ---
    if delta.care_gaps:
        lines.append("CARE GAPS (overdue monitoring):")
        for gap in delta.care_gaps:
            overdue = f"{gap.months_overdue} months overdue" if gap.months_overdue else "never done"
            lines.append(
                f"  - {gap.condition}: {gap.required_test} — {overdue} "
                f"(recommended every {gap.frequency_months} months)"
            )
        lines.append("")

    # --- Recent encounters (last 5) ---
    if delta.recent_encounters:
        lines.append("RECENT VISITS (most recent first):")
        for enc in delta.recent_encounters[:5]:
            lines.append(
                f"  - {enc.encounter_date} at {enc.facility}: "
                f"{enc.chief_complaint} → {enc.diagnosis_description}"
            )
        lines.append("")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT_TEMPLATE = """\
You are HealthSync, a warm and caring AI health assistant helping a patient understand their health records.

TODAY'S DATE: 2026-03-28

PATIENT HEALTH DATA:
{patient_context}

YOUR ROLE AND RULES:
1. Speak in plain, friendly language — avoid medical jargon or explain it simply.
2. NEVER diagnose the patient or recommend specific treatments, medications, or dosages.
3. NEVER say "you have [condition]" — instead say "your records show..." or "your provider has noted..."
4. Only reference information that appears in the patient data above.
5. If a question is outside your data or requires medical judgment, say so clearly and encourage them to speak with their healthcare provider.
6. Be warm, empathetic, and non-alarmist. Acknowledge concerns before explaining.
7. Keep responses concise — 2-3 paragraphs maximum. Do not dump all data at once.
8. At the end of every response, include EXACTLY 2-3 suggested follow-up questions formatted as:

SUGGESTED_QUESTIONS:
- [question 1]
- [question 2]
- [question 3]

These should be natural next questions the patient might have based on the conversation.

IMPORTANT: You are not a replacement for professional medical advice. For urgent symptoms (chest pain, difficulty breathing, severe pain), always direct the patient to seek immediate care.
"""


# ---------------------------------------------------------------------------
# Main chat handler
# ---------------------------------------------------------------------------

def handle_patient_chat(
    patient_id: str,
    request: ChatRequest,
) -> ChatResponse:
    """Process a patient chat message and return an AI response with suggested questions."""

    # Rate limiting
    if not _check_rate_limit(patient_id):
        return ChatResponse(
            response=(
                "You've sent a lot of messages in a short time. "
                "Please wait a moment before sending another message."
            ),
            suggested_questions=[
                "What do my recent lab results mean?",
                "What medications am I currently taking?",
                "Do I have any overdue health checks?",
            ],
        )

    # Check for API key
    api_key = os.environ.get("CLAUDE_API_KEY")
    if not api_key:
        return ChatResponse(
            response=(
                "I'm unable to connect to the AI assistant right now because the service "
                "is not configured. Please contact your healthcare provider directly for "
                "any questions about your health records."
            ),
            suggested_questions=[
                "What do my recent lab results mean?",
                "What medications am I currently taking?",
                "Do I have any overdue health checks?",
            ],
            relevant_metrics=_detect_relevant_metrics(request.message),
        )

    # Build system prompt with patient context
    try:
        patient_context = _build_patient_context(patient_id)
    except Exception:
        patient_context = "Patient data is currently unavailable."

    system_prompt = _SYSTEM_PROMPT_TEMPLATE.format(patient_context=patient_context)

    # Build message list for the API
    messages: list[dict] = []
    for msg in request.conversation_history:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": request.message})

    # Call the Anthropic API
    try:
        import anthropic

        client = anthropic.Anthropic(api_key=api_key)
        api_response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=500,
            system=system_prompt,
            messages=messages,
        )

        raw_text: str = api_response.content[0].text

    except ImportError:
        return ChatResponse(
            response=(
                "The AI assistant library is not installed. "
                "Please contact support to resolve this configuration issue."
            ),
            suggested_questions=[
                "What do my recent lab results mean?",
                "What medications am I currently taking?",
                "Do I have any overdue health checks?",
            ],
            relevant_metrics=_detect_relevant_metrics(request.message),
        )
    except Exception as exc:
        # Log but don't expose internal errors to the patient
        error_msg = str(exc)
        print(f"[chat] Anthropic API error for patient {patient_id}: {exc}")
        return ChatResponse(
            response=(
                f"I'm sorry, I'm having trouble connecting right now. Please try again in a moment. ERROR DETAILS: {error_msg}"
            ),
            suggested_questions=[
                "What do my recent lab results mean?",
                "What medications am I currently taking?",
                "Do I have any overdue health checks?",
            ],
            relevant_metrics=_detect_relevant_metrics(request.message),
        )

    # Parse out the suggested questions from the response
    response_text, suggested_questions = _parse_response(raw_text)

    # Detect relevant metrics based on the user's message
    relevant_metrics = _detect_relevant_metrics(request.message)

    return ChatResponse(
        response=response_text,
        suggested_questions=suggested_questions,
        relevant_metrics=relevant_metrics,
    )


def _parse_response(raw_text: str) -> tuple[str, list[str]]:
    """Split the AI response into the main text and suggested questions."""
    suggested_questions: list[str] = []

    marker = "SUGGESTED_QUESTIONS:"
    if marker in raw_text:
        parts = raw_text.split(marker, 1)
        response_text = parts[0].strip()
        questions_block = parts[1].strip()

        for line in questions_block.splitlines():
            line = line.strip()
            if line.startswith("- "):
                q = line[2:].strip()
                if q:
                    suggested_questions.append(q)
    else:
        response_text = raw_text.strip()

    # Fallback questions if parsing yielded nothing
    if not suggested_questions:
        suggested_questions = [
            "What do my recent lab results mean?",
            "What medications am I currently taking?",
            "Do I have any upcoming health checks due?",
        ]

    return response_text, suggested_questions[:3]


# ---------------------------------------------------------------------------
# Relevant metrics detection
# ---------------------------------------------------------------------------

_METRIC_KEYWORDS: dict[str, list[str]] = {
    "HbA1c": ["blood sugar", "diabetes", "glucose", "hba1c", "a1c"],
    "Fasting Glucose": ["blood sugar", "diabetes", "glucose", "fasting glucose"],
    "Systolic BP": ["blood pressure", "hypertension", "bp"],
    "Diastolic BP": ["blood pressure", "hypertension", "bp"],
    "Total Cholesterol": ["cholesterol", "heart", "lipid"],
    "LDL": ["cholesterol", "heart", "lipid"],
    "HDL": ["cholesterol", "heart", "lipid"],
    "Creatinine": ["kidney", "renal"],
    "Potassium": ["kidney", "renal"],
    "TSH": ["thyroid"],
    "medications": ["medication", "prescription", "drug"],
}


def _detect_relevant_metrics(message: str) -> list[str]:
    """Return metric names relevant to the user's message based on keyword matching."""
    lower = message.lower()
    metrics: list[str] = []
    for metric, keywords in _METRIC_KEYWORDS.items():
        if any(kw in lower for kw in keywords):
            if metric not in metrics:
                metrics.append(metric)
    return metrics
