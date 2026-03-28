"""Diagnosis-to-monitoring requirement rules for care gap detection."""

# diagnosis_code → list of (required_test, frequency_months, description)
MONITORING_RULES: dict[str, list[tuple[str, int, str]]] = {
    # Type 2 Diabetes
    "E11.9": [
        ("HbA1c", 6, "Type 2 diabetes requires HbA1c monitoring every 3-6 months"),
        ("Fasting Glucose", 6, "Fasting glucose should be monitored with diabetes"),
        ("Creatinine", 12, "Annual kidney function check recommended for diabetes"),
    ],
    "E11.0": [
        ("HbA1c", 6, "Type 2 diabetes requires HbA1c monitoring every 3-6 months"),
    ],
    # Type 1 Diabetes
    "E10.9": [
        ("HbA1c", 3, "Type 1 diabetes requires HbA1c every 3 months"),
    ],
    # Essential Hypertension
    "I10": [
        ("BP_CHECK", 6, "Blood pressure should be monitored every 3-6 months"),
        ("Creatinine", 12, "Annual kidney function check for hypertension"),
    ],
    # Major Depressive Disorder
    "F32.9": [
        ("FOLLOW_UP", 2, "Follow-up within 4-8 weeks of medication change"),
    ],
    "F33.0": [
        ("FOLLOW_UP", 2, "Follow-up within 4-8 weeks of medication change"),
    ],
    # Hyperlipidemia
    "E78.5": [
        ("Total Cholesterol", 12, "Annual lipid panel recommended"),
        ("LDL Cholesterol", 12, "Annual LDL monitoring recommended"),
    ],
    "E78.0": [
        ("Total Cholesterol", 12, "Annual lipid panel recommended"),
        ("LDL Cholesterol", 12, "Annual LDL monitoring recommended"),
    ],
    # Hypothyroidism
    "E03.9": [
        ("TSH", 6, "TSH should be monitored every 6-12 months"),
    ],
    # Chronic kidney disease
    "N18.3": [
        ("Creatinine", 6, "Kidney function monitoring every 3-6 months"),
        ("Potassium", 6, "Electrolyte monitoring for CKD"),
    ],
    # Atrial fibrillation
    "I48.91": [
        ("INR", 1, "Monthly INR if on warfarin"),
    ],
    # Asthma
    "J45.20": [
        ("FOLLOW_UP", 6, "Asthma control assessment every 6 months"),
    ],
    "J45.50": [
        ("FOLLOW_UP", 3, "Severe asthma requires closer follow-up"),
    ],
    # GERD
    "K21.0": [
        ("FOLLOW_UP", 12, "Annual PPI review recommended"),
    ],
}

# Lab test name aliases for matching
TEST_NAME_ALIASES: dict[str, list[str]] = {
    "HbA1c": ["HbA1c", "Hemoglobin A1c", "Glycated Hemoglobin"],
    "Fasting Glucose": ["Fasting Glucose", "Glucose, Fasting", "FBG"],
    "Total Cholesterol": ["Total Cholesterol", "Cholesterol"],
    "LDL Cholesterol": ["LDL Cholesterol", "LDL", "Low-Density Lipoprotein"],
    "TSH": ["TSH", "Thyroid Stimulating Hormone"],
    "Creatinine": ["Creatinine"],
    "Potassium": ["Potassium"],
    "INR": ["INR", "International Normalized Ratio"],
    "Sodium": ["Sodium"],
}


def get_monitoring_rules(diagnosis_code: str) -> list[tuple[str, int, str]]:
    return MONITORING_RULES.get(diagnosis_code, [])


def get_test_aliases(test_name: str) -> list[str]:
    return TEST_NAME_ALIASES.get(test_name, [test_name])
