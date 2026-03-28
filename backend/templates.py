"""Convert structured session delta output to patient-friendly plain language.

No LLM -- pure template-based rendering. Supports English with basic
French, Mandarin, and Punjabi fallback for key phrases.
"""

from __future__ import annotations

from .models import (
    AlertItem,
    CareGap,
    Encounter,
    LabTrajectory,
    MedicationAlerts,
    PatientSummary,
    SessionDelta,
)
from .medication_rules import get_drug_purpose, get_class_display_name


# ---------------------------------------------------------------------------
# Friendly lab-test name mapping
# ---------------------------------------------------------------------------

_FRIENDLY_LAB_NAMES: dict[str, str] = {
    "HbA1c": "blood sugar levels (long-term)",
    "Fasting Glucose": "blood sugar levels",
    "Total Cholesterol": "cholesterol levels",
    "LDL Cholesterol": "bad cholesterol (LDL)",
    "HDL Cholesterol": "good cholesterol (HDL)",
    "TSH": "thyroid levels",
    "Creatinine": "kidney function",
    "Hemoglobin": "blood iron levels",
    "Sodium": "sodium levels",
    "Potassium": "potassium levels",
    "White Blood Cell Count": "white blood cell count",
    "Platelet Count": "platelet count",
}

_FRIENDLY_CONDITION_NAMES: dict[str, str] = {
    "E11.9": "diabetes",
    "E11.0": "diabetes",
    "E10.9": "diabetes",
    "I10": "high blood pressure",
    "F32.9": "depression",
    "F33.0": "depression",
    "E78.5": "high cholesterol",
    "E78.0": "high cholesterol",
    "E03.9": "thyroid condition",
    "N18.3": "kidney disease",
    "I48.91": "irregular heartbeat",
    "J45.20": "asthma",
    "J45.50": "asthma",
    "K21.0": "acid reflux",
}

# ---------------------------------------------------------------------------
# Multi-language phrase tables (basic coverage)
# ---------------------------------------------------------------------------

