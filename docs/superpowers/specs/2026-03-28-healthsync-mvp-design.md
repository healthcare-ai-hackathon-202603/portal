# HealthSync MVP Design Spec

## Context

Canadian healthcare lacks a navigation layer. 5.9M adults have no family doctor, 42% of ER visits could be handled in primary care, and patients bounce between facilities with no one coordinating before or after visits. HealthSync is the navigation layer — it tells patients what matters in their health right now, and gives clinicians a pre-visit brief that surfaces what they'd otherwise miss.

This spec covers the first vertical slice: a working demo with real synthetic data (5 CSVs, 2,000 patients) that showcases the session delta intelligence through two views — patient and clinician — for 3 demo patients.

## Decisions

- **No LLM / No paid APIs.** Session delta is rules-based. Patient-facing plain language uses template rendering. Fully free stack.
- **Full-stack vertical.** Backend + frontend built together so the demo runs on real computed data, not mocks.
- **SQLite for prototype.** CSVs loaded into SQLite on startup. Structured queries, no CSV parsing per request.
- **No auth.** Patient ID in URL for demo purposes.

## Architecture

```
CSV Data (5 files)
    ↓
Data Loader (CSV → SQLite)
    ↓
Patient Profile Builder (joins across tables)
    ↓
Session Delta Engine (rules-based analysis)
    ↓
FastAPI REST API
    ↓
Next.js App Router
   /           \
Patient View    Clinician Dashboard
```

- **Session delta engine** is purely rules-based — transparent, auditable, no black box.
- **LLM is not used anywhere.** Plain language summaries are template-driven from structured engine output.
- **Single Next.js app** serves both patient and clinician experiences.

## Backend

### Stack
- Python 3.11+, FastAPI, SQLite (via sqlite3 stdlib), Uvicorn

### Data Loader (`data_loader.py`)
- Reads 5 CSVs (patients, encounters, vitals, lab_results, medications) into SQLite tables on startup
- Creates indexes on patient_id, encounter_id, encounter_date for query performance
- Provides query functions: `get_patient(id)`, `get_encounters(patient_id)`, `get_labs(patient_id)`, `get_vitals(patient_id)`, `get_meds(patient_id)`

### Session Delta Engine (`session_delta.py`)

Core intelligence. For a given patient, computes:

#### Lab Trajectories
- Groups labs by test type (HbA1c, glucose, cholesterol, TSH, etc.)
- For each test type: chronological values, trend classification (improving/stable/worsening/spiking), threshold crossings (normal→abnormal or vice versa), rate of change
- Output: `{test_name, values: [{date, value, facility, abnormal}], trend, current_status}`

#### Vital Sign Trajectories
- Same logic for systolic_bp, diastolic_bp, heart_rate, o2_saturation across encounters
- Trend direction and acceleration detection

#### Medication Analysis
- **Therapeutic duplication:** Drug class lookup table → flag when 2+ active meds share a class (e.g., pantoprazole + omeprazole = duplicate PPIs)
- **Temporal correlations:** If a symptom (from chief_complaint) appeared within 12 weeks of starting a drug, check against known correlation rules:
  - ACE inhibitors (lisinopril, ramipril) → cough
  - Statins → joint/muscle pain
  - Prednisone → glucose/HbA1c spike
  - SSRIs (escitalopram, sertraline) → nausea, dizziness
  - Metoprolol → dizziness, fatigue
- **Expiring medications:** Active meds with end_date approaching (within 30 days) and no renewal
- **Cross-facility meds:** Meds prescribed at facilities different from the current encounter's facility

#### Care Gap Detection
Cross-reference diagnosis codes against monitoring rules:
- Type 2 diabetes (E11.9) → HbA1c every 6 months
- Hypertension (I10) → BP check every 6 months
- Depression (F32.9) → follow-up within 8 weeks of medication change
- Any active medication → check if end_date approaching with no renewal

#### Cross-Facility Delta
For a given facility: what happened at OTHER facilities since the patient's last visit here.
- New diagnoses
- New medications started
- ER visits (may indicate deterioration)

#### Output Structure
All findings as structured JSON. No prose generation in the engine.

