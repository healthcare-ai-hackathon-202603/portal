// frontend/lib/clinician-filters.ts
import type { LabTrajectory, Encounter, PatientIssue } from "./types";

// Diagnosis code → relevant lab test names
// Mirrors backend care_gap_rules.py MONITORING_RULES
const CONDITION_TESTS: Record<string, string[]> = {
  "E11.9": ["HbA1c", "Fasting Glucose", "Creatinine"],
  "E11.0": ["HbA1c"],
  "E10.9": ["HbA1c"],
  "I10": ["Creatinine"],
  "E78.5": ["Total Cholesterol", "LDL Cholesterol"],
  "E78.0": ["Total Cholesterol", "LDL Cholesterol"],
  "E03.9": ["TSH"],
  "N18.3": ["Creatinine", "Potassium"],
  "I48.91": ["INR"],
};

// Diagnosis code → relevant drug classes
// Mirrors backend medication_rules.py DRUG_CLASSES
const CONDITION_DRUG_CLASSES: Record<string, string[]> = {
  "E11.9": ["BIGUANIDE", "DPP4_INHIBITOR", "SULFONYLUREA", "INSULIN"],
  "E11.0": ["BIGUANIDE", "DPP4_INHIBITOR", "SULFONYLUREA", "INSULIN"],
  "E10.9": ["INSULIN"],
  "I10": ["ACE_INHIBITOR", "ARB", "BETA_BLOCKER", "CCB"],
  "F32.9": ["SSRI"],
  "F33.0": ["SSRI"],
  "E78.5": ["STATIN"],
  "E78.0": ["STATIN"],
  "E03.9": ["THYROID_HORMONE"],
  "I48.91": ["ANTICOAGULANT"],
  "K21.0": ["PPI"],
  "J45.20": ["CORTICOSTEROID"],
  "J45.50": ["CORTICOSTEROID"],
};

// Drug name (lowercase) → drug class — mirrors backend medication_rules.py
const DRUG_CLASS_LOOKUP: Record<string, string> = {
  pantoprazole: "PPI", omeprazole: "PPI", esomeprazole: "PPI", lansoprazole: "PPI", rabeprazole: "PPI",
  lisinopril: "ACE_INHIBITOR", ramipril: "ACE_INHIBITOR", enalapril: "ACE_INHIBITOR", perindopril: "ACE_INHIBITOR",
  losartan: "ARB", valsartan: "ARB", candesartan: "ARB", irbesartan: "ARB",
  atorvastatin: "STATIN", rosuvastatin: "STATIN", simvastatin: "STATIN", pravastatin: "STATIN",
  escitalopram: "SSRI", sertraline: "SSRI", fluoxetine: "SSRI", paroxetine: "SSRI", citalopram: "SSRI",
  metoprolol: "BETA_BLOCKER", atenolol: "BETA_BLOCKER", bisoprolol: "BETA_BLOCKER", propranolol: "BETA_BLOCKER", carvedilol: "BETA_BLOCKER",
  prednisone: "CORTICOSTEROID", prednisolone: "CORTICOSTEROID", dexamethasone: "CORTICOSTEROID", hydrocortisone: "CORTICOSTEROID",
  metformin: "BIGUANIDE", sitagliptin: "DPP4_INHIBITOR", gliclazide: "SULFONYLUREA", glipizide: "SULFONYLUREA", insulin: "INSULIN",
  warfarin: "ANTICOAGULANT", apixaban: "ANTICOAGULANT", rivaroxaban: "ANTICOAGULANT",
  ibuprofen: "NSAID", naproxen: "NSAID", celecoxib: "NSAID", diclofenac: "NSAID",
  lorazepam: "BENZODIAZEPINE", diazepam: "BENZODIAZEPINE", clonazepam: "BENZODIAZEPINE",
  gabapentin: "GABAPENTINOID", pregabalin: "GABAPENTINOID",
  amlodipine: "CCB", nifedipine: "CCB", diltiazem: "CCB",
  levothyroxine: "THYROID_HORMONE",
  morphine: "OPIOID", hydromorphone: "OPIOID", oxycodone: "OPIOID", codeine: "OPIOID", tramadol: "OPIOID",
};

export function getDrugClass(drugName: string): string | null {
  return DRUG_CLASS_LOOKUP[drugName.toLowerCase().trim()] ?? null;
}

export function getTestsForCondition(diagnosisCode: string): string[] {
  return CONDITION_TESTS[diagnosisCode] ?? [];
}

export function getDrugClassesForCondition(diagnosisCode: string): string[] {
  return CONDITION_DRUG_CLASSES[diagnosisCode] ?? [];
}

export interface MedicationRow {
  name: string;
  dosage: string;
  frequency: string;
  active: boolean;
  end_date?: string;
  prescriber: string;
  start_date: string;
  route: string;
  drug_code: string;
  facility?: string;
}

export function filterLabsByIssue(
  labs: LabTrajectory[],
  issueCode: string | null
): LabTrajectory[] {
  if (!issueCode) return labs;
  const relevant = getTestsForCondition(issueCode);
  if (relevant.length === 0) return labs;
  return labs.filter((l) => relevant.includes(l.test_name));
}

export function filterMedsByIssue(
  meds: MedicationRow[],
  issueCode: string | null
): MedicationRow[] {
  if (!issueCode) return meds;
  const classes = getDrugClassesForCondition(issueCode);
  if (classes.length === 0) return meds;
  return meds.filter((m) => {
    const cls = getDrugClass(m.name);
    return cls !== null && classes.includes(cls);
  });
}

export function filterEncountersByIssue(
  encounters: Encounter[],
  issueCode: string | null
): Encounter[] {
  if (!issueCode) return encounters;
  return encounters.filter((e) => e.diagnosis_code === issueCode);
}

export function getIssueSeverity(
  issue: PatientIssue,
  careGapCodes: string[],
  abnormalLabCodes: string[]
): "urgent" | "warning" | "info" {
  if (careGapCodes.includes(issue.diagnosis_code)) return "urgent";
  const tests = getTestsForCondition(issue.diagnosis_code);
  if (tests.some((t) => abnormalLabCodes.includes(t))) return "warning";
  return "info";
}
