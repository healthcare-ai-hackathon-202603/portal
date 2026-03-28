"""Metric Relevance Agent — map symptoms/diagnoses to clinically relevant metrics."""

from __future__ import annotations

from collections import Counter

from .. import data_loader
from ..models import MetricRelevance


# ---------------------------------------------------------------------------
# Relevance mapping: keyword/code -> ordered list of relevant metrics
# ---------------------------------------------------------------------------

RELEVANCE_MAP: dict[str, list[str]] = {
    # Symptoms
    "headache": ["Systolic BP", "Diastolic BP", "Sodium", "Heart Rate"],
    "chest pain": ["Heart Rate", "Systolic BP", "Diastolic BP", "O2 Saturation", "Total Cholesterol", "LDL"],
    "fatigue": ["TSH", "HbA1c", "Fasting Glucose", "Heart Rate", "Hemoglobin"],
    "dizziness": ["Systolic BP", "Diastolic BP", "Heart Rate", "Fasting Glucose", "Sodium"],
    "nausea": ["Creatinine", "Potassium", "Sodium", "Fasting Glucose"],
    "shortness of breath": ["O2 Saturation", "Heart Rate", "Respiratory Rate", "Hemoglobin"],
    "swelling": ["Creatinine", "Potassium", "Sodium", "Systolic BP"],
    "weight gain": ["TSH", "Fasting Glucose", "HbA1c", "Total Cholesterol"],
    "blurred vision": ["Fasting Glucose", "HbA1c", "Systolic BP", "Diastolic BP"],
    "cough": ["O2 Saturation", "Respiratory Rate", "Heart Rate"],
    "fever": ["Heart Rate", "Respiratory Rate", "O2 Saturation"],
    "vomiting": ["Sodium", "Potassium", "Creatinine", "Fasting Glucose"],
    "muscle pain": ["Creatinine", "Potassium", "TSH"],
    "anxiety": ["Heart Rate", "Systolic BP", "TSH"],
    "insomnia": ["Heart Rate", "TSH"],
    "abdominal pain": ["Creatinine", "Potassium", "Sodium"],
    "palpitations": ["Heart Rate", "Systolic BP", "Diastolic BP", "Potassium", "TSH"],
    # Diagnosis codes
    "E11.9": ["HbA1c", "Fasting Glucose", "Creatinine", "Total Cholesterol", "LDL"],
    "I10": ["Systolic BP", "Diastolic BP", "Heart Rate", "Creatinine", "Potassium"],
    "F32.9": ["Heart Rate", "Systolic BP"],
    "E78.5": ["Total Cholesterol", "LDL", "HDL", "Triglycerides"],
    "E03.9": ["TSH"],
    "J45.20": ["O2 Saturation", "Respiratory Rate", "Heart Rate"],
    "N18.3": ["Creatinine", "Potassium", "Sodium"],
    "K21.0": ["Sodium", "Potassium"],
    "E11.0": ["HbA1c", "Fasting Glucose", "Creatinine"],
    "E78.0": ["Total Cholesterol", "LDL", "HDL", "Triglycerides"],
    "I48.91": ["Heart Rate", "Systolic BP", "Diastolic BP"],
}

# Metric names as they appear in lab_results.test_name and vitals columns
_VITAL_METRIC_TO_COLUMN: dict[str, str] = {
    "Systolic BP": "systolic_bp",
    "Diastolic BP": "diastolic_bp",
    "Heart Rate": "heart_rate",
    "O2 Saturation": "o2_saturation",
    "Respiratory Rate": "respiratory_rate",
}

_LAB_METRIC_ALIASES: dict[str, list[str]] = {
    "HbA1c": ["HbA1c", "Hemoglobin A1c"],
    "Fasting Glucose": ["Fasting Glucose", "Glucose, Fasting"],
    "Total Cholesterol": ["Total Cholesterol", "Cholesterol"],
    "LDL": ["LDL Cholesterol", "LDL", "Low-Density Lipoprotein"],
    "HDL": ["HDL Cholesterol", "HDL"],
    "Triglycerides": ["Triglycerides"],
    "TSH": ["TSH", "Thyroid Stimulating Hormone"],
    "Creatinine": ["Creatinine"],
    "Potassium": ["Potassium"],
    "Sodium": ["Sodium"],
    "Hemoglobin": ["Hemoglobin"],
}


# ---------------------------------------------------------------------------
# Public functions
# ---------------------------------------------------------------------------

def get_relevant_metrics(text: str) -> list[str]:
    """Parse text for symptom/diagnosis keywords and return ranked relevant metrics.

    Metrics are ranked by how many keyword matches reference them (frequency).
    """
    text_lower = text.lower()
    counter: Counter[str] = Counter()

    for keyword, metrics in RELEVANCE_MAP.items():
        # For diagnosis codes, match exactly (case-sensitive)
        if keyword[0].isupper() or keyword[0].isdigit():
            if keyword in text:
                for i, m in enumerate(metrics):
                    counter[m] += len(metrics) - i  # Weight by position
        else:
            if keyword in text_lower:
                for i, m in enumerate(metrics):
                    counter[m] += len(metrics) - i

    # Return sorted by score descending
    ranked = [metric for metric, _score in counter.most_common()]
    return ranked


def get_metrics_for_issue(diagnosis_code: str) -> list[str]:
    """Direct lookup of relevant metrics for a diagnosis code."""
    return RELEVANCE_MAP.get(diagnosis_code, [])


def get_metrics_for_patient_context(patient_id: str, text: str) -> list[str]:
    """Combine text-based relevance with patient's actual available data.

    Only returns metrics the patient actually has data for.
    """
    # Get all potentially relevant metrics from the text
    all_relevant = get_relevant_metrics(text)

    if not all_relevant:
        return []

    # Determine which metrics the patient actually has data for
    available_metrics: set[str] = set()

    # Check vitals
    vitals = data_loader.get_vitals(patient_id)
    if vitals:
        sample = vitals[0]
        for metric_name, col in _VITAL_METRIC_TO_COLUMN.items():
            if sample.get(col) is not None:
                available_metrics.add(metric_name)

    # Check labs
    labs = data_loader.get_labs(patient_id)
    lab_test_names: set[str] = set()
    for lab in labs:
        tn = lab.get("test_name", "")
        if tn:
            lab_test_names.add(tn)

    for metric_name, aliases in _LAB_METRIC_ALIASES.items():
        for alias in aliases:
            if alias in lab_test_names:
                available_metrics.add(metric_name)
                break

    # Filter to only available metrics, preserving rank order
    return [m for m in all_relevant if m in available_metrics]
