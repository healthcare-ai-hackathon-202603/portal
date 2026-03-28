# Clinician Dashboard Redesign — Design Spec

## Goal

Replace the current data-dump clinical brief with an **issue-centric** clinician view that reduces cognitive load through progressive disclosure. Clinicians land on a full overview, then drill into specific issues to see only relevant meds, labs, and complaints.

## Layout

Two-panel layout (unchanged structure):

- **Left panel (~300px):** Patient list with updated sort logic
- **Right panel (remaining viewport):** Patient focus area with sticky demographics header and 4 stacked sections

## Left Panel — Patient List

### Sort Order (Tiered)

1. **Triage level** — most urgent first (CTAS 1 > 2 > 3 > 4 > 5). Derived from most recent encounter's triage_level.
2. **Days since last encounter** — stalest first within same triage tier
3. **Pending action count** — most pending actions first as tiebreaker. Pending actions = expiring meds + overdue care gaps + unreviewed abnormal labs.

### Row Display

- Patient name, age/sex
- Urgency dot (red/yellow/green — existing)
- Last encounter date (relative: "3d ago", "2mo ago")
- Pending action count badge (number in circle, colored by highest severity)

### Existing Features Kept

- Search bar at top
- Async urgency fetch for first 20 patients
- Click to select patient

## Right Panel — Patient Focus

### Sticky Header: Patient Demographics

Always visible at top of right panel when a patient is selected.

| Field | Display |
|-------|---------|
| Name | Full name, bold |
| Age | Years |
| Sex | M/F |
| Blood Type | Badge |
| Language | Badge (flag icon if non-English) |

Single horizontal row. Compact — no more than 48px height.

### Section 1: Issue Filter Bar

Horizontal row of pill/chip buttons representing active issues (diagnoses).

- **"All" chip** selected by default — no filtering applied
- Each issue chip: diagnosis description + severity dot (urgent/warning/info)
- Severity derived from: has care gap (urgent) > has abnormal related lab (warning) > stable (info)
- Clicking a chip toggles it active — filters Sections 2–4 to only related data
- Clicking again or clicking "All" resets to unfiltered view
- Scrollable horizontally if many issues

### Issue-to-Data Linking

When an issue is selected, filter logic:

- **Medications**: Match via `medication_rules.py` drug class → condition mapping. E.g., selecting "Type 2 Diabetes" shows metformin, insulin, sitagliptin.
- **Test Results**: Match via `care_gap_rules.py` diagnosis → required test mapping. E.g., "Type 2 Diabetes" → HbA1c, fasting glucose.
- **Complaints**: Match via diagnosis code on encounters. Show encounters where `diagnosis_code` matches the selected issue.

This reuses existing backend rule mappings — no new API endpoints needed.

### Section 2: Medications

#### Summary View (Default)

Compact table with columns:

| Column | Content |
|--------|---------|
| Drug Name | Name, bold if active |
| Dose | Dosage + frequency (e.g., "500mg twice daily") |
| Renewal | Days until end_date. Color: green (>30d), yellow (7–30d), red (<7d or expired) |

Inactive medications shown below active, visually dimmed.

Alert badges inline:
- **Duplication**: Red badge "DUP" — two meds in same drug class
- **Temporal correlation**: Yellow badge "TC" — suspected side-effect link
- **Cross-facility**: Blue badge "XF" — prescribed at different facility

#### Detail View (Accordion Expand)

Clicking a medication row expands inline to show:

- Prescriber name
- Start date / End date
- Route (oral, IV, etc.)
- Drug code (DIN)
- Prescribing facility
- Any active alerts with descriptions (e.g., "Duplicate PPI: also on omeprazole")

### Section 3: Test Results — Radial Gauges

Grid layout of small radial gauge cards. One gauge per distinct test type.

#### Gauge Anatomy

```
        ╭─── arc track (colored) ───╮
       /                             \
      /     ┌─────────────┐          \
     |      │   10.87     │          |
     |      │  mmol/L     │          |
      \     └─────────────┘          /
       \    ↑ Spiking +94%          /
        ╰───────────────────────────╯
              HbA1c
```

