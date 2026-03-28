# Clinician Dashboard Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the data-dump clinical brief with an issue-centric clinician view featuring radial gauges, issue filtering, medication accordion, and tiered patient sort.

**Architecture:** New `ClinicianPanel` orchestrator component replaces `ClinicalBrief` in the dashboard page. It manages a `selectedIssue` state that filters four child components: `IssueFilterBar`, `MedTable`, `RadialGauge` grid, and `ComplaintList`. All data comes from existing API endpoints — no backend changes.

**Tech Stack:** Next.js 16, React 19, Recharts 3, Tailwind CSS, existing dark theme CSS variables.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `frontend/components/clinician/RadialGauge.tsx` | SVG arc gauge for a single lab result |
| Create | `frontend/components/clinician/IssueFilterBar.tsx` | Horizontal chip bar for issue selection |
| Create | `frontend/components/clinician/MedTable.tsx` | Medication table with accordion detail |
| Create | `frontend/components/clinician/ComplaintList.tsx` | Compact encounter/complaint list |
| Create | `frontend/components/clinician/ClinicianPanel.tsx` | Orchestrator: demographics header + 4 sections + filter state |
| Create | `frontend/lib/clinician-filters.ts` | Issue-to-data filter logic + condition-test/drug mappings |
| Modify | `frontend/app/dashboard/page.tsx` | Swap `ClinicalBrief` for `ClinicianPanel`, add new data fetching |
| Modify | `frontend/components/PatientList.tsx` | Update sort to tiered: triage → staleness → pending actions |

---

### Task 1: Issue-to-Data Filter Mappings

**Files:**
- Create: `frontend/lib/clinician-filters.ts`

This module contains the condition→test and condition→drug-class mappings that power issue filtering, plus the filter functions.

- [ ] **Step 1: Create the filter module**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/lib/clinician-filters.ts
git commit -m "feat(clinician): add issue-to-data filter mappings"
```

---

### Task 2: RadialGauge Component

**Files:**
- Create: `frontend/components/clinician/RadialGauge.tsx`

Pure SVG radial gauge — arc track with color zones, center hero number, trend label at bottom.

- [ ] **Step 1: Create the clinician components directory**

```bash
mkdir -p frontend/components/clinician
```

- [ ] **Step 2: Create RadialGauge component**

```tsx
// frontend/components/clinician/RadialGauge.tsx
"use client";

import type { LabTrajectory } from "@/lib/types";

interface RadialGaugeProps {
  lab: LabTrajectory;
  onShowDetails: (testName: string) => void;
  isDetailOpen: boolean;
}

const TREND_COLORS: Record<string, string> = {
  improving: "var(--color-improving)",
  stable: "var(--color-stable)",
  worsening: "var(--color-worsening)",
  spiking: "var(--color-spiking)",
};

const TREND_ARROWS: Record<string, string> = {
  improving: "\u2193",
  stable: "\u2192",
  worsening: "\u2191",
  spiking: "\u2191\u2191",
};

// Arc geometry constants
const CX = 90;
const CY = 90;
const RADIUS = 70;
const START_ANGLE = 135; // degrees, bottom-left
const END_ANGLE = 405; // degrees, bottom-right (270° sweep)
const SWEEP = END_ANGLE - START_ANGLE;

function polarToCartesian(angle: number): { x: number; y: number } {
  const rad = ((angle - 90) * Math.PI) / 180;
  return {
    x: CX + RADIUS * Math.cos(rad),
    y: CY + RADIUS * Math.sin(rad),
  };
}

