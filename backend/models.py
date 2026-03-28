"""Pydantic models for API responses."""

from pydantic import BaseModel


class Patient(BaseModel):
    patient_id: str
    first_name: str
    last_name: str
    date_of_birth: str
    age: int
    sex: str
    postal_code: str
    blood_type: str
    insurance_number: str
    primary_language: str
    emergency_contact_phone: str


class PatientListItem(BaseModel):
    patient_id: str
    first_name: str
    last_name: str
    age: int
    sex: str
    primary_language: str
    alert_score: int = 0
    encounter_count: int = 0
    facility_count: int = 0


class Encounter(BaseModel):
    encounter_id: str
    patient_id: str
    encounter_date: str
    encounter_type: str
    facility: str
    chief_complaint: str
    diagnosis_code: str
    diagnosis_description: str
    triage_level: int
    disposition: str
    length_of_stay_hours: float
    attending_physician: str


class Vital(BaseModel):
    vitals_id: str
    patient_id: str
    encounter_id: str
    heart_rate: int
    systolic_bp: int
    diastolic_bp: int
    temperature_celsius: float
    respiratory_rate: int
    o2_saturation: float
    pain_scale: int
    recorded_at: str
    facility: str | None = None


class LabResult(BaseModel):
    lab_id: str
    patient_id: str
    encounter_id: str
    test_name: str
    test_code: str
    value: float
    unit: str
    reference_range_low: float
    reference_range_high: float
    abnormal_flag: str
    collected_date: str
    facility: str | None = None


class Medication(BaseModel):
    medication_id: str
    patient_id: str
    drug_name: str
    drug_code: str
    dosage: str
    frequency: str
    route: str
    prescriber: str
    start_date: str
    end_date: str | None = None
    active: str


# --- Session Delta response models ---

class DataPoint(BaseModel):
    date: str
    value: float
    facility: str | None = None
    abnormal: bool = False


class LabTrajectory(BaseModel):
    test_name: str
    test_code: str
    unit: str
    reference_range_low: float
    reference_range_high: float
    values: list[DataPoint]
    trend: str  # improving, stable, worsening, spiking
    current_status: str  # normal, abnormal_high, abnormal_low
    latest_value: float
    earliest_value: float
    change_percent: float


class VitalTrajectory(BaseModel):
    vital_name: str
    unit: str
    values: list[DataPoint]
    trend: str
    latest_value: float
    normal_range: str


class MedicationDuplication(BaseModel):
    drug_class: str
    drugs: list[str]
    drug_details: list[dict]


class TemporalCorrelation(BaseModel):
    drug_name: str
    drug_started: str
    symptom: str
    symptom_date: str
    mechanism: str


class ExpiringMedication(BaseModel):
    drug_name: str
    end_date: str
    days_remaining: int


class CrossFacilityMed(BaseModel):
    drug_name: str
    facility: str
    prescriber: str
    start_date: str


class MedicationAlerts(BaseModel):
    duplications: list[MedicationDuplication]
    temporal_correlations: list[TemporalCorrelation]
    expiring: list[ExpiringMedication]
    cross_facility: list[CrossFacilityMed]


class CareGap(BaseModel):
    condition: str
    diagnosis_code: str
    required_test: str
    frequency_months: int
    last_test_date: str | None
    months_overdue: float | None
    severity: str  # warning, urgent


class CrossFacilityDelta(BaseModel):
    facility: str
    last_visit_here: str | None
    events_elsewhere: list[dict]


class SessionDelta(BaseModel):
    patient: Patient
    lab_trajectories: list[LabTrajectory]
    vital_trajectories: list[VitalTrajectory]
    medication_alerts: MedicationAlerts
    care_gaps: list[CareGap]
    cross_facility_delta: list[CrossFacilityDelta]
    recent_encounters: list[Encounter]


# --- Patient-facing summary models ---

class AlertItem(BaseModel):
    category: str  # lab_trend, medication, care_gap, follow_up
    severity: str  # info, warning, urgent
    title: str
    description: str
    details: dict | None = None


class PatientSummary(BaseModel):
    patient: Patient
    alerts: list[AlertItem]
    active_medications: list[dict]
    recent_encounters: list[Encounter]