- **Arc track**: Represents min–max scale. Active portion colored:
  - Green: value within reference range
  - Yellow: value within 10% of boundary
  - Red: value outside reference range
- **Arc fill position**: Needle/marker position shows where current value sits on the scale
- **Center hero number**: Latest test value + unit, large font
- **Trend label (bottom)**: Direction + magnitude. Examples: "↑ Spiking +94%", "→ Stable", "↓ Improving -8%". Color matches trend severity.
- **Test name label**: Below the gauge

#### Grid Behavior

- 3–4 gauges per row depending on viewport width
- Sorted by clinical urgency: spiking → worsening → stable → improving
- When filtered by issue: only relevant tests displayed

#### Detail Expand

Each gauge has a subtle "Details" button. Clicking it expands a section below the gauge grid showing the full `TrendChart` component (existing) for that test — line chart with reference band, data points colored by facility, tooltip with value/date/facility.

Only one detail chart open at a time — clicking another gauge's "Details" swaps it.

### Section 4: Complaints & Encounters

Compact reverse-chronological list of recent encounters.

Each row:
- Date (relative + absolute on hover)
- Facility badge (colored dot + short name)
- Encounter type badge (outpatient/emergency/inpatient)
- Chief complaint text

When filtered by issue: only encounters with matching `diagnosis_code` shown.

Limited to 10 visible by default with "Show all" expand.

## Components

### New Components

| Component | Purpose |
|-----------|---------|
| `RadialGauge.tsx` | Single radial gauge visualization for a test result |
| `IssueFilterBar.tsx` | Horizontal chip bar for issue selection + filtering logic |
| `MedTable.tsx` | Medication table with summary/detail accordion |
| `ComplaintList.tsx` | Compact encounter/complaint list |
| `ClinicianPanel.tsx` | Orchestrator: sticky header + 4 sections, manages filter state |

### Reused Components

| Component | Usage |
|-----------|-------|
| `TrendChart.tsx` | Detail expand from radial gauge |
| `PatientList.tsx` | Left panel (sort logic updated) |
| `ViewToggle.tsx` | Header navigation |

### Removed/Replaced

| Component | Replaced By |
|-----------|-------------|
| `ClinicalBrief.tsx` | `ClinicianPanel.tsx` + new sub-components |

`ClinicalBrief.tsx` is not deleted — kept for reference — but no longer imported by the dashboard page.

## Data Flow

```
Dashboard page
├── PatientList (left panel)
│   └── GET /api/patients → sorted client-side by triage tier
│
└── ClinicianPanel (right panel, when patient selected)
    ├── GET /api/patients/{id} → demographics header
    ├── GET /api/patients/{id}/clinical-brief → SessionDelta
    │   ├── lab_trajectories → RadialGauge grid
    │   ├── medication_alerts → MedTable alert badges
    │   ├── care_gaps → issue severity dots
    │   └── recent_encounters → ComplaintList
    ├── GET /api/patients/{id}/issues → IssueFilterBar chips
    └── GET /api/patients/{id}/medications → MedTable rows
```

All filtering is client-side. No new API endpoints.

## Issue Filter State

```typescript
// ClinicianPanel state
const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
// null = "All" (no filter)
// string = diagnosis_code of selected issue

// Filter functions
function filterMeds(meds: PatientMedication[], issueCode: string): PatientMedication[]
function filterLabs(labs: LabTrajectory[], issueCode: string): LabTrajectory[]
function filterEncounters(encounters: Encounter[], issueCode: string): Encounter[]
```

Mapping data (condition → tests, condition → drug classes) fetched from existing backend rule sets or hardcoded client-side to match `care_gap_rules.py` and `medication_rules.py`.

## Styling

Follows existing dark theme CSS variables. No new color tokens needed.

- Radial gauges use `--color-urgent`, `--color-warning`, `--color-healthy` for arc coloring
- Issue chips use `badge-urgent`, `badge-warning`, `badge-info` classes
- Medication accordion uses `--bg-elevated` for expanded state
- Gauge grid uses CSS Grid with `auto-fill, minmax(180px, 1fr)`

## Out of Scope

- Backend API changes
- New data models
- Patient view changes
- Chat widget on clinician view
- Medication interaction checking beyond existing rules