```json
{
  "patient": { "id": "...", "name": "...", "age": 65, "sex": "M" },
  "lab_trajectories": [...],
  "vital_trajectories": [...],
  "medication_alerts": {
    "duplications": [...],
    "temporal_correlations": [...],
    "expiring": [...],
    "cross_facility": [...]
  },
  "care_gaps": [...],
  "cross_facility_delta": {...},
  "recent_encounters": [...]
}
```

### Plain Language Templates (`templates.py`)
Converts structured engine output to patient-friendly language:
- `"HbA1c trend worsening"` → `"Your blood sugar levels have been rising over your last few tests"`
- `"metformin expiring in 14 days"` → `"Your diabetes medication (metformin — helps control blood sugar) expires in 14 days"`
- Drug names get plain-language purpose descriptions (lookup table)
- Supports English, French, Mandarin, Punjabi via translation templates

### API Endpoints (`main.py`)

```
GET /api/patients                    → list all patients (with alert counts for clinician list)
GET /api/patients/{id}               → patient demographics
GET /api/patients/{id}/summary       → patient-facing smart summary (plain language)
GET /api/patients/{id}/clinical-brief → clinician-facing session delta (clinical language)
GET /api/patients/{id}/timeline      → chronological encounter history
GET /api/patients/{id}/labs          → lab results with trajectories
GET /api/patients/{id}/vitals        → vitals with trajectories
GET /api/patients/{id}/medications   → active meds with alerts
```

## Frontend

### Stack
- Next.js 14+ (App Router), TypeScript, Tailwind CSS, Recharts (for graphs/sparklines)

### Pages

#### `/` — Demo Landing
- Clean entry point with 3 demo patient cards:
  - PAT-001918 Jose (65M) — "HbA1c spike across 5 facilities, prednisone-glucose correlation"
  - PAT-001792 Michael (44M) — "Duplicate PPIs, unmanaged diabetes and cholesterol"
  - PAT-001421 William (40M) — "Elevated LDL pattern, HbA1c trending up"
- Each card shows a brief description of the clinical scenario
- Click → enters the app with view toggle between patient and clinician perspectives

#### `/patient/[id]` — Patient Smart Summary

**Health Pulse (top)** — 3-4 cards for most important right-now items:
- Active alerts in plain language ("Your blood sugar levels have been rising")
- Pending actions ("Your prescription for [drug — what it does] expires in 14 days")
- Care gaps ("You're due for a blood pressure check")

**Health Timeline (middle)** — chronological view of encounters across all facilities:
- Key events highlighted (new diagnosis, abnormal lab, medication change)
- Visual, scrollable, scannable
- Facility indicated with color/icon

**Details on Demand (bottom)** — expandable sections:
- Active medications (common name + plain-language purpose, tooltip for clinical details)
- Recent lab results (plain language with visual indicators)
- Vitals trends (simple graphs with plain-language labels)

**Design principles:**
- Plain language throughout. "Blood sugar levels" not "HbA1c"
- Drug tooltips: hover/tap shows drug class, dosage, prescriber, DIN
- Localized by patient's `primary_language`
- Reduce context burnout — surface what matters, hide details behind progressive disclosure

#### `/dashboard` — Clinician Dashboard

**Patient List (left/top)** — searchable, sortable list:
- Patients with active alerts/care gaps bubble to top
- Each row shows: name, age/sex, alert count, last visit
- Click to select and load brief

**Pre-Visit Clinical Brief (main area):**

- **Session Delta** — what changed since last visit at this facility + what happened elsewhere:
  - Lab trajectories with sparkline charts (actual data points plotted on time axis showing acceleration/deceleration)
  - Vital sign trends with proper trend lines
  - New diagnoses from other facilities
  - Cross-facility encounter summary

- **Active Alerts** — clinical framing:
  - Abnormal labs with trajectory and rate of change
  - Medication risks (duplications with drug class, temporal correlations with mechanism)
  - Care gaps citing monitoring guidelines and time since last test

- **Medications** — full active list:
  - Flags for therapeutic duplication (drug class shown)
  - Approaching expiry
  - New meds from other facilities (highlighted)
  - DIN codes, dosage, frequency, prescriber