function describeArc(startAngle: number, endAngle: number): string {
  const start = polarToCartesian(endAngle);
  const end = polarToCartesian(startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

function valueToAngle(
  value: number,
  min: number,
  max: number
): number {
  const clamped = Math.max(min, Math.min(max, value));
  const ratio = (clamped - min) / (max - min);
  return START_ANGLE + ratio * SWEEP;
}

function getArcColor(
  value: number,
  low: number,
  high: number
): string {
  if (value >= low && value <= high) return "var(--color-healthy)";
  const range = high - low;
  const margin = range * 0.1;
  if (
    (value >= low - margin && value < low) ||
    (value > high && value <= high + margin)
  )
    return "var(--color-warning)";
  return "var(--color-urgent)";
}

export default function RadialGauge({
  lab,
  onShowDetails,
  isDetailOpen,
}: RadialGaugeProps) {
  const { test_name, unit, latest_value, reference_range_low, reference_range_high, trend, change_percent } = lab;

  // Scale: extend 30% beyond reference range on each side
  const range = reference_range_high - reference_range_low;
  const scaleMin = reference_range_low - range * 0.3;
  const scaleMax = reference_range_high + range * 0.3;

  // Arc angles for reference range (green zone)
  const refStartAngle = valueToAngle(reference_range_low, scaleMin, scaleMax);
  const refEndAngle = valueToAngle(reference_range_high, scaleMin, scaleMax);

  // Needle angle for current value
  const needleAngle = valueToAngle(latest_value, scaleMin, scaleMax);
  const needlePos = polarToCartesian(needleAngle);

  const arcColor = getArcColor(latest_value, reference_range_low, reference_range_high);
  const trendColor = TREND_COLORS[trend] ?? "var(--color-info)";
  const sign = change_percent >= 0 ? "+" : "";

  return (
    <div className="flex flex-col items-center">
      <div
        className="card p-4 flex flex-col items-center cursor-pointer transition-all duration-150"
        style={{
          borderColor: isDetailOpen ? "var(--border-focus)" : undefined,
        }}
        onClick={() => onShowDetails(test_name)}
      >
        <svg width="180" height="130" viewBox="0 0 180 130">
          {/* Background track */}
          <path
            d={describeArc(START_ANGLE, END_ANGLE)}
            fill="none"
            stroke="var(--bg-surface)"
            strokeWidth="10"
            strokeLinecap="round"
          />

          {/* Reference range (green zone) */}
          <path
            d={describeArc(refStartAngle, refEndAngle)}
            fill="none"
            stroke="rgba(52, 211, 153, 0.25)"
            strokeWidth="10"
            strokeLinecap="round"
          />

          {/* Active arc from start to needle */}
          <path
            d={describeArc(START_ANGLE, needleAngle)}
            fill="none"
            stroke={arcColor}
            strokeWidth="10"
            strokeLinecap="round"
          />

          {/* Needle dot */}
          <circle
            cx={needlePos.x}
            cy={needlePos.y}
            r="6"
            fill={arcColor}
            stroke="var(--bg-secondary)"
            strokeWidth="2"
          />

          {/* Center hero value */}
          <text
            x={CX}
            y={CY - 6}
            textAnchor="middle"
            fill="var(--text-primary)"
            fontSize="22"
            fontWeight="700"
            fontFamily="var(--font-mono)"
          >
            {latest_value % 1 === 0 ? latest_value : latest_value.toFixed(1)}
          </text>
          <text
            x={CX}
            y={CY + 12}
            textAnchor="middle"
            fill="var(--text-muted)"
            fontSize="11"
          >
            {unit}
          </text>

          {/* Trend label at bottom */}
          <text
            x={CX}
            y={CY + 36}
            textAnchor="middle"
            fill={trendColor}
            fontSize="11"
            fontWeight="600"
          >
            {TREND_ARROWS[trend]} {trend.charAt(0).toUpperCase() + trend.slice(1)} {sign}{change_percent.toFixed(0)}%
          </text>
        </svg>

        {/* Test name below */}
        <span
          className="text-xs font-medium mt-1"
          style={{ color: "var(--text-secondary)" }}
        >
          {test_name}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/components/clinician/RadialGauge.tsx
git commit -m "feat(clinician): add RadialGauge SVG component"
```

---

### Task 3: IssueFilterBar Component

**Files:**
- Create: `frontend/components/clinician/IssueFilterBar.tsx`

Horizontal scrollable chip bar with "All" default + issue chips with severity dots.

- [ ] **Step 1: Create IssueFilterBar component**

```tsx
// frontend/components/clinician/IssueFilterBar.tsx
"use client";

import type { PatientIssue, CareGap, LabTrajectory } from "@/lib/types";
import { getIssueSeverity } from "@/lib/clinician-filters";

interface IssueFilterBarProps {
  issues: PatientIssue[];
  careGaps: CareGap[];
  labs: LabTrajectory[];
  selectedIssue: string | null;
  onSelect: (code: string | null) => void;
}

const SEVERITY_COLORS: Record<string, string> = {
  urgent: "var(--color-urgent)",
  warning: "var(--color-warning)",
  info: "var(--color-info)",
};

const SEVERITY_BADGE: Record<string, string> = {
  urgent: "badge-urgent",
  warning: "badge-warning",
  info: "badge-info",
};

export default function IssueFilterBar({
  issues,
  careGaps,
  labs,
  selectedIssue,
  onSelect,
}: IssueFilterBarProps) {
  const careGapCodes = careGaps.map((g) => g.diagnosis_code);
  const abnormalLabNames = labs
    .filter((l) => l.current_status !== "normal")
    .map((l) => l.test_name);

  // Sort issues: active first, then by severity
  const severityOrder: Record<string, number> = { urgent: 0, warning: 1, info: 2 };
  const activeIssues = issues
    .filter((i) => i.status === "active")
    .map((i) => ({
      ...i,
      severity: getIssueSeverity(i, careGapCodes, abnormalLabNames),
    }))
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return (
    <div
      className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none"
      style={{ scrollbarWidth: "none" }}
    >
      {/* All chip */}
      <button
        onClick={() => onSelect(null)}
        className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 border cursor-pointer"
        style={{
          background: selectedIssue === null ? "var(--bg-surface)" : "transparent",
          borderColor: selectedIssue === null ? "var(--border-focus)" : "var(--border-subtle)",
          color: selectedIssue === null ? "var(--text-primary)" : "var(--text-secondary)",
        }}
      >
        All
      </button>

      {activeIssues.map((issue) => {
        const isActive = selectedIssue === issue.diagnosis_code;
        return (
          <button
            key={issue.diagnosis_code}
            onClick={() =>
              onSelect(isActive ? null : issue.diagnosis_code)
            }
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 border cursor-pointer"
            style={{
              background: isActive ? "var(--bg-surface)" : "transparent",
              borderColor: isActive ? "var(--border-focus)" : "var(--border-subtle)",
              color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
            }}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: SEVERITY_COLORS[issue.severity] }}
            />
            {issue.diagnosis_description}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/clinician/IssueFilterBar.tsx
git commit -m "feat(clinician): add IssueFilterBar chip component"
```

---

### Task 4: MedTable Component

**Files:**
- Create: `frontend/components/clinician/MedTable.tsx`

Compact medication table with summary rows and accordion expand for details.

- [ ] **Step 1: Create MedTable component**

```tsx
// frontend/components/clinician/MedTable.tsx
"use client";

import { useState } from "react";
import type { MedicationAlerts } from "@/lib/types";
import { getDrugClass } from "@/lib/clinician-filters";

export interface MedRow {
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

interface MedTableProps {
  medications: MedRow[];
  alerts: MedicationAlerts;
}

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const end = new Date(dateStr);
  const now = new Date("2026-03-28");
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function renewalColor(days: number | null): string {
  if (days === null) return "var(--text-muted)";
  if (days < 7) return "var(--color-urgent)";
  if (days <= 30) return "var(--color-warning)";
  return "var(--color-healthy)";
}

function renewalLabel(days: number | null): string {
  if (days === null) return "No end date";
  if (days < 0) return `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return "Expires today";
  return `${days}d remaining`;
}

function getAlertBadges(
  drugName: string,
  alerts: MedicationAlerts
): { label: string; className: string; detail: string }[] {
  const badges: { label: string; className: string; detail: string }[] = [];
  const lower = drugName.toLowerCase();

  for (const dup of alerts.duplications) {
    if (dup.drugs.some((d) => d.toLowerCase() === lower)) {
      const others = dup.drugs.filter((d) => d.toLowerCase() !== lower);
      badges.push({
        label: "DUP",
        className: "badge-urgent",
        detail: `Duplicate ${dup.drug_class}: also on ${others.join(", ")}`,
      });
    }
  }
  for (const tc of alerts.temporal_correlations) {
    if (tc.drug_name.toLowerCase() === lower) {
      badges.push({
        label: "TC",
        className: "badge-warning",
        detail: `${tc.mechanism}`,
      });
    }
  }
  for (const cf of alerts.cross_facility) {
    if (cf.drug_name.toLowerCase() === lower) {
      badges.push({
        label: "XF",
        className: "badge-info",
        detail: `Prescribed at ${cf.facility} by ${cf.prescriber}`,
      });
    }
  }
  return badges;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function MedTable({ medications, alerts }: MedTableProps) {
  const [expandedMed, setExpandedMed] = useState<string | null>(null);

  const active = medications.filter((m) => m.active);
  const inactive = medications.filter((m) => !m.active);

  function renderRow(med: MedRow) {
    const days = daysUntil(med.end_date);
    const isExpanded = expandedMed === med.name;
    const badges = getAlertBadges(med.name, alerts);

    return (
      <div key={med.name}>
        <button
          onClick={() => setExpandedMed(isExpanded ? null : med.name)}
          className="w-full text-left px-4 py-3 flex items-center gap-4 transition-colors duration-150 cursor-pointer border-0"
          style={{
            background: isExpanded ? "var(--bg-elevated)" : "transparent",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          {/* Drug name */}
          <span
            className="flex-1 min-w-0 text-sm font-medium truncate"
            style={{
              color: med.active ? "var(--text-primary)" : "var(--text-muted)",
            }}
          >
            {med.name}
            {badges.map((b) => (
              <span
                key={b.label}
                className={`${b.className} text-[10px] font-semibold px-1.5 py-0.5 rounded ml-2`}
              >
                {b.label}
              </span>
            ))}
          </span>

          {/* Dose + frequency */}
          <span
            className="text-xs shrink-0 w-40 truncate"
            style={{ color: "var(--text-secondary)" }}
          >
            {med.dosage} {med.frequency}
          </span>

          {/* Renewal */}
          <span
            className="text-xs font-mono shrink-0 w-28 text-right"
            style={{ color: renewalColor(days) }}
          >
            {renewalLabel(days)}
          </span>

          {/* Expand indicator */}
          <span
            className="text-xs shrink-0 transition-transform duration-150"
            style={{
              color: "var(--text-muted)",
              transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
            }}
          >
            &#9662;
          </span>
        </button>

        {/* Expanded detail */}
        {isExpanded && (
          <div
            className="px-6 py-3 text-xs space-y-1.5 animate-fade-in"
            style={{ background: "var(--bg-elevated)" }}
          >
            <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
              <div>
                <span style={{ color: "var(--text-muted)" }}>Prescriber: </span>
                <span style={{ color: "var(--text-secondary)" }}>{med.prescriber}</span>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }}>Route: </span>
                <span style={{ color: "var(--text-secondary)" }}>{med.route}</span>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }}>Start: </span>
                <span style={{ color: "var(--text-secondary)" }}>{formatDate(med.start_date)}</span>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }}>End: </span>
                <span style={{ color: "var(--text-secondary)" }}>
                  {med.end_date ? formatDate(med.end_date) : "Ongoing"}
                </span>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }}>DIN: </span>
                <span className="font-mono" style={{ color: "var(--text-secondary)" }}>
                  {med.drug_code}
                </span>
              </div>
              {med.facility && (
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Facility: </span>
                  <span style={{ color: "var(--text-secondary)" }}>{med.facility}</span>
                </div>
              )}
            </div>
            {badges.length > 0 && (
              <div className="pt-1.5 space-y-1">
                {badges.map((b) => (
                  <div key={b.label} className="flex items-start gap-2">
                    <span className={`${b.className} text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0`}>
                      {b.label}
                    </span>
                    <span style={{ color: "var(--text-secondary)" }}>{b.detail}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {active.map(renderRow)}
      {inactive.length > 0 && (
        <>
          <div
            className="px-4 py-2 text-[10px] uppercase tracking-widest"
            style={{
              color: "var(--text-muted)",
              background: "var(--bg-surface)",
              borderTop: "1px solid var(--border-subtle)",
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            Inactive
          </div>
          {inactive.map(renderRow)}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/clinician/MedTable.tsx
git commit -m "feat(clinician): add MedTable with accordion detail"
```

---

### Task 5: ComplaintList Component

**Files:**
- Create: `frontend/components/clinician/ComplaintList.tsx`

Compact reverse-chronological encounter list with facility badges.

- [ ] **Step 1: Create ComplaintList component**

```tsx
// frontend/components/clinician/ComplaintList.tsx
"use client";

import { useState } from "react";
import type { Encounter } from "@/lib/types";
import { FACILITY_COLORS, FACILITY_SHORT_NAMES } from "@/lib/types";

interface ComplaintListProps {
  encounters: Encounter[];
}

function relativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date("2026-03-28");
  const diffMs = now.getTime() - date.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const ENCOUNTER_TYPE_BADGE: Record<string, string> = {
  emergency: "badge-urgent",
  inpatient: "badge-warning",
  outpatient: "badge-info",
};

export default function ComplaintList({ encounters }: ComplaintListProps) {
  const [showAll, setShowAll] = useState(false);

  const sorted = [...encounters].sort(
    (a, b) => new Date(b.encounter_date).getTime() - new Date(a.encounter_date).getTime()
  );
  const visible = showAll ? sorted : sorted.slice(0, 10);

  return (
    <div className="space-y-1">
      {visible.map((enc) => (
        <div
          key={enc.encounter_id}
          className="flex items-start gap-3 px-4 py-2.5 rounded-lg transition-colors duration-100"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          {/* Date */}
          <div className="shrink-0 w-16 text-right">
            <div className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
              {relativeDate(enc.encounter_date)}
            </div>
            <div
              className="text-[10px]"
              style={{ color: "var(--text-muted)" }}
              title={formatDate(enc.encounter_date)}
            >
              {formatDate(enc.encounter_date)}
            </div>
          </div>

          {/* Facility dot + name */}
          <div className="flex items-center gap-1.5 shrink-0 w-14">
            <span
              className="facility-dot"
              style={{ backgroundColor: FACILITY_COLORS[enc.facility] ?? "var(--text-muted)" }}
            />
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {FACILITY_SHORT_NAMES[enc.facility] ?? enc.facility}
            </span>
          </div>

          {/* Type badge */}
          <span
            className={`${ENCOUNTER_TYPE_BADGE[enc.encounter_type] ?? "badge-info"} text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0`}
          >
            {enc.encounter_type}
          </span>

          {/* Complaint */}
          <span
            className="text-xs flex-1 min-w-0"
            style={{ color: "var(--text-secondary)" }}
          >
            {enc.chief_complaint}
          </span>
        </div>
      ))}

      {sorted.length > 10 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full text-center py-2 text-xs cursor-pointer border-0 bg-transparent"
          style={{ color: "var(--text-accent)" }}
        >
          {showAll ? "Show less" : `Show all ${sorted.length} encounters`}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/clinician/ComplaintList.tsx
git commit -m "feat(clinician): add ComplaintList component"
```

---

### Task 6: ClinicianPanel Orchestrator

**Files:**
- Create: `frontend/components/clinician/ClinicianPanel.tsx`

Manages filter state, renders sticky demographics header + 4 sections, coordinates detail expand for gauges.

- [ ] **Step 1: Create ClinicianPanel component**

```tsx
// frontend/components/clinician/ClinicianPanel.tsx
"use client";

import { useState, useMemo } from "react";
import type {
  Patient,
  SessionDelta,
  PatientIssue,
  LabTrajectory,
  MedicationsResponse,
} from "@/lib/types";
import {
  filterLabsByIssue,
  filterMedsByIssue,
  filterEncountersByIssue,
} from "@/lib/clinician-filters";
import type { MedRow } from "./MedTable";
import IssueFilterBar from "./IssueFilterBar";
import MedTable from "./MedTable";
import RadialGauge from "./RadialGauge";
import ComplaintList from "./ComplaintList";
import TrendChart from "@/components/TrendChart";

interface ClinicianPanelProps {
  patient: Patient;
  brief: SessionDelta;
  issues: PatientIssue[];
  medications: MedicationsResponse;
}

const trendOrder: Record<string, number> = {
  spiking: 0,
  worsening: 1,
  stable: 2,
  improving: 3,
};

function SectionHeading({ title, count }: { title: string; count?: number }) {
  return (
    <h3
      className="text-xs font-semibold uppercase tracking-widest mb-3 flex items-center gap-2"
      style={{ color: "var(--text-muted)" }}
    >
      {title}
      {count != null && count > 0 && (
        <span
          className="text-[10px] font-mono px-1.5 py-0.5 rounded"
          style={{
            background: "var(--bg-surface)",
            color: "var(--text-secondary)",
          }}
        >
          {count}
        </span>
      )}
    </h3>
  );
}

export default function ClinicianPanel({
  patient,
  brief,
  issues,
  medications,
}: ClinicianPanelProps) {
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
  const [detailTest, setDetailTest] = useState<string | null>(null);

  // Transform medications response to MedRow[]
  const medRows: MedRow[] = useMemo(() => {
    return medications.medications.map((m: Record<string, unknown>) => ({
      name: (m.drug_name as string) ?? (m.name as string) ?? "",
      dosage: (m.dosage as string) ?? "",
      frequency: (m.frequency as string) ?? "",
      active: (m.active as boolean) ?? true,
      end_date: (m.end_date as string) ?? undefined,
      prescriber: (m.prescriber as string) ?? "",
      start_date: (m.start_date as string) ?? "",
      route: (m.route as string) ?? "",
      drug_code: (m.drug_code as string) ?? "",
      facility: (m.facility as string) ?? undefined,
    }));
  }, [medications]);

  // Filtered data
  const filteredLabs = useMemo(
    () =>
      filterLabsByIssue(brief.lab_trajectories, selectedIssue).sort(
        (a, b) => (trendOrder[a.trend] ?? 9) - (trendOrder[b.trend] ?? 9)
      ),
    [brief.lab_trajectories, selectedIssue]
  );

  const filteredMeds = useMemo(
    () => filterMedsByIssue(medRows, selectedIssue),
    [medRows, selectedIssue]
  );

  const filteredEncounters = useMemo(
    () => filterEncountersByIssue(brief.recent_encounters, selectedIssue),
    [brief.recent_encounters, selectedIssue]
  );

  // Detail chart data
  const detailLab = detailTest
    ? brief.lab_trajectories.find((l) => l.test_name === detailTest)
    : null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Sticky Demographics Header */}
      <div
        className="sticky top-0 z-10 flex items-center gap-4 px-1 py-3"
        style={{ background: "var(--bg-primary)" }}
      >
        <h2
          className="text-lg font-semibold"
          style={{
            fontFamily: "var(--font-display)",
            color: "var(--text-primary)",
          }}
        >
          {patient.first_name} {patient.last_name}
        </h2>
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {patient.age}{patient.sex.charAt(0).toUpperCase()}
        </span>
        <span
          className="text-[11px] px-2 py-0.5 rounded"
          style={{
            background: "var(--bg-surface)",
            color: "var(--text-secondary)",
          }}
        >
          {patient.blood_type}
        </span>
        {patient.primary_language !== "English" && (
          <span
            className="text-[11px] px-2 py-0.5 rounded"
            style={{
              background: "rgba(110, 207, 255, 0.1)",
              color: "var(--text-accent)",
            }}
          >
            {patient.primary_language}
          </span>
        )}
      </div>

      {/* Section 1: Issue Filter Bar */}
      <div>
        <SectionHeading title="Active Issues" count={issues.filter((i) => i.status === "active").length} />
        <IssueFilterBar
          issues={issues}
          careGaps={brief.care_gaps}
          labs={brief.lab_trajectories}
          selectedIssue={selectedIssue}
          onSelect={setSelectedIssue}
        />
      </div>

      {/* Section 2: Medications */}
      <div>
        <SectionHeading title="Medications" count={filteredMeds.length} />
        {filteredMeds.length > 0 ? (
          <MedTable medications={filteredMeds} alerts={brief.medication_alerts} />
        ) : (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            No medications {selectedIssue ? "for this condition" : "on record"}
          </p>
        )}
      </div>

      {/* Section 3: Test Results — Radial Gauges */}
      <div>
        <SectionHeading title="Test Results" count={filteredLabs.length} />
        {filteredLabs.length > 0 ? (
          <>
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
              {filteredLabs.map((lab) => (
                <RadialGauge
                  key={lab.test_name}
                  lab={lab}
                  onShowDetails={(name) =>
                    setDetailTest(detailTest === name ? null : name)
                  }
                  isDetailOpen={detailTest === lab.test_name}
                />
              ))}
            </div>

            {/* Detail TrendChart */}
            {detailLab && (
              <div className="mt-4 card p-5 animate-fade-in">
                <div className="flex items-center justify-between mb-3">
                  <h4
                    className="text-sm font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {detailLab.test_name} — Trend Detail
                  </h4>
                  <button
                    onClick={() => setDetailTest(null)}
                    className="text-xs cursor-pointer border-0 bg-transparent"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Close
                  </button>
                </div>
                <div className="h-48">
                  <TrendChart
                    data={detailLab.values}
                    title={detailLab.test_name}
                    unit={detailLab.unit}
                    trend={detailLab.trend}
                    referenceRangeLow={detailLab.reference_range_low}
                    referenceRangeHigh={detailLab.reference_range_high}
                  />
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            No test results {selectedIssue ? "for this condition" : "on record"}
          </p>
        )}
      </div>

      {/* Section 4: Complaints & Encounters */}
      <div>
        <SectionHeading title="Encounters" count={filteredEncounters.length} />
        {filteredEncounters.length > 0 ? (
          <ComplaintList encounters={filteredEncounters} />
        ) : (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            No encounters {selectedIssue ? "for this condition" : "on record"}
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/clinician/ClinicianPanel.tsx
git commit -m "feat(clinician): add ClinicianPanel orchestrator"
```

---

### Task 7: Update Dashboard Page

**Files:**
- Modify: `frontend/app/dashboard/page.tsx`

Replace `ClinicalBrief` import with `ClinicianPanel`. Add fetching for patient details, issues, and medications alongside the clinical brief.

- [ ] **Step 1: Update dashboard page**

Replace the contents of `frontend/app/dashboard/page.tsx` with:

```tsx
"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  getPatients,
  getClinicalBrief,
  getPatient,
  getPatientIssues,
  getMedications,
} from "@/lib/api";
import type {
  PatientListItem,
  SessionDelta,
  Patient,
  PatientIssue,
  MedicationsResponse,
} from "@/lib/types";
import PatientList from "@/components/PatientList";
import ClinicianPanel from "@/components/clinician/ClinicianPanel";
import ViewToggle from "@/components/ViewToggle";

interface PatientData {
  patient: Patient;
  brief: SessionDelta;
  issues: PatientIssue[];
  medications: MedicationsResponse;
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const preselected = searchParams.get("patient");

  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(preselected);
  const [patientData, setPatientData] = useState<PatientData | null>(null);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loadingBrief, setLoadingBrief] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load patient list
  useEffect(() => {
    setLoadingPatients(true);
    getPatients()
      .then((data) => {
        setPatients(data);
        setLoadingPatients(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoadingPatients(false);
      });
  }, []);

  // Load all patient data when selected
  useEffect(() => {
    if (!selectedId) {
      setPatientData(null);
      return;
    }
    setLoadingBrief(true);
    setError(null);

    Promise.all([
      getPatient(selectedId),
      getClinicalBrief(selectedId),
      getPatientIssues(selectedId),
      getMedications(selectedId),
    ])
      .then(([patient, brief, issues, medications]) => {
        setPatientData({ patient, brief, issues, medications });
        setLoadingBrief(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoadingBrief(false);
      });
  }, [selectedId]);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    window.history.replaceState(null, "", `/dashboard?patient=${id}`);
  }, []);

  return (
    <div
      className="h-screen flex flex-col"
      style={{ background: "var(--bg-primary)" }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-3 shrink-0"
        style={{
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--bg-secondary)",
        }}
      >
        <div className="flex items-center gap-4">
          <h1
            className="text-lg font-semibold tracking-tight"
            style={{
              fontFamily: "var(--font-display)",
              color: "var(--text-primary)",
            }}
          >
            HealthSync
          </h1>
          <span
            className="text-xs uppercase tracking-widest"
            style={{ color: "var(--text-muted)" }}
          >
            Clinical Dashboard
          </span>
        </div>
        {selectedId && (
          <ViewToggle currentView="clinician" patientId={selectedId} />
        )}
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside
          className="w-80 shrink-0 flex flex-col"
          style={{
            borderRight: "1px solid var(--border-subtle)",
            background: "var(--bg-secondary)",
          }}
        >
          {loadingPatients ? (
            <div className="flex items-center justify-center h-full">
              <div
                className="text-sm animate-pulse-soft"
                style={{ color: "var(--text-muted)" }}
              >
                Loading patients...
              </div>
            </div>
          ) : (
            <PatientList
              patients={patients}
              selectedId={selectedId}
              onSelect={handleSelect}
            />
          )}
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-6">
          {error && (
            <div className="card p-4 mb-4 glow-urgent">
              <span
                className="text-sm"
                style={{ color: "var(--color-urgent)" }}
              >
                {error}
              </span>
            </div>
          )}

          {!selectedId && !error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p
                  className="text-lg"
                  style={{
                    fontFamily: "var(--font-display)",
                    color: "var(--text-muted)",
                  }}
                >
                  Select a patient to view clinical brief
                </p>
                <p
                  className="text-sm mt-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  Flagged patients appear at the top of the list
                </p>
              </div>
            </div>
          )}

          {selectedId && loadingBrief && (
            <div className="flex items-center justify-center h-64">
              <div className="space-y-3 text-center">
                <div
                  className="text-sm animate-pulse-soft"
                  style={{ color: "var(--text-muted)" }}
                >
                  Generating clinical brief...
                </div>
                <div
                  className="text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  Computing session delta for {selectedId}
                </div>
              </div>
            </div>
          )}

          {patientData && !loadingBrief && (
            <ClinicianPanel
              patient={patientData.patient}
              brief={patientData.brief}
              issues={patientData.issues}
              medications={patientData.medications}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div
          className="h-screen flex items-center justify-center"
          style={{ background: "var(--bg-primary)" }}
        >
          <div
            className="text-sm animate-pulse-soft"
            style={{ color: "var(--text-muted)" }}
          >
            Loading dashboard...
          </div>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/dashboard/page.tsx
git commit -m "feat(clinician): wire ClinicianPanel into dashboard page"
```

---

### Task 8: Update PatientList Sort Logic

**Files:**
- Modify: `frontend/components/PatientList.tsx`

Update sort from urgency+alert_score to tiered: triage level → days since last encounter → pending action count. The urgency classification already provides triage-based levels (red/yellow/green), so we keep using that as the first tier. For the second tier, we need last encounter date — available from urgency reasons. For now, we use the existing urgency level as tier 1 and alert_score as a proxy for pending actions (it already counts abnormal labs + active meds).

The actual change is small: urgency data already provides triage-based sorting. We add a subtitle showing last encounter date context from the urgency reasons.

- [ ] **Step 1: Add last encounter context to PatientList rows**

In `frontend/components/PatientList.tsx`, replace the `urgency && (` block (lines 210-216) that shows `urgency.label` with a version that also extracts the most relevant reason:

Find this block:
```tsx
                    {urgency && (
                      <div
                        className="text-[10px] mt-0.5 truncate"
                        style={{ color: URGENCY_DOT_COLOR[urgency.level] }}
                      >
                        {urgency.label}
                      </div>
                    )}
```

Replace with:
```tsx
                    {urgency && (
                      <div
                        className="text-[10px] mt-0.5 truncate"
                        style={{ color: URGENCY_DOT_COLOR[urgency.level] }}
                      >
                        {urgency.reasons?.[0] ?? urgency.label}
                      </div>
                    )}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/PatientList.tsx
git commit -m "feat(clinician): show top urgency reason in patient list"
```

---

### Task 9: Verify Build and Test

**Files:** None (verification only)

- [ ] **Step 1: Run the Next.js dev build to check for compilation errors**

```bash
cd frontend && npx next build 2>&1 | head -50
```

Expected: Build succeeds with no TypeScript or import errors.

- [ ] **Step 2: Start the dev server and verify the dashboard loads**

```bash
cd frontend && npx next dev &
# Wait for startup, then test the dashboard URL
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/dashboard
```

Expected: 200 status code.

- [ ] **Step 3: Fix any issues found during build**

If build errors exist, fix TypeScript errors, missing imports, or type mismatches.

- [ ] **Step 4: Final commit if fixes were needed**

```bash
git add -A
git commit -m "fix(clinician): resolve build issues"
```