_PHRASES: dict[str, dict[str, str]] = {
    "fr": {
        "rising": "Vos {name} ont augmente lors de vos {n} derniers tests. Votre resultat le plus recent etait {value} {unit}.",
        "improving": "Vos {name} se sont ameliores. Votre resultat le plus recent etait {value} {unit}.",
        "stable_abnormal": "Vos {name} sont constamment hors de la plage normale a {value} {unit}.",
        "due_for": "Vous devez passer un(e) {test}. Cela fait {months} mois depuis le dernier.",
        "overdue_for": "Vous etes en retard pour un(e) {test}. Cela fait {months} mois -- c'est important pour gerer votre {condition}.",
        "duplicate_meds": "Vous prenez deux medicaments qui font la meme chose: {drug1} et {drug2} (les deux sont des {cls}).",
        "side_effect": "Votre {symptom} pourrait etre lie a {drug}, que vous avez commence le {date}. C'est un effet secondaire connu.",
        "expiring_med": "Votre ordonnance de {drug} ({purpose}) expire dans {days} jours.",
    },
    "zh": {
        "rising": "您的{name}在最近{n}次检测中持续上升。最近一次结果为 {value} {unit}。",
        "improving": "您的{name}正在改善。最近一次结果为 {value} {unit}。",
        "stable_abnormal": "您的{name}持续超出正常范围，为 {value} {unit}。",
        "due_for": "您需要做一次{test}检查。距离上次已有{months}个月。",
        "overdue_for": "您的{test}检查已过期。距离上次已有{months}个月——这对管理您的{condition}很重要。",
        "duplicate_meds": "您正在服用两种功效相同的药物：{drug1}和{drug2}（均为{cls}）。",
        "side_effect": "您的{symptom}可能与{drug}有关，您于{date}开始服用。这是已知的副作用。",
        "expiring_med": "您的{drug}（{purpose}）处方将在{days}天后到期。",
    },
    "pa": {
        "rising": "ਤੁਹਾਡੇ {name} ਪਿਛਲੇ {n} ਟੈਸਟਾਂ ਵਿੱਚ ਵਧ ਰਹੇ ਹਨ। ਸਭ ਤੋਂ ਤਾਜ਼ਾ ਨਤੀਜਾ {value} {unit} ਸੀ।",
        "improving": "ਤੁਹਾਡੇ {name} ਵਿੱਚ ਸੁਧਾਰ ਹੋ ਰਿਹਾ ਹੈ। ਸਭ ਤੋਂ ਤਾਜ਼ਾ ਨਤੀਜਾ {value} {unit} ਸੀ।",
        "stable_abnormal": "ਤੁਹਾਡੇ {name} ਲਗਾਤਾਰ ਸਾਧਾਰਨ ਸੀਮਾ ਤੋਂ ਬਾਹਰ ਹਨ, {value} {unit}।",
        "due_for": "ਤੁਹਾਨੂੰ {test} ਦੀ ਲੋੜ ਹੈ। ਪਿਛਲੇ ਤੋਂ {months} ਮਹੀਨੇ ਹੋ ਗਏ ਹਨ।",
        "overdue_for": "ਤੁਹਾਡਾ {test} ਬਕਾਇਆ ਹੈ। {months} ਮਹੀਨੇ ਹੋ ਗਏ ਹਨ — ਤੁਹਾਡੀ {condition} ਲਈ ਇਹ ਜ਼ਰੂਰੀ ਹੈ।",
        "duplicate_meds": "ਤੁਸੀਂ ਇੱਕੋ ਕੰਮ ਕਰਨ ਵਾਲੀਆਂ ਦੋ ਦਵਾਈਆਂ ਲੈ ਰਹੇ ਹੋ: {drug1} ਅਤੇ {drug2} ({cls})।",
        "side_effect": "ਤੁਹਾਡਾ {symptom} {drug} ਨਾਲ ਸੰਬੰਧਿਤ ਹੋ ਸਕਦਾ ਹੈ, ਜੋ ਤੁਸੀਂ {date} ਨੂੰ ਸ਼ੁਰੂ ਕੀਤਾ ਸੀ।",
        "expiring_med": "ਤੁਹਾਡੀ {drug} ({purpose}) ਦੀ ਨੁਸਖ਼ਾ {days} ਦਿਨਾਂ ਵਿੱਚ ਖ਼ਤਮ ਹੋ ਜਾਵੇਗੀ।",
    },
}

# Map primary_language field values to phrase-table keys
_LANG_MAP: dict[str, str] = {
    "en": "en",
    "english": "en",
    "fr": "fr",
    "french": "fr",
    "zh": "zh",
    "mandarin": "zh",
    "pa": "pa",
    "punjabi": "pa",
}


def _resolve_lang(language: str) -> str:
    return _LANG_MAP.get(language.lower().strip(), "en")


def _friendly_lab(test_name: str) -> str:
    return _FRIENDLY_LAB_NAMES.get(test_name, test_name.lower())


def _friendly_condition(code: str) -> str:
    return _FRIENDLY_CONDITION_NAMES.get(code, code)


def _t(lang: str, key: str, **kwargs: object) -> str | None:
    """Look up a translated template. Returns None if lang is English or missing."""
    phrases = _PHRASES.get(lang)
    if phrases is None:
        return None
    template = phrases.get(key)
    if template is None:
        return None
    return template.format(**kwargs)


# ---------------------------------------------------------------------------
# Renderers
# ---------------------------------------------------------------------------


