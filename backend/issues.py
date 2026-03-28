"""Diagnosis-driven issue grouping for a patient's encounter history."""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta

from .data_loader import get_encounters, get_medications
from .models import PatientIssue

TODAY = date(2026, 3, 28)
_ACTIVE_WINDOW = timedelta(days=365)  # 12 months
_MED_LINK_WINDOW = timedelta(days=30)


def _parse_date(date_str: str | None) -> date | None:
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str[:10], "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None


def compute_patient_issues(patient_id: str) -> list[PatientIssue]:
    """Group a patient's encounters by diagnosis_code to create issues.

    Each issue collects:
      - diagnosis code/description, encounter count, first/last seen dates,
        facilities, temporally linked medications, and active/prior status.

    Sorted: active issues first (by last_seen desc), then prior issues.
    """
    encounters = get_encounters(patient_id)
    medications = get_medications(patient_id)

    # Group encounters by diagnosis_code
    grouped: dict[str, list[dict]] = defaultdict(list)
    for enc in encounters:
        code = enc.get("diagnosis_code", "")
        if code:
            grouped[code].append(enc)

    active_meds = [m for m in medications if m.get("active") == "True"]

    issues: list[PatientIssue] = []
    for code, encs in grouped.items():
        # Sort encounters chronologically
        encs.sort(key=lambda e: e.get("encounter_date", "") or "")

        description = encs[0].get("diagnosis_description", code)
        first_seen = encs[0].get("encounter_date", "")
        last_seen = encs[-1].get("encounter_date", "")
        facilities = sorted({e["facility"] for e in encs if e.get("facility")})

        # Determine status
        last_seen_date = _parse_date(last_seen)
        if last_seen_date and (TODAY - last_seen_date) <= _ACTIVE_WINDOW:
            status = "active"
        else:
            status = "prior"

        # Find linked medications: active meds started within 30 days of any
        # encounter with this diagnosis
        enc_dates = [_parse_date(e.get("encounter_date")) for e in encs]
        enc_dates = [d for d in enc_dates if d is not None]

        linked_med_names: set[str] = set()
        for med in active_meds:
            med_start = _parse_date(med.get("start_date"))
            if not med_start:
                continue
            for enc_date in enc_dates:
                if abs((med_start - enc_date).days) <= _MED_LINK_WINDOW.days:
                    linked_med_names.add(med["drug_name"])
                    break

        issues.append(PatientIssue(
            diagnosis_code=code,
            diagnosis_description=description,
            encounter_count=len(encs),
            first_seen=first_seen,
            last_seen=last_seen,
            facilities=facilities,
            linked_medications=sorted(linked_med_names),
            status=status,
        ))

    # Sort: active first (by last_seen desc), then prior (by last_seen desc)
    active_issues = sorted(
        [i for i in issues if i.status == "active"],
        key=lambda i: i.last_seen,
        reverse=True,
    )
    prior_issues = sorted(
        [i for i in issues if i.status == "prior"],
        key=lambda i: i.last_seen,
        reverse=True,
    )

    return active_issues + prior_issues
