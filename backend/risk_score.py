"""Risk score computation for a patient based on session delta data."""

from __future__ import annotations

from .models import RiskScore
from .session_delta import (
    compute_lab_trajectories,
    compute_vital_trajectories,
    detect_care_gaps,
    detect_medication_alerts,
)


def compute_risk_score(patient_id: str) -> RiskScore:
    """Compute a risk score for a patient.

    Scoring:
        +3 per care gap with severity="urgent"
        +1 per care gap with severity="warning"
        +3 per spiking lab trajectory
        +2 per worsening lab or vital trajectory
        +2 per medication duplication
        +2 per temporal correlation
        +1 per expiring medication

    Levels: 0-2 = "good", 3-6 = "watch", 7+ = "at-risk"
    """
    score = 0
    factors: list[str] = []

    # Care gaps
    care_gaps = detect_care_gaps(patient_id)
    for gap in care_gaps:
        if gap.severity == "urgent":
            score += 3
            factors.append(f"Urgent care gap: {gap.required_test} for {gap.condition}")
        elif gap.severity == "warning":
            score += 1
            factors.append(f"Overdue: {gap.required_test} for {gap.condition}")

    # Lab trajectories
    lab_trajectories = compute_lab_trajectories(patient_id)
    for traj in lab_trajectories:
        if traj.trend == "spiking":
            score += 3
            factors.append(f"Spiking lab: {traj.test_name} ({traj.latest_value} {traj.unit})")
        elif traj.trend == "worsening":
            score += 2
            factors.append(f"Worsening lab: {traj.test_name} ({traj.trend})")

    # Vital trajectories
    vital_trajectories = compute_vital_trajectories(patient_id)
    for traj in vital_trajectories:
        if traj.trend == "worsening":
            score += 2
            factors.append(f"Worsening vital: {traj.vital_name} ({traj.trend})")

    # Medication alerts
    med_alerts = detect_medication_alerts(patient_id)
    for dup in med_alerts.duplications:
        score += 2
        factors.append(f"Duplicate {dup.drug_class}: {', '.join(dup.drugs)}")
    for tc in med_alerts.temporal_correlations:
        score += 2
        factors.append(f"Possible side effect: {tc.drug_name} -> {tc.symptom}")
    for exp in med_alerts.expiring:
        score += 1
        factors.append(f"Expiring medication: {exp.drug_name} in {exp.days_remaining} days")

    # Determine level
    if score >= 7:
        level = "at-risk"
    elif score >= 3:
        level = "watch"
    else:
        level = "good"

    return RiskScore(score=score, level=level, factors=factors)
