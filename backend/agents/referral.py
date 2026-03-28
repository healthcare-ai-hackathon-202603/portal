"""Referral Automation Agent — determine referral needs and records transfer (stub)."""

from __future__ import annotations


# Specialists that require GP referral in BC
REFERRAL_REQUIRED: list[str] = [
    "cardiologist",
    "neurologist",
    "endocrinologist",
    "gastroenterologist",
    "nephrologist",
    "psychiatrist",
]

NO_REFERRAL: list[str] = [
    "physiotherapist",
    "chiropractor",
    "optometrist",
    "dentist",
    "pharmacist",
]

# Map diagnosis code to specialist type
DIAGNOSIS_SPECIALIST: dict[str, str] = {
    "E11.9": "endocrinologist",
    "E11.0": "endocrinologist",
    "E10.9": "endocrinologist",
    "I10": "cardiologist",
    "F32.9": "psychiatrist",
    "F33.0": "psychiatrist",
    "E78.5": "cardiologist",
    "E78.0": "cardiologist",
    "E03.9": "endocrinologist",
    "N18.3": "nephrologist",
    "K21.0": "gastroenterologist",
    "I48.91": "cardiologist",
}


def check_referral_needed(diagnosis_code: str, care_level: str) -> dict:
    """Determine if a referral is needed and to whom.

    Args:
        diagnosis_code: ICD-10 diagnosis code.
        care_level: Current care level from triage (not currently used, reserved for future logic).

    Returns:
        Dict with referral_needed, specialist_type, requires_gp_referral, and reason.
    """
    specialist = DIAGNOSIS_SPECIALIST.get(diagnosis_code)
    if not specialist:
        return {
            "referral_needed": False,
            "specialist_type": None,
            "requires_gp_referral": False,
            "reason": "No specialist referral indicated for this diagnosis.",
        }

    needs_referral = specialist in REFERRAL_REQUIRED
    return {
        "referral_needed": needs_referral,
        "specialist_type": specialist,
        "requires_gp_referral": needs_referral,
        "reason": (
            f"{'GP referral required for' if needs_referral else 'Direct booking available for'} "
            f"{specialist}."
        ),
    }


def check_records_transfer(patient_id: str) -> dict:
    """Stub: identify prior practitioners for records transfer.

    In production this would query a practitioner directory and match
    against the patient's encounter history.
    """
    return {
        "prior_practitioners_found": 0,
        "transfer_status": "not_implemented",
        "message": (
            "Records transfer automation is not yet available. "
            "Please contact your previous providers directly."
        ),
    }
