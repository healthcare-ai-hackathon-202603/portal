"""Drug class mappings, temporal correlation rules, and patient-facing descriptions."""

# Drug class lookup: drug_name (lowercase) → drug class
DRUG_CLASSES: dict[str, str] = {
    # PPIs
    "pantoprazole": "PPI",
    "omeprazole": "PPI",
    "esomeprazole": "PPI",
    "lansoprazole": "PPI",
    "rabeprazole": "PPI",
    # ACE Inhibitors
    "lisinopril": "ACE_INHIBITOR",
    "ramipril": "ACE_INHIBITOR",
    "enalapril": "ACE_INHIBITOR",
    "perindopril": "ACE_INHIBITOR",
    # ARBs
    "losartan": "ARB",
    "valsartan": "ARB",
    "candesartan": "ARB",
    "irbesartan": "ARB",
    # Statins
    "atorvastatin": "STATIN",
    "rosuvastatin": "STATIN",
    "simvastatin": "STATIN",
    "pravastatin": "STATIN",
    # SSRIs
    "escitalopram": "SSRI",
    "sertraline": "SSRI",
    "fluoxetine": "SSRI",
    "paroxetine": "SSRI",
    "citalopram": "SSRI",
    # Beta-blockers
    "metoprolol": "BETA_BLOCKER",
    "atenolol": "BETA_BLOCKER",
    "bisoprolol": "BETA_BLOCKER",
    "propranolol": "BETA_BLOCKER",
    "carvedilol": "BETA_BLOCKER",
    # Corticosteroids
    "prednisone": "CORTICOSTEROID",
    "prednisolone": "CORTICOSTEROID",
    "dexamethasone": "CORTICOSTEROID",
    "hydrocortisone": "CORTICOSTEROID",
    # Diabetes medications
    "metformin": "BIGUANIDE",
    "sitagliptin": "DPP4_INHIBITOR",
    "gliclazide": "SULFONYLUREA",
    "glipizide": "SULFONYLUREA",
    "insulin": "INSULIN",
    # Anticoagulants
    "warfarin": "ANTICOAGULANT",
    "apixaban": "ANTICOAGULANT",
    "rivaroxaban": "ANTICOAGULANT",
    # NSAIDs
    "ibuprofen": "NSAID",
    "naproxen": "NSAID",
    "celecoxib": "NSAID",
    "diclofenac": "NSAID",
    # Benzodiazepines
    "lorazepam": "BENZODIAZEPINE",
    "diazepam": "BENZODIAZEPINE",
    "clonazepam": "BENZODIAZEPINE",
    # Gabapentinoids
    "gabapentin": "GABAPENTINOID",
    "pregabalin": "GABAPENTINOID",
    # Calcium Channel Blockers
    "amlodipine": "CCB",
    "nifedipine": "CCB",
    "diltiazem": "CCB",
    # Thyroid
    "levothyroxine": "THYROID_HORMONE",
    # Opioids
    "morphine": "OPIOID",
    "hydromorphone": "OPIOID",
    "oxycodone": "OPIOID",
    "codeine": "OPIOID",
    "tramadol": "OPIOID",
}

# Class display names
DRUG_CLASS_NAMES: dict[str, str] = {
    "PPI": "Proton Pump Inhibitor",
    "ACE_INHIBITOR": "ACE Inhibitor",
    "ARB": "Angiotensin Receptor Blocker",
    "STATIN": "Statin",
    "SSRI": "SSRI Antidepressant",
    "BETA_BLOCKER": "Beta-Blocker",
    "CORTICOSTEROID": "Corticosteroid",
    "BIGUANIDE": "Diabetes Medication (Biguanide)",
    "DPP4_INHIBITOR": "Diabetes Medication (DPP-4 Inhibitor)",
    "SULFONYLUREA": "Diabetes Medication (Sulfonylurea)",
    "INSULIN": "Insulin",
    "ANTICOAGULANT": "Blood Thinner",
    "NSAID": "Anti-inflammatory (NSAID)",
    "BENZODIAZEPINE": "Benzodiazepine",
    "GABAPENTINOID": "Gabapentinoid",
    "CCB": "Calcium Channel Blocker",
    "THYROID_HORMONE": "Thyroid Hormone",
    "OPIOID": "Opioid Pain Medication",
}