def render_lab_alert(trajectory: LabTrajectory, language: str = "en") -> AlertItem:
    """Convert a LabTrajectory into a patient-friendly AlertItem."""
    lang = _resolve_lang(language)
    friendly = _friendly_lab(trajectory.test_name)
    n = len(trajectory.values)
    value = trajectory.latest_value
    unit = trajectory.unit

    # Determine description
    if trajectory.trend in ("worsening", "spiking"):
        desc = _t(lang, "rising", name=friendly, n=n, value=value, unit=unit)
        if desc is None:
            desc = (
                f"Your {friendly} have been rising over your last {n} tests. "
                f"Your most recent result was {value} {unit}."
            )
    elif trajectory.trend == "improving":
        desc = _t(lang, "improving", name=friendly, value=value, unit=unit)
        if desc is None:
            desc = (
                f"Your {friendly} have been improving. "
                f"Your most recent result was {value} {unit}."
            )
    else:
        # stable
        if trajectory.current_status != "normal":
            desc = _t(lang, "stable_abnormal", name=friendly, value=value, unit=unit)
            if desc is None:
                desc = (
                    f"Your {friendly} have been consistently outside the normal range "
                    f"at {value} {unit}."
                )
        else:
            desc = (
                f"Your {friendly} are stable and within normal range at {value} {unit}."
            )

    # Severity
    if trajectory.trend == "spiking":
        severity = "urgent"
    elif trajectory.trend == "worsening":
        severity = "warning"
    else:
        severity = "info"

    title = f"{trajectory.test_name}: {trajectory.trend}"

    return AlertItem(
        category="lab_trend",
        severity=severity,
        title=title,
        description=desc,
        details={
            "test_name": trajectory.test_name,
            "latest_value": trajectory.latest_value,
            "earliest_value": trajectory.earliest_value,
            "change_percent": trajectory.change_percent,
            "unit": trajectory.unit,
            "reference_range": f"{trajectory.reference_range_low}-{trajectory.reference_range_high}",
            "current_status": trajectory.current_status,
            "data_points": len(trajectory.values),
        },
    )


def render_medication_alert(
    alert_data: MedicationAlerts, language: str = "en"
) -> list[AlertItem]:
    """Convert MedicationAlerts into a list of patient-friendly AlertItems."""
    lang = _resolve_lang(language)
    items: list[AlertItem] = []

    # Duplications
    for dup in alert_data.duplications:
        class_name = get_class_display_name(dup.drug_class)
        drugs = dup.drugs
        if len(drugs) >= 2:
            drug1, drug2 = drugs[0], drugs[1]
        else:
            drug1 = drugs[0] if drugs else "unknown"
            drug2 = "unknown"

        desc = _t(lang, "duplicate_meds", drug1=drug1, drug2=drug2, cls=class_name)
        if desc is None:
            desc = (
                f"You are taking two medications that do the same thing: "
                f"{drug1} and {drug2} (both {class_name})."
            )

        items.append(AlertItem(
            category="medication",
            severity="warning",
            title=f"Duplicate medications: {drug1} & {drug2}",
            description=desc,
            details={"drug_class": dup.drug_class, "drugs": drugs},
        ))

    # Temporal correlations
    for tc in alert_data.temporal_correlations:
        desc = _t(
            lang, "side_effect",
            symptom=tc.symptom, drug=tc.drug_name, date=tc.drug_started,
        )
        if desc is None:
            desc = (
                f"Your {tc.symptom} may be related to {tc.drug_name}, which you "
                f"started on {tc.drug_started}. This is a known possible side effect."
            )

        items.append(AlertItem(
            category="medication",
            severity="info",
            title=f"Possible side effect: {tc.drug_name} and {tc.symptom}",
            description=desc,
            details={
                "drug_name": tc.drug_name,
                "drug_started": tc.drug_started,
                "symptom": tc.symptom,
                "mechanism": tc.mechanism,
            },
        ))

    # Expiring medications
    for exp in alert_data.expiring:
        purpose = get_drug_purpose(exp.drug_name)
        sev = "urgent" if exp.days_remaining <= 7 else "warning"

        desc = _t(
            lang, "expiring_med",
            drug=exp.drug_name, purpose=purpose, days=exp.days_remaining,
        )
        if desc is None:
            desc = (
                f"Your prescription for {exp.drug_name} ({purpose}) "
                f"expires in {exp.days_remaining} days."
            )

        items.append(AlertItem(
            category="medication",
            severity=sev,
            title=f"Expiring prescription: {exp.drug_name}",
            description=desc,
            details={
                "drug_name": exp.drug_name,
                "end_date": exp.end_date,
                "days_remaining": exp.days_remaining,
            },
        ))

    return items