- **Patient's Recent Encounters** — table of recent visits with facility, complaint, diagnosis, disposition

**Graph requirements:**
- Sparklines for lab/vital trends show individual data points connected by lines
- Time axis is properly scaled (not evenly spaced if visits are irregular)
- Reference range bands shown (normal range as shaded background)
- Trend direction indicated with color (green=improving, yellow=stable, red=worsening)
- Hover shows exact value, date, facility for each data point

### View Toggle
- Clear mechanism to switch between patient and clinician views for the same patient
- Instant switch — both views pre-loaded
- Visual indication of current view mode

## Demo Patients

### PAT-001918 (Jose, 65M)
- 309 encounters across all 5 facilities
- HbA1c: 4.98% → 5.62% → 10.87% (accelerating deterioration)
- On prednisone (known glucose elevator) with no diabetes medication
- Critically low sodium (113 mmol/L)
- Most recent visit: asthma
- Demonstrates: session delta, temporal correlation (prednisone→glucose), care gap, cross-facility intelligence

### PAT-001792 (Michael, 44M)
- 74 encounters
- Pantoprazole AND omeprazole (duplicate PPIs)
- HbA1c 8.1% with no diabetes medication
- Cholesterol 6.21 with no statin
- Demonstrates: therapeutic duplication, multiple care gaps

### PAT-001421 (William, 40M)
- 219 encounters
- HbA1c spiked to 6.94%
- LDL consistently elevated (4.48, 4.91, 4.52)
- On sertraline + sitagliptin but no statin despite lipid pattern
- Demonstrates: persistent pattern detection, missing treatment flag

## File Structure

```
healthsync/
├── backend/
│   ├── main.py              # FastAPI app + API endpoints
│   ├── models.py            # Pydantic models for API responses
│   ├── data_loader.py       # CSV → SQLite ingestion + query functions
│   ├── session_delta.py     # Rules-based longitudinal analysis engine
│   ├── medication_rules.py  # Drug class mappings + correlation rules
│   ├── care_gap_rules.py    # Diagnosis → monitoring requirement rules
│   ├── templates.py         # Plain language template renderer
│   └── database.py          # SQLite connection management
├── frontend/
│   ├── app/
│   │   ├── page.tsx         # Demo landing page
│   │   ├── layout.tsx       # Root layout
│   │   ├── patient/
│   │   │   └── [id]/
│   │   │       └── page.tsx # Patient smart summary
│   │   └── dashboard/
│   │       └── page.tsx     # Clinician dashboard
│   ├── components/
│   │   ├── HealthPulse.tsx      # Patient alert cards
│   │   ├── HealthTimeline.tsx   # Encounter timeline
│   │   ├── MedList.tsx          # Medication list (patient-friendly)
│   │   ├── DrugTooltip.tsx      # Plain-language drug info tooltip
│   │   ├── PatientList.tsx      # Clinician patient selector
│   │   ├── ClinicalBrief.tsx    # Session delta + alerts
│   │   ├── TrendChart.tsx       # Sparkline/trend graphs (Recharts)
│   │   ├── CareGapCard.tsx      # Care gap alert display
│   │   └── ViewToggle.tsx       # Patient/clinician view switcher
│   ├── lib/
│   │   └── api.ts           # API client functions
│   ├── package.json
│   ├── tailwind.config.ts
│   └── tsconfig.json
├── data/                    # CSV files (existing)
├── requirements.txt
└── docs/
```

## Verification

1. **Backend:** Start FastAPI server, hit `/api/patients/PAT-001918/clinical-brief`, verify session delta output includes HbA1c trajectory, prednisone correlation, care gaps
2. **Patient view:** Load `/patient/PAT-001918`, verify plain-language alerts, timeline, medication tooltips
3. **Clinician view:** Load `/dashboard`, select PAT-001918, verify clinical brief with sparklines, delta panel, medication flags
4. **Cross-patient:** Switch to PAT-001792, verify duplicate PPI detection and care gaps render correctly
5. **Graphs:** Verify trend charts show actual data points on proper time axis with reference range bands
6. **View toggle:** Switch between patient and clinician views, verify same data rendered differently
