# HealthSync — AI-Powered Pre-Visit Intelligence & Patient Navigation

## What This Is

A pre-visit intelligence system that owns the patient journey: triage → intake → clinical briefing → follow-up tracking. Think "Google Maps for healthcare" — it tells patients where to go, prepares their clinician before they arrive, and makes sure nothing falls through the cracks after they leave.

**Core insight:** AI scribes handle the *during-visit* layer. Nobody handles *before* and *after*. That's us.

## What We're Solving

Canadian healthcare has no navigation layer. 5.9M adults don't have a family doctor. 42% of ER visits could've been handled in primary care. 30,000 patients/year walk out of Island Health ERs without being seen. Patients bounce between walk-ins, ERs, and specialists with no one coordinating the journey — no one telling them where to go, no one preparing their next provider, no one tracking what happens after.

We're building the navigation layer. Three problems, one system:

1. **Patients don't know where to go.** The chat + triage router tells them — primary care, urgent care, ER, pharmacy, or virtual visit. It's the front door.
2. **Clinicians don't know what happened before.** The pre-visit brief + session delta engine surfaces everything that matters from a patient's longitudinal history — including what changed at *other* facilities between visits. A diabetic patient's HbA1c spikes from 5.6% to 10.8% over 5 months across 3 facilities — but the walk-in doctor treating their asthma today has no idea. Session delta catches that.
3. **Nobody tracks what happens after.** Imaging results go unreviewed. Referrals go unscheduled. Prescriptions expire. The follow-up tracker is the safety net that closes the loop.

## Architecture

```
Patient Chat Interface → Triage + Routing Engine → Pre-Visit Brief Generator
         ↑                                                    ↓
    Follow-Up Tracker  ←←←←←←←←←←←←←←←←←←←←  Clinician Dashboard
```

**AI-native. FHIR-compatible (export layer, not foundation).**

### Stack
- **Frontend:** Next.js (patient chat + clinician dashboard)
- **Backend:** Python/FastAPI
- **Database:** PostgreSQL (or SQLite for prototype)
- **AI:** Anthropic API (Claude) for chat + plain-language generation
- **Data:** 5 CSVs — patients, encounters, vitals, lab_results, medications

### Data Location
Raw CSVs are in `data/`. Copy from `/mnt/user-data/uploads/` if missing.

## Three Systems to Build

### 1. Patient Chat + Triage Router
The entry point. Patient describes their problem in natural language. System:
- Collects structured symptom data conversationally (not a form)
- Pulls their full history (encounters, labs, vitals, meds) as context
- Routes them: "This sounds like something your family doctor can handle" vs "You should go to urgent care today" vs "Go to the ER now"
- Generates a **pre-visit intake summary** that flows to the clinician
- Supports English, French, Mandarin, Punjabi (dataset demographics)

**This is not a diagnostic chatbot.** It triages, gathers context, and routes. It never says "you have X condition."

### 2. Pre-Visit Clinical Brief + Session Delta Engine
The core differentiator. Before an appointment, generate a one-page brief for the clinician:

**Session Delta** (the killer feature):
- Compare current state vs historical baseline across ALL encounters
- Flag trajectories: "HbA1c: 4.98% (Apr 2024) → 5.65% (Mar 2025) → 10.87% (Jan 2026) — accelerating deterioration"
- Flag temporal correlations: patient started prednisone → glucose spiking (known side effect)
- Flag care gaps: "Diabetic patient, no HbA1c in 14 months" or "Hypertensive, no BP reading in 8 months"
- Flag medication risks: therapeutic duplication (e.g., pantoprazole + omeprazole — both PPIs), drug-drug interactions
- Surface what changed since last visit at THIS facility vs what happened at OTHER facilities between visits

**The brief contains:**
- Vitals trends (direction of travel, not just last reading)
- Flagged abnormal labs with trajectory
- Active medications + interaction/duplication warnings
- Care gaps (missing tests, expiring prescriptions, unscheduled follow-ups)
- Patient's own concerns (from chat intake, in their words)

### 3. Follow-Up Tracker + Navigation
Post-visit safety net:
- Track pending imaging/lab results — flag if not reviewed within X days
- Track referrals — flag if follow-up not scheduled
- Track medication end dates — flag approaching expiry with no renewal
- Patient gets plain-language updates: "Your lab results are ready for review" or "Your prescription for metformin expires in 14 days"
- Route patients to next appropriate care touchpoint

## Session Delta — How to Compute It

This is the technical core. For a given patient at a given encounter:

```python
def compute_session_delta(patient_id, current_encounter_id):
    """
    Compare patient's current state against their full longitudinal history.
    Returns clinically significant changes the current provider needs to know.
    """
    # 1. Get ALL encounters for this patient, sorted chronologically
    # 2. Get ALL labs, vitals, meds linked to this patient
    # 3. For each lab type (HbA1c, glucose, cholesterol, etc.):
    #    - Compute trajectory (improving, stable, worsening, spiking)
    #    - Flag if latest value crossed from normal → abnormal or vice versa
    #    - Flag if rate of change accelerated
    # 4. For vitals:
    #    - BP trend (are they becoming hypertensive?)
    #    - HR, O2 sat trends
    # 5. For medications:
    #    - New meds since last visit at THIS facility
    #    - Meds started at OTHER facilities (provider may not know about these)
    #    - Temporal correlation: new symptom appeared after med started?
    # 6. For encounters:
    #    - Visits at other facilities between this patient's last visit here
    #    - New diagnoses from those visits
    #    - ER visits (may indicate deterioration)
    # 7. Care gaps:
    #    - Diagnosis requires monitoring test → test not done in X months
    #    - Active chronic condition → no related encounter in X months
```

