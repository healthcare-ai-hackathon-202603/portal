"""Session Delta Engine — longitudinal analysis for pre-visit clinical intelligence.

Computes lab trajectories, vital trends, medication alerts, care gaps,
and cross-facility deltas from a patient's full history.
"""

from collections import defaultdict
from datetime import datetime, date, timedelta

from . import data_loader
from . import medication_rules
from . import care_gap_rules
from .models import (
    Patient,
    Encounter,
    DataPoint,
    LabTrajectory,
    VitalTrajectory,
    MedicationAlerts,
    MedicationDuplication,
    TemporalCorrelation,
    ExpiringMedication,
    CrossFacilityMed,
    CareGap,
    CrossFacilityDelta,
    SessionDelta,
)

TODAY = date(2026, 3, 28)


def _parse_date(date_str: str | None) -> date | None:
    """Parse a date string in YYYY-MM-DD or YYYY-MM-DD HH:MM:SS format."""
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str[:10], "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None


def _classify_trend(values: list[DataPoint], ref_low: float, ref_high: float) -> str:
    """Classify the trend of a series of values.

    Returns: improving, stable, worsening, spiking
    """
    if len(values) < 2:
        return "stable"

    nums = [v.value for v in values]
    earliest = nums[0]
    latest = nums[-1]

    # Check for spiking: > 50% change in recent values
    if len(nums) >= 2:
        recent_prev = nums[-2]
        if recent_prev != 0:
            recent_change = abs(latest - recent_prev) / abs(recent_prev)
            if recent_change > 0.50:
                return "spiking"

    # Overall change
    if earliest == 0:
        overall_pct = abs(latest) * 100
    else:
        overall_pct = abs(latest - earliest) / abs(earliest)

    if overall_pct < 0.10:
        return "stable"

    # Determine direction relative to normal range
    midpoint = (ref_low + ref_high) / 2

    # Distance from midpoint: decreasing = improving, increasing = worsening
    dist_earliest = abs(earliest - midpoint)
    dist_latest = abs(latest - midpoint)

    if dist_latest < dist_earliest:
        return "improving"
    else:
        return "worsening"


def _classify_vital_trend(values: list[DataPoint], normal_low: float, normal_high: float) -> str:
    """Classify vital trend using the same logic as labs."""
    return _classify_trend(values, normal_low, normal_high)


def compute_lab_trajectories(patient_id: str) -> list[LabTrajectory]:
    """Compute trajectories for all lab test types for a patient."""
    labs = data_loader.get_labs(patient_id)
    if not labs:
        return []

    # Group by test_name
    grouped: dict[str, list[dict]] = defaultdict(list)
    for lab in labs:
        grouped[lab["test_name"]].append(lab)

    trajectories = []
    for test_name, records in grouped.items():
        if len(records) < 2:
            continue

        # Sort chronologically
        records.sort(key=lambda r: r["collected_date"] or "")

        # Build DataPoints
        data_points = []
        for r in records:
            val = r["value"]
            if val is None:
                continue
            data_points.append(DataPoint(
                date=r["collected_date"] or "",
                value=float(val),
                facility=r.get("facility"),
                abnormal=r["abnormal_flag"] != "N",
            ))

        if len(data_points) < 2:
            continue

        ref_low = float(records[0]["reference_range_low"] or 0)
        ref_high = float(records[0]["reference_range_high"] or 0)
        test_code = records[0]["test_code"] or ""
        unit = records[0]["unit"] or ""

        trend = _classify_trend(data_points, ref_low, ref_high)

        # Current status from latest abnormal_flag
        latest_flag = records[-1]["abnormal_flag"]
        if latest_flag == "H":
            current_status = "abnormal_high"
        elif latest_flag == "L":
            current_status = "abnormal_low"
        else:
            current_status = "normal"

        earliest_value = data_points[0].value
        latest_value = data_points[-1].value
        if earliest_value != 0:
            change_percent = ((latest_value - earliest_value) / abs(earliest_value)) * 100
        else:
            change_percent = 0.0

        trajectories.append(LabTrajectory(
            test_name=test_name,
            test_code=test_code,
            unit=unit,
            reference_range_low=ref_low,
            reference_range_high=ref_high,
            values=data_points,
            trend=trend,
            current_status=current_status,
            latest_value=latest_value,
            earliest_value=earliest_value,
            change_percent=round(change_percent, 2),
        ))

    return trajectories


# Normal ranges for vitals
VITAL_NORMAL_RANGES: dict[str, tuple[float, float, str]] = {
    "systolic_bp": (90, 120, "mmHg"),
    "diastolic_bp": (60, 80, "mmHg"),
    "heart_rate": (60, 100, "bpm"),
    "o2_saturation": (95, 100, "%"),
}

