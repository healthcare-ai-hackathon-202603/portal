"""Provider Routing Agent — find appropriate care providers for a patient."""

from __future__ import annotations

import os

from ..models import ProviderInfo, ProviderRouting, TriageResult


# ---------------------------------------------------------------------------
# Static provider directory (Victoria BC / Island Health region)
# ---------------------------------------------------------------------------

PROVIDER_DIRECTORY: list[dict] = [
    {
        "name": "Royal Jubilee Hospital - ER",
        "type": "emergency",
        "address": "1952 Bay St, Victoria, BC",
        "phone": "250-370-8000",
        "wait_time_mins": None,
        "specialty": None,
    },
    {
        "name": "Victoria General Hospital - ER",
        "type": "emergency",
        "address": "1 Hospital Way, Victoria, BC",
        "phone": "250-727-4212",
        "wait_time_mins": None,
        "specialty": None,
    },
    {
        "name": "Saanich Peninsula Hospital",
        "type": "urgent_care",
        "address": "2166 Mt Newton Cross Rd, Saanichton, BC",
        "phone": "250-544-7676",
        "wait_time_mins": None,
        "specialty": None,
    },
    {
        "name": "James Bay Urgent & Primary Care Centre",
        "type": "urgent_care",
        "address": "230 Menzies St, Victoria, BC",
        "phone": "250-384-2232",
        "wait_time_mins": None,
        "specialty": None,
    },
    {
        "name": "Westshore Urgent & Primary Care Centre",
        "type": "urgent_care",
        "address": "2781 Jacklin Rd, Langford, BC",
        "phone": "250-519-3111",
        "wait_time_mins": None,
        "specialty": None,
    },
    {
        "name": "Cool Aid Community Health Centre",
        "type": "primary_care",
        "address": "713 Johnson St, Victoria, BC",
        "phone": "250-383-1951",
        "wait_time_mins": None,
        "specialty": None,
    },
    {
        "name": "Island Sexual Health",
        "type": "specialist",
        "address": "3960 Quadra St, Victoria, BC",
        "phone": "250-592-3479",
        "wait_time_mins": None,
        "specialty": "sexual_health",
    },
    {
        "name": "Victoria Medical Clinic",
        "type": "primary_care",
        "address": "1120 Yates St, Victoria, BC",
        "phone": "250-384-7171",
        "wait_time_mins": None,
        "specialty": None,
    },
]

# Map care_level strings to provider directory types
_CARE_LEVEL_TO_TYPE: dict[str, list[str]] = {
    "emergency": ["emergency"],
    "urgent_care": ["urgent_care", "emergency"],
    "primary_care": ["primary_care", "urgent_care"],
    "specialist": ["specialist"],
}


# ---------------------------------------------------------------------------
# Tavily integration (optional)
# ---------------------------------------------------------------------------

def _try_enhance_with_tavily(providers: list[dict]) -> list[dict]:
    """Attempt to enhance provider data with real-time info from Tavily search.

    Returns providers unchanged if Tavily is unavailable.
    """
    api_key = os.environ.get("TAVILY_API_KEY", "")
    if not api_key:
        return providers

    try:
        from tavily import TavilyClient

        client = TavilyClient(api_key=api_key)
        enhanced = []
        for p in providers:
            try:
                result = client.search(
                    query=f"{p['name']} hours wait time today",
                    max_results=1,
                )
                # Try to extract wait time info from search results
                p_copy = dict(p)
                if result.get("results"):
                    # Store raw search context; don't try to parse unreliably
                    content = result["results"][0].get("content", "")
                    # Simple heuristic: look for "wait" + number pattern
                    import re

                    match = re.search(r"(\d+)\s*(?:min|minute)", content, re.IGNORECASE)
                    if match:
                        p_copy["wait_time_mins"] = int(match.group(1))
                enhanced.append(p_copy)
            except Exception:
                enhanced.append(p)
        return enhanced
    except (ImportError, Exception):
        return providers


# ---------------------------------------------------------------------------
# Public functions
# ---------------------------------------------------------------------------

def find_providers(
    care_level: str,
    specialty: str | None = None,
) -> list[dict]:
    """Filter the provider directory by care level and optional specialty.

    Args:
        care_level: One of "emergency", "urgent_care", "primary_care", "specialist".
        specialty: Optional specialty filter (e.g. "sexual_health").

    Returns:
        List of matching provider dicts.
    """
    allowed_types = _CARE_LEVEL_TO_TYPE.get(care_level, [care_level])

    matches = [
        p for p in PROVIDER_DIRECTORY
        if p["type"] in allowed_types
    ]

    if specialty:
        specialty_matches = [p for p in matches if p.get("specialty") == specialty]
        if specialty_matches:
            matches = specialty_matches

    # Attempt Tavily enhancement
    matches = _try_enhance_with_tavily(matches)

    return matches


def route_patient(patient_id: str, triage_result: TriageResult) -> ProviderRouting:
    """Given a triage result, recommend providers and build routing response.

    Args:
        patient_id: The patient ID (used for future personalization).
        triage_result: Output from the triage agent.

    Returns:
        ProviderRouting with recommended providers, care level, and reasoning.
    """
    care_level = triage_result.recommended_care_level
    matches = find_providers(care_level)

    recommended = [
        ProviderInfo(
            name=p["name"],
            type=p["type"],
            address=p["address"],
            phone=p["phone"],
            wait_time_mins=p.get("wait_time_mins"),
            specialty=p.get("specialty"),
        )
        for p in matches
    ]

    # Build reasoning
    if triage_result.urgency == "emergency":
        reasoning = (
            f"Based on urgency assessment ({triage_result.urgency}), "
            f"the nearest emergency departments are recommended. "
            f"Call 911 for life-threatening emergencies."
        )
    elif triage_result.urgency == "urgent":
        reasoning = (
            f"Based on urgency assessment ({triage_result.urgency}), "
            f"urgent care centres or emergency departments are recommended for same-day evaluation."
        )
    elif triage_result.urgency == "semi-urgent":
        reasoning = (
            f"Based on urgency assessment ({triage_result.urgency}), "
            f"a primary care or urgent care appointment within 2-3 days is recommended."
        )
    else:
        reasoning = (
            f"Based on urgency assessment ({triage_result.urgency}), "
            f"a routine primary care appointment is appropriate."
        )

    return ProviderRouting(
        recommended_providers=recommended,
        care_level=care_level,
        reasoning=reasoning,
    )