### Key Temporal Correlations to Detect
- ACE inhibitor (lisinopril, ramipril) → new "cough" complaint
- Statin → new "joint pain" or "muscle pain"
- Prednisone → glucose/HbA1c spike
- SSRI (escitalopram, sertraline) → new "nausea" or "dizziness"
- Metoprolol → new "dizziness" or "fatigue"
- Duplicate drug classes (2 PPIs, 2 SSRIs, 2 beta-blockers)

### Care Gap Rules
- Type 2 diabetes (E11.9) → HbA1c every 3-6 months
- Essential hypertension (I10) → BP check every 3-6 months
- Major depressive disorder (F32.9) → follow-up within 4-8 weeks of med change
- Any active medication → check if end_date approaching with no renewal

## Dataset Details

| File | Records | Key Fields |
|------|---------|------------|
| patients.csv | 2,000 | patient_id, age, sex, postal_code, blood_type, primary_language |
| encounters.csv | 10,000 | patient_id, encounter_date, encounter_type (outpatient/inpatient/emergency), facility (5 Island Health sites), chief_complaint, diagnosis_code, diagnosis_description, triage_level (1-5), disposition |
| vitals.csv | 2,000 | patient_id, encounter_id, heart_rate, systolic_bp, diastolic_bp, temperature, respiratory_rate, o2_saturation, pain_scale |
| lab_results.csv | 3,000 | patient_id, encounter_id, test_name, test_code (LOINC), value, unit, reference_range_low/high, abnormal_flag |
| medications.csv | 5,000 | patient_id, drug_name, drug_code (DIN), dosage, frequency, route, prescriber, start_date, end_date, active |

**5 facilities:** Royal Jubilee Hospital, Victoria General Hospital, Saanich Peninsula Hospital, Cowichan District Hospital, Nanaimo Regional General Hospital

**Key data facts:**
- 848 patients (42.4%) visit multiple facilities
- 396 patients on 3+ active meds (polypharmacy risk)
- 20.2% of HbA1c tests abnormal, 21.5% fasting glucose abnormal
- Top chronic conditions: hypertension (976), diabetes (862), depression (589)
- Languages: English (1793), French (94), Mandarin (48), Punjabi (38)

## Demo Patients for Testing

**PAT-001918 (Jose, 65M):** 309 encounters across all 5 facilities. HbA1c spike 5.62% → 10.87% in 5 months. On prednisone (glucose elevator) with no diabetes medication. Critically low sodium (113 mmol/L). Most recent visit was for asthma. Perfect session delta demo.

**PAT-001792 (Michael, 44M):** 74 encounters. On pantoprazole AND omeprazole (duplicate PPIs). HbA1c 8.1% with no diabetes med. Cholesterol 6.21 with no statin. Three care gaps.

**PAT-001421 (William, 40M):** 219 encounters. HbA1c spiked to 6.94%. LDL consistently elevated (4.48, 4.91, 4.52). On sertraline + sitagliptin but no statin despite lipid pattern.

## What NOT to Build
- Not a diagnostic tool. Never say "you have X." Say "this pattern may be relevant for your provider."
- Not an AI scribe. That layer is solved (Infoway funded 10K licenses).
- Not a new patient portal competing with Health Gateway. Integrate into existing touchpoints.
- No fine-tuning on patient data. Prompt engineering + RAG with structured context only.
- No localStorage in any frontend artifacts. Use React state.

## Regulatory Constraints (Baked Into Design)
- Human-in-the-loop: every clinical output requires clinician review
- Surface patterns, NEVER recommend treatments ("no active diabetes medication" not "start metformin")
- Rules-based correlation engine (not black-box ML) — transparent, auditable
- LLM is presentation layer only — translates structured data to plain language
- Canadian data residency required for any LLM API calls with patient context

## Frontend Design
- Use applicable skills frontend-design-skills, imppeccable, superpowers, etc
- Make it user intuitive, metrics shown to both sides patient and doctors should fit their target audience and expose what matters. 
- It should reduce context burnout and be seamless instead of putting all info on the screen.

## File Structure
```
healthsync/
├── CLAUDE.md
├── data/                    # CSV files
├── backend/
│   ├── main.py             # FastAPI app
│   ├── models.py           # Data models
│   ├── data_loader.py      # CSV ingestion + patient profile builder
│   ├── session_delta.py    # Longitudinal analysis engine
│   ├── triage.py           # Symptom → routing logic
│   ├── briefing.py         # Pre-visit brief generator
│   ├── followup.py         # Post-visit tracker
│   └── chat.py             # Patient chat interface (Anthropic API)
├── frontend/
│   ├── app/                # Next.js app router
│   │   ├── page.tsx        # Patient chat landing
│   │   ├── dashboard/      # Clinician dashboard
│   │   └── patient/        # Patient portal views
│   └── components/
└── requirements.txt
```