VITAL_DISPLAY_NAMES: dict[str, str] = {
    "systolic_bp": "Systolic Blood Pressure",
    "diastolic_bp": "Diastolic Blood Pressure",
    "heart_rate": "Heart Rate",
    "o2_saturation": "O2 Saturation",
}


def compute_vital_trajectories(patient_id: str) -> list[VitalTrajectory]:
    """Compute trajectories for tracked vitals."""
    vitals = data_loader.get_vitals(patient_id)
    if not vitals:
        return []

    trajectories = []
    for vital_key, (normal_low, normal_high, unit) in VITAL_NORMAL_RANGES.items():
        data_points = []
        for v in vitals:
            val = v.get(vital_key)
            if val is None:
                continue
            data_points.append(DataPoint(
                date=v.get("recorded_at", "") or "",
                value=float(val),
                facility=v.get("facility"),
            ))

        if len(data_points) < 2:
            continue

        # Sort by date
        data_points.sort(key=lambda dp: dp.date)

        trend = _classify_vital_trend(data_points, normal_low, normal_high)

        trajectories.append(VitalTrajectory(
            vital_name=VITAL_DISPLAY_NAMES[vital_key],
            unit=unit,
            values=data_points,
            trend=trend,
            latest_value=data_points[-1].value,
            normal_range=f"{normal_low}-{normal_high}",
        ))

    return trajectories


def detect_medication_alerts(patient_id: str) -> MedicationAlerts:
    """Detect medication duplications, temporal correlations, expiring meds, and cross-facility meds."""
    meds = data_loader.get_medications(patient_id)
    encounters = data_loader.get_encounters(patient_id)

    active_meds = [m for m in meds if m["active"] == "True"]

    # --- Therapeutic duplication ---
    duplications = _detect_duplications(active_meds)

    # --- Temporal correlations ---
    temporal = _detect_temporal_correlations(active_meds, encounters, patient_id)

    # --- Expiring medications ---
    expiring = _detect_expiring(active_meds)

    # --- Cross-facility meds ---
    cross_facility = _detect_cross_facility_meds(active_meds, encounters)

    return MedicationAlerts(
        duplications=duplications,
        temporal_correlations=temporal,
        expiring=expiring,
        cross_facility=cross_facility,
    )


def _detect_duplications(active_meds: list[dict]) -> list[MedicationDuplication]:
    """Find active medications in the same drug class."""
    class_meds: dict[str, list[dict]] = defaultdict(list)
    for m in active_meds:
        drug_class = medication_rules.get_drug_class(m["drug_name"])
        if drug_class:
            class_meds[drug_class].append(m)

    duplications = []
    for drug_class, meds_in_class in class_meds.items():
        if len(meds_in_class) >= 2:
            duplications.append(MedicationDuplication(
                drug_class=medication_rules.get_class_display_name(drug_class),
                drugs=[m["drug_name"] for m in meds_in_class],
                drug_details=[
                    {
                        "drug_name": m["drug_name"],
                        "dosage": m["dosage"],
                        "frequency": m["frequency"],
                        "prescriber": m["prescriber"],
                    }
                    for m in meds_in_class
                ],
            ))

    return duplications


def _detect_temporal_correlations(
    active_meds: list[dict],
    encounters: list[dict],
    patient_id: str,
) -> list[TemporalCorrelation]:
    """Detect symptom-medication temporal correlations."""
    correlations = []

    for med in active_meds:
        drug_class = medication_rules.get_drug_class(med["drug_name"])
        if not drug_class:
            continue

        start_date = _parse_date(med["start_date"])
        if not start_date:
            continue

        # Check encounter-based correlations
        rules = medication_rules.TEMPORAL_CORRELATIONS.get(drug_class, [])
        for symptom_keywords, mechanism, window_weeks in rules:
            window_end = start_date + timedelta(weeks=window_weeks)
            for enc in encounters:
                enc_date = _parse_date(enc["encounter_date"])
                if not enc_date:
                    continue
                if start_date <= enc_date <= window_end:
                    complaint = (enc.get("chief_complaint") or "").lower()
                    for keyword in symptom_keywords:
                        if keyword.lower() in complaint:
                            correlations.append(TemporalCorrelation(
                                drug_name=med["drug_name"],
                                drug_started=med["start_date"],
                                symptom=keyword,
                                symptom_date=enc["encounter_date"],
                                mechanism=mechanism,
                            ))
                            break  # One match per encounter per rule

        # Special case: corticosteroid -> lab correlation (glucose/HbA1c worsening)
        if drug_class == "CORTICOSTEROID":
            _check_corticosteroid_lab_correlation(med, patient_id, correlations)

    return correlations