# Temporal correlations: drug class → [(symptom keywords, mechanism, time_window_weeks)]
TEMPORAL_CORRELATIONS: dict[str, list[tuple[list[str], str, int]]] = {
    "ACE_INHIBITOR": [
        (["cough", "dry cough"], "ACE inhibitors can cause persistent dry cough via bradykinin accumulation", 12),
    ],
    "STATIN": [
        (["muscle pain", "joint pain", "myalgia"], "Statins can cause muscle pain (myalgia/myopathy)", 12),
    ],
    "CORTICOSTEROID": [
        (["glucose", "blood sugar", "diabetes"], "Corticosteroids elevate blood glucose by increasing insulin resistance", 8),
    ],
    "SSRI": [
        (["nausea", "vomiting"], "SSRIs commonly cause nausea via serotonin activity in the GI tract", 6),
        (["dizziness", "lightheaded"], "SSRIs can cause dizziness, especially during initiation", 6),
    ],
    "BETA_BLOCKER": [
        (["dizziness", "lightheaded"], "Beta-blockers can cause dizziness via reduced heart rate and blood pressure", 8),
        (["fatigue", "tired", "lethargy"], "Beta-blockers can cause fatigue by reducing cardiac output", 8),
    ],
    "NSAID": [
        (["stomach pain", "abdominal pain", "heartburn", "GI bleed"], "NSAIDs can cause GI irritation and ulceration", 8),
    ],
    "OPIOID": [
        (["constipation"], "Opioids slow GI motility, commonly causing constipation", 4),
        (["nausea", "vomiting"], "Opioids stimulate the chemoreceptor trigger zone, causing nausea", 4),
    ],
}

# Patient-facing drug purpose descriptions
DRUG_PURPOSES: dict[str, str] = {
    "pantoprazole": "reduces stomach acid",
    "omeprazole": "reduces stomach acid",
    "esomeprazole": "reduces stomach acid",
    "lansoprazole": "reduces stomach acid",
    "lisinopril": "helps lower blood pressure",
    "ramipril": "helps lower blood pressure",
    "enalapril": "helps lower blood pressure",
    "losartan": "helps lower blood pressure",
    "valsartan": "helps lower blood pressure",
    "atorvastatin": "helps lower cholesterol",
    "rosuvastatin": "helps lower cholesterol",
    "simvastatin": "helps lower cholesterol",
    "escitalopram": "helps with mood and anxiety",
    "sertraline": "helps with mood and anxiety",
    "fluoxetine": "helps with mood and anxiety",
    "paroxetine": "helps with mood and anxiety",
    "citalopram": "helps with mood and anxiety",
    "metoprolol": "helps control heart rate and blood pressure",
    "atenolol": "helps control heart rate and blood pressure",
    "bisoprolol": "helps control heart rate and blood pressure",
    "propranolol": "helps control heart rate and blood pressure",
    "prednisone": "reduces inflammation",
    "prednisolone": "reduces inflammation",
    "dexamethasone": "reduces inflammation",
    "metformin": "helps control blood sugar",
    "sitagliptin": "helps control blood sugar",
    "gliclazide": "helps control blood sugar",
    "insulin": "helps control blood sugar",
    "warfarin": "helps prevent blood clots",
    "apixaban": "helps prevent blood clots",
    "rivaroxaban": "helps prevent blood clots",
    "ibuprofen": "reduces pain and inflammation",
    "naproxen": "reduces pain and inflammation",
    "celecoxib": "reduces pain and inflammation",
    "gabapentin": "helps with nerve pain",
    "pregabalin": "helps with nerve pain",
    "amlodipine": "helps lower blood pressure",
    "levothyroxine": "supports thyroid function",
    "lorazepam": "helps with anxiety",
    "diazepam": "helps with anxiety and muscle relaxation",
    "clonazepam": "helps with anxiety and seizures",
    "morphine": "helps manage pain",
    "hydromorphone": "helps manage pain",
    "oxycodone": "helps manage pain",
    "tramadol": "helps manage pain",
    "codeine": "helps manage pain",
}


def get_drug_class(drug_name: str) -> str | None:
    return DRUG_CLASSES.get(drug_name.lower().strip())


def get_drug_purpose(drug_name: str) -> str:
    return DRUG_PURPOSES.get(drug_name.lower().strip(), "prescribed by your doctor")


def get_class_display_name(drug_class: str) -> str:
    return DRUG_CLASS_NAMES.get(drug_class, drug_class)