def render_care_gap_alert(care_gap: CareGap, language: str = "en") -> AlertItem:
    """Convert a CareGap into a patient-friendly AlertItem."""
    lang = _resolve_lang(language)
    test_friendly = _FRIENDLY_LAB_NAMES.get(care_gap.required_test, care_gap.required_test.lower())
    condition_friendly = _friendly_condition(care_gap.diagnosis_code)
    months = int(care_gap.months_overdue) if care_gap.months_overdue is not None else 0

    if care_gap.severity == "urgent":
        desc = _t(
            lang, "overdue_for",
            test=test_friendly, months=months, condition=condition_friendly,
        )
        if desc is None:
            desc = (
                f"You're overdue for a {test_friendly}. "
                f"It's been {months} months -- this is important for managing "
                f"your {condition_friendly}."
            )
    else:
        desc = _t(lang, "due_for", test=test_friendly, months=months)
        if desc is None:
            desc = (
                f"You're due for a {test_friendly}. "
                f"It's been {months} months since your last one."
            )

    return AlertItem(
        category="care_gap",
        severity=care_gap.severity,
        title=f"{'Overdue' if care_gap.severity == 'urgent' else 'Due'}: {care_gap.required_test}",
        description=desc,
        details={
            "condition": care_gap.condition,
            "diagnosis_code": care_gap.diagnosis_code,
            "required_test": care_gap.required_test,
            "frequency_months": care_gap.frequency_months,
            "last_test_date": care_gap.last_test_date,
            "months_overdue": care_gap.months_overdue,
        },
    )


def render_medication_for_patient(med: dict, language: str = "en") -> dict:
    """Convert a raw medication dict into patient-friendly representation."""
    drug_name = med.get("drug_name", "")
    purpose = get_drug_purpose(drug_name)

    return {
        "name": drug_name,
        "purpose": purpose,
        "dosage": med.get("dosage", ""),
        "frequency": med.get("frequency", ""),
        "active": med.get("active", "False") == "True",
        "clinical_details": {
            "drug_code": med.get("drug_code", ""),
            "prescriber": med.get("prescriber", ""),
            "start_date": med.get("start_date", ""),
            "end_date": med.get("end_date"),
            "route": med.get("route", ""),
        },
    }


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

_SEVERITY_ORDER = {"urgent": 0, "warning": 1, "info": 2}


def generate_patient_summary(
    delta: SessionDelta, language: str = "en"
) -> PatientSummary:
    """Take a full SessionDelta and produce a patient-facing summary.

    Converts all structured clinical data into plain-language alerts,
    sorts by severity (urgent first), and assembles the PatientSummary.
    """
    alerts: list[AlertItem] = []

    # Lab trajectory alerts
    for traj in delta.lab_trajectories:
        alerts.append(render_lab_alert(traj, language))

    # Medication alerts
    alerts.extend(render_medication_alert(delta.medication_alerts, language))

    # Care gap alerts
    for gap in delta.care_gaps:
        alerts.append(render_care_gap_alert(gap, language))

    # Sort: urgent first, then warning, then info
    alerts.sort(key=lambda a: _SEVERITY_ORDER.get(a.severity, 99))

    # Build active-medication list for patient view
    active_meds: list[dict] = []
    # Cross-facility meds provide a simpler dict; include them as active
    for cfm in delta.medication_alerts.cross_facility:
        active_meds.append(render_medication_for_patient({
            "drug_name": cfm.drug_name,
            "prescriber": cfm.prescriber,
            "start_date": cfm.start_date,
            "active": "True",
        }, language))

    return PatientSummary(
        patient=delta.patient,
        alerts=alerts,
        active_medications=active_meds,
        recent_encounters=delta.recent_encounters[:10],
    )