def _check_corticosteroid_lab_correlation(
    med: dict,
    patient_id: str,
    correlations: list[TemporalCorrelation],
) -> None:
    """Check if a corticosteroid is temporally correlated with worsening glucose/HbA1c."""
    start_date = _parse_date(med["start_date"])
    if not start_date:
        return

    labs = data_loader.get_labs(patient_id)
    glucose_tests = {"HbA1c", "Fasting Glucose", "Glucose, Fasting"}

    for lab in labs:
        if lab["test_name"] not in glucose_tests:
            continue
        lab_date = _parse_date(lab["collected_date"])
        if not lab_date:
            continue
        # Lab collected after med started and flagged abnormal
        if lab_date >= start_date and lab["abnormal_flag"] != "N":
            mechanism = "Corticosteroids elevate blood glucose by increasing insulin resistance"
            correlations.append(TemporalCorrelation(
                drug_name=med["drug_name"],
                drug_started=med["start_date"],
                symptom=f"Abnormal {lab['test_name']} ({lab['value']} {lab['unit']})",
                symptom_date=lab["collected_date"],
                mechanism=mechanism,
            ))
            break  # One correlation per lab type is sufficient


def _detect_expiring(active_meds: list[dict]) -> list[ExpiringMedication]:
    """Find active medications expiring within 30 days."""
    expiring = []
    for m in active_meds:
        end_date = _parse_date(m.get("end_date"))
        if not end_date:
            continue
        days_remaining = (end_date - TODAY).days
        if 0 <= days_remaining <= 30:
            expiring.append(ExpiringMedication(
                drug_name=m["drug_name"],
                end_date=m["end_date"],
                days_remaining=days_remaining,
            ))
    return expiring


def _detect_cross_facility_meds(
    active_meds: list[dict],
    encounters: list[dict],
) -> list[CrossFacilityMed]:
    """Find active meds prescribed at a different facility than the patient's most recent encounter."""
    if not encounters:
        return []

    # Most recent encounter facility
    sorted_enc = sorted(encounters, key=lambda e: e["encounter_date"] or "")
    most_recent_facility = sorted_enc[-1]["facility"]

    # Build a lookup: encounter_id -> facility
    enc_facility: dict[str, str] = {}
    for e in encounters:
        enc_facility[e["encounter_id"]] = e["facility"]

    # For each med, try to find which facility prescribed it by matching start_date to encounter date
    cross_facility = []
    for med in active_meds:
        med_start = _parse_date(med["start_date"])
        if not med_start:
            continue

        # Find encounter closest to med start date
        best_enc = None
        best_diff = None
        for e in encounters:
            enc_date = _parse_date(e["encounter_date"])
            if not enc_date:
                continue
            diff = abs((enc_date - med_start).days)
            if best_diff is None or diff < best_diff:
                best_diff = diff
                best_enc = e

        if best_enc and best_enc["facility"] != most_recent_facility:
            cross_facility.append(CrossFacilityMed(
                drug_name=med["drug_name"],
                facility=best_enc["facility"],
                prescriber=med["prescriber"],
                start_date=med["start_date"],
            ))

    return cross_facility


