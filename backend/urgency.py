"""Urgency classification for a patient: red / yellow / green."""

from __future__ import annotations

from .models import UrgencyClassification
from .risk_score import compute_risk_score
from .session_delta import (
    compute_lab_trajectories,
    compute_vital_trajectories,
    detect_care_gaps,
    detect_medication_alerts,
)


def classify_urgency(patient_id: str) -> UrgencyClassification:
    """Classify per-patient urgency.

    Red ("now"):
        - Any spiking lab with abnormal status
        - Any care gap with months_overdue > 12
        - Risk score level "at-risk"

    Yellow ("days"):
        - Any worsening trajectory (lab or vital)
        - Any care gap with severity "urgent"
        - Risk level "watch"
        - Expiring medication within 7 days

    Green ("months"):
        - Everything else
    """
    reasons: list[str] = []
    level = "green"

    risk = compute_risk_score(patient_id)
    lab_trajectories = compute_lab_trajectories(patient_id)
    vital_trajectories = compute_vital_trajectories(patient_id)
    care_gaps = detect_care_gaps(patient_id)
    med_alerts = detect_medication_alerts(patient_id)

    # --- Red checks ---

    # Spiking lab with abnormal status
    for traj in lab_trajectories:
        if traj.trend == "spiking" and traj.current_status != "normal":
            reasons.append(f"Spiking abnormal lab: {traj.test_name} at {traj.latest_value} {traj.unit}")
            level = "red"

    # Care gap with months_overdue > 12
    for gap in care_gaps:
        if gap.months_overdue is not None and gap.months_overdue > 12:
            reasons.append(f"Severely overdue: {gap.required_test} for {gap.condition} ({gap.months_overdue:.0f} months overdue)")
            level = "red"

    # Risk score at-risk
    if risk.level == "at-risk":
        reasons.append(f"High risk score ({risk.score})")
        level = "red"

    # --- Yellow checks (only if not already red) ---

    if level != "red":
        # Worsening trajectories
        for traj in lab_trajectories:
            if traj.trend == "worsening":
                reasons.append(f"Worsening lab: {traj.test_name}")
                if level != "yellow":
                    level = "yellow"

        for traj in vital_trajectories:
            if traj.trend == "worsening":
                reasons.append(f"Worsening vital: {traj.vital_name}")
                if level != "yellow":
                    level = "yellow"

        # Urgent care gaps
        for gap in care_gaps:
            if gap.severity == "urgent":
                reasons.append(f"Urgent care gap: {gap.required_test} for {gap.condition}")
                if level != "yellow":
                    level = "yellow"

        # Risk level watch
        if risk.level == "watch":
            reasons.append(f"Elevated risk score ({risk.score})")
            if level != "yellow":
                level = "yellow"

        # Expiring medication within 7 days
        for exp in med_alerts.expiring:
            if exp.days_remaining <= 7:
                reasons.append(f"Medication expiring soon: {exp.drug_name} in {exp.days_remaining} days")
                if level != "yellow":
                    level = "yellow"

    # --- Label ---

    if level == "red":
        label = "Need to see now"
    elif level == "yellow":
        label = "Need to see in days"
    else:
        label = "Can see in months"
        if not reasons:
            reasons.append("No urgent concerns identified")

    return UrgencyClassification(level=level, label=label, reasons=reasons)
