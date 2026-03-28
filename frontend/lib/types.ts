// API response types matching backend Pydantic models

export interface Patient {
  patient_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  age: number;
  sex: string;
  postal_code: string;
  blood_type: string;
  insurance_number: string;
  primary_language: string;
  emergency_contact_phone: string;
}

export interface PatientListItem {
  patient_id: string;
  first_name: string;
  last_name: string;
  age: number;
  sex: string;
  primary_language: string;
  alert_score: number;
  encounter_count: number;
  facility_count: number;
}

export interface Encounter {
  encounter_id: string;
  patient_id: string;
  encounter_date: string;
  encounter_type: string;
  facility: string;
  chief_complaint: string;
  diagnosis_code: string;
  diagnosis_description: string;
  triage_level: number;
  disposition: string;
  length_of_stay_hours: number;
  attending_physician: string;
}

export interface DataPoint {
  date: string;
  value: number;
  facility?: string;
  abnormal: boolean;
}

export interface LabTrajectory {
  test_name: string;
  test_code: string;
  unit: string;
  reference_range_low: number;
  reference_range_high: number;
  values: DataPoint[];
  trend: "improving" | "stable" | "worsening" | "spiking";
  current_status: "normal" | "abnormal_high" | "abnormal_low";
  latest_value: number;
  earliest_value: number;
  change_percent: number;
}

export interface VitalTrajectory {
  vital_name: string;
  unit: string;
  values: DataPoint[];
  trend: "improving" | "stable" | "worsening" | "spiking";
  latest_value: number;
  normal_range: string;
}

export interface MedicationDuplication {
  drug_class: string;
  drugs: string[];
  drug_details: Record<string, unknown>[];
}

export interface TemporalCorrelation {
  drug_name: string;
  drug_started: string;
  symptom: string;
  symptom_date: string;
  mechanism: string;
}

export interface ExpiringMedication {
  drug_name: string;
  end_date: string;
  days_remaining: number;
}

export interface CrossFacilityMed {
  drug_name: string;
  facility: string;
  prescriber: string;
  start_date: string;
}

export interface MedicationAlerts {
  duplications: MedicationDuplication[];
  temporal_correlations: TemporalCorrelation[];
  expiring: ExpiringMedication[];
  cross_facility: CrossFacilityMed[];
}

export interface CareGap {
  condition: string;
  diagnosis_code: string;
  required_test: string;
  frequency_months: number;
  last_test_date: string | null;
  months_overdue: number | null;
  severity: "warning" | "urgent";
}

export interface CrossFacilityDelta {
  facility: string;
  last_visit_here: string | null;
  events_elsewhere: Record<string, unknown>[];
}

export interface SessionDelta {
  patient: Patient;
  lab_trajectories: LabTrajectory[];
  vital_trajectories: VitalTrajectory[];
  medication_alerts: MedicationAlerts;
  care_gaps: CareGap[];
  cross_facility_delta: CrossFacilityDelta[];
  recent_encounters: Encounter[];
}

export interface AlertItem {
  category: "lab_trend" | "medication" | "care_gap" | "follow_up";
  severity: "info" | "warning" | "urgent";
  title: string;
  description: string;
  details?: Record<string, unknown>;
}

export interface PatientMedication {
  name: string;
  purpose: string;
  dosage: string;
  frequency: string;
  active: boolean;
  clinical_details: {
    drug_code: string;
    prescriber: string;
    start_date: string;
    end_date?: string;
    route: string;
  };
}

export interface PatientSummary {
  patient: Patient;
  alerts: AlertItem[];
  active_medications: PatientMedication[];
  recent_encounters: Encounter[];
}

export interface MedicationsResponse {
  medications: Record<string, unknown>[];
  alerts: MedicationAlerts;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  response: string;
  suggested_questions: string[];
  relevant_metrics: string[];
}

export interface RiskScore {
  score: number;
  level: "good" | "watch" | "at-risk";
  factors: string[];
}

export interface PatientIssue {
  diagnosis_code: string;
  diagnosis_description: string;
  encounter_count: number;
  first_seen: string;
  last_seen: string;
  facilities: string[];
  linked_medications: string[];
  status: "active" | "prior";
}

export interface UrgencyClassification {
  level: "red" | "yellow" | "green";
  label: string;
  reasons: string[];
}

// Facility color mapping
export const FACILITY_COLORS: Record<string, string> = {
  "Royal Jubilee Hospital": "#3B82F6",
  "Victoria General Hospital": "#10B981",
  "Saanich Peninsula Hospital": "#F59E0B",
  "Cowichan District Hospital": "#EF4444",
  "Nanaimo Regional General Hospital": "#8B5CF6",
};

export const FACILITY_SHORT_NAMES: Record<string, string> = {
  "Royal Jubilee Hospital": "RJH",
  "Victoria General Hospital": "VGH",
  "Saanich Peninsula Hospital": "SPH",
  "Cowichan District Hospital": "CDH",
  "Nanaimo Regional General Hospital": "NRGH",
};