def detect_care_gaps(patient_id: str) -> list[CareGap]:
    """Detect missing or overdue monitoring tests based on diagnosis codes."""
    encounters = data_loader.get_encounters(patient_id)
    labs = data_loader.get_labs(patient_id)
    vitals = data_loader.get_vitals(patient_id)

    # Collect all unique diagnosis codes
    diagnosis_codes = set()
    for enc in encounters:
        code = enc.get("diagnosis_code", "")
        if code:
            diagnosis_codes.add(code)

    gaps = []
    for code in diagnosis_codes:
        rules = care_gap_rules.get_monitoring_rules(code)
        if not rules:
            continue

        # Find the condition description from encounters
        condition = ""
        for enc in encounters:
            if enc.get("diagnosis_code") == code:
                condition = enc.get("diagnosis_description", code)
                break

        for required_test, freq_months, description in rules:
            last_test_date = None
            months_since = None

            if required_test == "BP_CHECK":
                # Find most recent vitals record
                if vitals:
                    sorted_vitals = sorted(vitals, key=lambda v: v.get("recorded_at", "") or "")
                    last_date_str = sorted_vitals[-1].get("recorded_at")
                    last_test_date = _parse_date(last_date_str)
            elif required_test == "FOLLOW_UP":
                # Find most recent encounter
                if encounters:
                    sorted_enc = sorted(encounters, key=lambda e: e.get("encounter_date", "") or "")
                    last_date_str = sorted_enc[-1].get("encounter_date")
                    last_test_date = _parse_date(last_date_str)
            else:
                # Find most recent lab matching this test
                aliases = care_gap_rules.get_test_aliases(required_test)
                matching_labs = [
                    lab for lab in labs
                    if lab["test_name"] in aliases
                ]
                if matching_labs:
                    matching_labs.sort(key=lambda l: l["collected_date"] or "")
                    last_date_str = matching_labs[-1]["collected_date"]
                    last_test_date = _parse_date(last_date_str)

            if last_test_date:
                months_since = (TODAY - last_test_date).days / 30.44  # Average days per month
                if months_since <= freq_months:
                    continue  # Not overdue
                months_overdue = round(months_since - freq_months, 1)
                severity = "urgent" if months_since >= freq_months * 2 else "warning"
                gaps.append(CareGap(
                    condition=condition,
                    diagnosis_code=code,
                    required_test=required_test,
                    frequency_months=freq_months,
                    last_test_date=last_date_str,
                    months_overdue=months_overdue,
                    severity=severity,
                ))
            else:
                # No test found at all -- urgent
                gaps.append(CareGap(
                    condition=condition,
                    diagnosis_code=code,
                    required_test=required_test,
                    frequency_months=freq_months,
                    last_test_date=None,
                    months_overdue=None,
                    severity="urgent",
                ))

    return gaps


def compute_cross_facility_delta(patient_id: str) -> list[CrossFacilityDelta]:
    """Compute what happened at other facilities between visits at each facility."""
    encounters = data_loader.get_encounters(patient_id)
    if not encounters:
        return []

    sorted_enc = sorted(encounters, key=lambda e: e["encounter_date"] or "")

    # Group encounters by facility
    facility_encounters: dict[str, list[dict]] = defaultdict(list)
    for enc in sorted_enc:
        facility_encounters[enc["facility"]].append(enc)

    deltas = []
    for facility, fac_encs in facility_encounters.items():
        if not fac_encs:
            continue

        last_visit_here = fac_encs[-1]["encounter_date"]

        # Find the reference point: second-most-recent visit, or last visit if only 1
        if len(fac_encs) >= 2:
            reference_date = fac_encs[-2]["encounter_date"]
        else:
            reference_date = fac_encs[-1]["encounter_date"]

        ref_date = _parse_date(reference_date)
        if not ref_date:
            continue

        # Find encounters at OTHER facilities after the reference date
        events_elsewhere = []
        for enc in sorted_enc:
            if enc["facility"] == facility:
                continue
            enc_date = _parse_date(enc["encounter_date"])
            if enc_date and enc_date > ref_date:
                events_elsewhere.append({
                    "encounter_date": enc["encounter_date"],
                    "facility": enc["facility"],
                    "encounter_type": enc["encounter_type"],
                    "chief_complaint": enc["chief_complaint"],
                    "diagnosis_description": enc["diagnosis_description"],
                })

        if events_elsewhere:
            deltas.append(CrossFacilityDelta(
                facility=facility,
                last_visit_here=last_visit_here,
                events_elsewhere=events_elsewhere,
            ))

    return deltas


def compute_full_delta(patient_id: str) -> SessionDelta:
    """Orchestrator: compute the complete session delta for a patient."""
    patient_data = data_loader.get_patient(patient_id)
    if not patient_data:
        raise ValueError(f"Patient {patient_id} not found")

    patient = Patient(**patient_data)

    # Get recent encounters (last 10)
    all_encounters = data_loader.get_encounters(patient_id)
    sorted_encounters = sorted(all_encounters, key=lambda e: e["encounter_date"] or "", reverse=True)
    recent_encounters = [Encounter(**e) for e in sorted_encounters[:10]]

    # Compute all deltas
    lab_trajectories = compute_lab_trajectories(patient_id)
    vital_trajectories = compute_vital_trajectories(patient_id)
    med_alerts = detect_medication_alerts(patient_id)
    care_gaps = detect_care_gaps(patient_id)
    cross_facility = compute_cross_facility_delta(patient_id)

    return SessionDelta(
        patient=patient,
        lab_trajectories=lab_trajectories,
        vital_trajectories=vital_trajectories,
        medication_alerts=med_alerts,
        care_gaps=care_gaps,
        cross_facility_delta=cross_facility,
        recent_encounters=recent_encounters,
    )
