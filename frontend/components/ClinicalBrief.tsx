"use client";

import { useState, useEffect } from "react";
import type {
  SessionDelta,
  LabTrajectory,
  VitalTrajectory,
  MedicationDuplication,
  TemporalCorrelation,
  ExpiringMedication,
  CrossFacilityMed,
  Encounter,
  PatientIssue,
  CareGap,
} from "@/lib/types";
import { FACILITY_COLORS, FACILITY_SHORT_NAMES } from "@/lib/types";
import { getPatientIssues } from "@/lib/api";
import TrendChart from "@/components/TrendChart";
import CareGapCard from "@/components/CareGapCard";

/* ── Helpers ─────────────────────────────────────────── */

const trendOrder: Record<string, number> = {
  spiking: 0,
  worsening: 1,
  improving: 2,
  stable: 3,
};

function TrendBadge({ trend }: { trend: string }) {
  const cls = `trend-${trend}`;
  const badgeBg: Record<string, string> = {
    spiking: "badge-urgent",
    worsening: "badge-warning",
    improving: "badge-healthy",
    stable: "badge-info",
  };
  return (
    <span
      className={`${badgeBg[trend] ?? "badge-info"} ${cls} text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded`}
    >
      {trend}
    </span>
  );
}

function SectionHeading({
  title,
  count,
}: {
  title: string;
  count?: number;
}) {
  return (
    <h3
      className="text-xs font-semibold uppercase tracking-widest mb-4 flex items-center gap-2"
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

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/* ── Sub-sections ────────────────────────────────────── */

function LabTrajectoryCard({ lab }: { lab: LabTrajectory }) {
  const sign = lab.change_percent >= 0 ? "+" : "";
  return (
    <div className="card p-5 overflow-hidden">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4
            className="text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {lab.test_name}
          </h4>
          <span
            className="font-mono text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            {lab.test_code} &middot; {lab.unit}
          </span>
        </div>
        <TrendBadge trend={lab.trend} />
      </div>

      <div className="flex items-baseline gap-3 mb-4">
        <span
          className="font-mono text-lg font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {lab.latest_value} {lab.unit}
        </span>
        <span
          className={`font-mono text-xs trend-${lab.trend}`}
        >
          {sign}{lab.change_percent.toFixed(1)}%
        </span>
        <span
          className="text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          from {lab.earliest_value} {lab.unit}
        </span>
      </div>

      <div style={{ height: 160, width: "100%" }}>
        <TrendChart
          data={lab.values}
          title={lab.test_name}
          unit={lab.unit}
          trend={lab.trend}
          referenceRangeLow={lab.reference_range_low}
          referenceRangeHigh={lab.reference_range_high}
        />
      </div>
    </div>
  );
}

function VitalTrajectoryCard({ vital }: { vital: VitalTrajectory }) {
  return (
    <div className="card p-5 overflow-hidden">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4
            className="text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {vital.vital_name}
          </h4>
          <span
            className="text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            Ref: {vital.normal_range}
          </span>
        </div>
        <TrendBadge trend={vital.trend} />
      </div>

      <div className="mb-4">
        <span
          className="font-mono text-2xl font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {vital.latest_value}
        </span>
        <span
          className="text-sm ml-1"
          style={{ color: "var(--text-muted)" }}
        >
          {vital.unit}
        </span>
      </div>

      <div style={{ height: 140, width: "100%" }}>
        <TrendChart
          data={vital.values}
          title={vital.vital_name}
          unit={vital.unit}
          trend={vital.trend}
        />
      </div>
    </div>
  );
}

function DuplicationAlert({ dup }: { dup: MedicationDuplication }) {
  return (
    <div className="card p-4 glow-urgent">
      <div className="flex items-center gap-2 mb-2">
        <span className="badge-urgent text-[11px] font-semibold px-2 py-0.5 rounded">
          DUPLICATION
        </span>
        <span
          className="text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          {dup.drug_class}
        </span>
      </div>
      <div className="space-y-1">
        {dup.drugs.map((drug, i) => {
          const detail = dup.drug_details[i] as Record<string, string> | undefined;
          return (
            <div key={drug} className="flex items-center gap-2">
              <span
                className="font-mono text-sm"
                style={{ color: "var(--color-urgent)" }}
              >
                {drug}
              </span>
              {detail?.dosage && (
                <span
                  className="text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  {detail.dosage}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CorrelationAlert({ corr }: { corr: TemporalCorrelation }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="badge-warning text-[11px] font-semibold px-2 py-0.5 rounded">
          CORRELATION
        </span>
      </div>
      <div className="space-y-1">
        <div>
          <span
            className="font-mono text-sm font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            {corr.drug_name}
          </span>
          <span
            className="text-xs ml-2"
            style={{ color: "var(--text-muted)" }}
          >
            started {formatDate(corr.drug_started)}
          </span>
        </div>
        <div
          className="text-sm"
          style={{ color: "var(--color-warning)" }}
        >
          Correlated symptom: {corr.symptom}
          <span
            className="text-xs ml-1"
            style={{ color: "var(--text-muted)" }}
          >
            ({formatDate(corr.symptom_date)})
          </span>
        </div>
        <div
          className="text-xs italic"
          style={{ color: "var(--text-muted)" }}
        >
          {corr.mechanism}
        </div>
      </div>
    </div>
  );
}

function ExpiringMedAlert({ med }: { med: ExpiringMedication }) {
  const isUrgent = med.days_remaining <= 7;
  return (
    <div className={`card p-4 ${isUrgent ? "glow-urgent" : ""}`}>
      <div className="flex items-center justify-between">
        <div>
          <span
            className="font-mono text-sm font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            {med.drug_name}
          </span>
          <div
            className="text-xs mt-0.5"
            style={{ color: "var(--text-muted)" }}
          >
            Expires {formatDate(med.end_date)}
          </div>
        </div>
        <span
          className={`${isUrgent ? "badge-urgent" : "badge-warning"} text-[11px] font-semibold px-2 py-0.5 rounded`}
        >
          {med.days_remaining}d remaining
        </span>
      </div>
    </div>
  );
}

function CrossFacilityMedCard({ med }: { med: CrossFacilityMed }) {
  const color = FACILITY_COLORS[med.facility] ?? "var(--text-accent)";
  const shortName = FACILITY_SHORT_NAMES[med.facility] ?? med.facility;

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div>
          <span
            className="font-mono text-sm font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            {med.drug_name}
          </span>
          <div
            className="text-xs mt-0.5"
            style={{ color: "var(--text-muted)" }}
          >
            Prescribed by {med.prescriber} &middot;{" "}
            {formatDate(med.start_date)}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="facility-dot"
            style={{ backgroundColor: color }}
          />
          <span
            className="text-xs font-medium"
            style={{ color }}
          >
            {shortName}
          </span>
        </div>
      </div>
    </div>
  );
}

function EncounterRow({ enc }: { enc: Encounter }) {
  const color = FACILITY_COLORS[enc.facility] ?? "var(--text-muted)";
  const shortFacility =
    FACILITY_SHORT_NAMES[enc.facility] ?? enc.facility;

  return (
    <tr
      className="border-0"
      style={{ borderBottom: "1px solid var(--border-subtle)" }}
    >
      <td className="py-2.5 px-3 whitespace-nowrap">
        <span
          className="text-sm font-mono"
          style={{ color: "var(--text-secondary)" }}
        >
          {formatDate(enc.encounter_date)}
        </span>
      </td>
      <td className="py-2.5 px-3 whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          <span className="facility-dot" style={{ backgroundColor: color }} />
          <span className="text-sm" style={{ color }}>
            {shortFacility}
          </span>
        </div>
      </td>
      <td className="py-2.5 px-3 whitespace-nowrap">
        <span
          className="text-xs uppercase tracking-wide"
          style={{ color: "var(--text-muted)" }}
        >
          {enc.encounter_type}
        </span>
      </td>
      <td className="py-2.5 px-3">
        <span
          className="text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          {enc.chief_complaint}
        </span>
      </td>
      <td className="py-2.5 px-3">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span
            className="font-mono text-xs whitespace-nowrap"
            style={{ color: "var(--text-muted)" }}
          >
            {enc.diagnosis_code}
          </span>
          <span
            className="text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            {enc.diagnosis_description}
          </span>
        </div>
      </td>
      <td className="py-2.5 px-3 whitespace-nowrap">
        <span
          className="text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          {enc.disposition}
        </span>
      </td>
    </tr>
  );
}

/* ── Diagnosis → Lab Metric Mapping ─────────────────── */

const DIAGNOSIS_METRICS: Record<string, string[]> = {
  "E11.9": ["HbA1c", "Fasting Glucose", "Creatinine"],
  "I10": ["Systolic BP", "Diastolic BP", "Creatinine", "Potassium"],
  "F32.9": [],
  "E78.5": ["Total Cholesterol", "LDL", "HDL"],
  "E03.9": ["TSH"],
  "N18.3": ["Creatinine", "Potassium", "Sodium"],
  "J45.20": ["O2 Saturation"],
};

/* ── Issue Card (collapsible) ───────────────────────── */

function IssueCard({
  issue,
  defaultExpanded,
  labTrajectories,
  encounters,
  careGaps,
}: {
  issue: PatientIssue;
  defaultExpanded: boolean;
  labTrajectories: LabTrajectory[];
  encounters: Encounter[];
  careGaps: CareGap[];
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const relatedMetrics = DIAGNOSIS_METRICS[issue.diagnosis_code] ?? [];
  const relatedLabs = labTrajectories.filter((l) =>
    relatedMetrics.includes(l.test_name)
  );
  const relatedEncounters = encounters.filter(
    (e) => e.diagnosis_code === issue.diagnosis_code
  );
  const relatedGaps = careGaps.filter(
    (g) => g.diagnosis_code === issue.diagnosis_code
  );

  const hasContent =
    issue.linked_medications.length > 0 ||
    relatedLabs.length > 0 ||
    relatedEncounters.length > 0 ||
    relatedGaps.length > 0;

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-5 flex items-center justify-between cursor-pointer border-0"
        style={{ background: "transparent" }}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4
              className="text-sm font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {issue.diagnosis_description}
            </h4>
            <span
              className="font-mono text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              {issue.diagnosis_code}
            </span>
            <span
              className="text-[10px] font-mono px-1.5 py-0.5 rounded"
              style={{
                background: "var(--bg-surface)",
                color: "var(--text-secondary)",
              }}
            >
              {issue.encounter_count} enc
            </span>
          </div>
          <div
            className="flex items-center gap-3 mt-1 text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            <span>First seen: {formatDate(issue.first_seen)}</span>
            <span>Last seen: {formatDate(issue.last_seen)}</span>
            <span>{issue.facilities.length} facilities</span>
          </div>
        </div>
        <span
          className="text-sm shrink-0 ml-3 transition-transform duration-200"
          style={{
            color: "var(--text-muted)",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          &#9660;
        </span>
      </button>

      {expanded && hasContent && (
        <div
          className="px-5 pb-5 space-y-4 animate-fade-in"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        >
          {/* Linked Medications */}
          {issue.linked_medications.length > 0 && (
            <div className="pt-4">
              <h5
                className="text-[11px] font-semibold uppercase tracking-widest mb-2"
                style={{ color: "var(--text-muted)" }}
              >
                Linked Medications
              </h5>
              <div className="flex flex-wrap gap-2">
                {issue.linked_medications.map((med) => (
                  <span
                    key={med}
                    className="text-xs font-mono px-2 py-1 rounded"
                    style={{
                      background: "var(--bg-surface)",
                      color: "var(--text-secondary)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    {med}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Related Lab Trajectories */}
          {relatedLabs.length > 0 && (
            <div>
              <h5
                className="text-[11px] font-semibold uppercase tracking-widest mb-2"
                style={{ color: "var(--text-muted)" }}
              >
                Related Labs
              </h5>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {relatedLabs.map((lab) => (
                  <LabTrajectoryCard key={lab.test_code} lab={lab} />
                ))}
              </div>
            </div>
          )}

          {/* Related Care Gaps */}
          {relatedGaps.length > 0 && (
            <div>
              <h5
                className="text-[11px] font-semibold uppercase tracking-widest mb-2"
                style={{ color: "var(--text-muted)" }}
              >
                Care Gaps
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {relatedGaps.map((gap) => (
                  <CareGapCard
                    key={`issue-${gap.diagnosis_code}-${gap.required_test}`}
                    gap={gap}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Related Encounters */}
          {relatedEncounters.length > 0 && (
            <div>
              <h5
                className="text-[11px] font-semibold uppercase tracking-widest mb-2"
                style={{ color: "var(--text-muted)" }}
              >
                Related Encounters ({relatedEncounters.length})
              </h5>
              <div className="space-y-1">
                {relatedEncounters.slice(0, 5).map((enc) => {
                  const color = FACILITY_COLORS[enc.facility] ?? "var(--text-muted)";
                  const shortFacility = FACILITY_SHORT_NAMES[enc.facility] ?? enc.facility;
                  return (
                    <div
                      key={enc.encounter_id}
                      className="flex items-center gap-3 py-1.5 px-2 rounded"
                      style={{ background: "var(--bg-surface)" }}
                    >
                      <span
                        className="text-xs font-mono"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {formatDate(enc.encounter_date)}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="facility-dot" style={{ backgroundColor: color }} />
                        <span className="text-xs" style={{ color }}>
                          {shortFacility}
                        </span>
                      </div>
                      <span
                        className="text-xs truncate"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {enc.chief_complaint}
                      </span>
                      <span
                        className="text-[10px] uppercase tracking-wide ml-auto shrink-0"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {enc.disposition}
                      </span>
                    </div>
                  );
                })}
                {relatedEncounters.length > 5 && (
                  <div
                    className="text-xs pt-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    + {relatedEncounters.length - 5} more encounters
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {expanded && !hasContent && (
        <div
          className="px-5 pb-5 pt-3 text-xs"
          style={{
            color: "var(--text-muted)",
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          No linked data found for this issue.
        </div>
      )}
    </div>
  );
}

/* ── Issue-Driven View ──────────────────────────────── */

function IssueView({
  issues,
  loading,
  labTrajectories,
  encounters,
  careGaps,
}: {
  issues: PatientIssue[];
  loading: boolean;
  labTrajectories: LabTrajectory[];
  encounters: Encounter[];
  careGaps: CareGap[];
}) {
  const [showPrior, setShowPrior] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <span
          className="text-sm animate-pulse-soft"
          style={{ color: "var(--text-muted)" }}
        >
          Loading patient issues...
        </span>
      </div>
    );
  }

  const activeIssues = issues.filter((i) => i.status === "active");
  const priorIssues = issues.filter((i) => i.status === "prior");

  if (activeIssues.length === 0 && priorIssues.length === 0) {
    return (
      <div className="flex items-center justify-center h-32">
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
          No issues found for this patient.
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Issues */}
      {activeIssues.length > 0 && (
        <section>
          <SectionHeading title="Active Issues" count={activeIssues.length} />
          <div className="space-y-3 stagger">
            {activeIssues.map((issue, idx) => (
              <IssueCard
                key={`${issue.diagnosis_code}-${issue.first_seen}`}
                issue={issue}
                defaultExpanded={idx < 3}
                labTrajectories={labTrajectories}
                encounters={encounters}
                careGaps={careGaps}
              />
            ))}
          </div>
        </section>
      )}

      {/* Prior Issues */}
      {priorIssues.length > 0 && (
        <section>
          <button
            onClick={() => setShowPrior(!showPrior)}
            className="flex items-center gap-2 mb-3 cursor-pointer border-0 bg-transparent p-0"
          >
            <h3
              className="text-xs font-semibold uppercase tracking-widest flex items-center gap-2"
              style={{ color: "var(--text-muted)" }}
            >
              Prior Issues
              <span
                className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                style={{
                  background: "var(--bg-surface)",
                  color: "var(--text-secondary)",
                }}
              >
                {priorIssues.length}
              </span>
              <span
                className="text-sm transition-transform duration-200"
                style={{
                  transform: showPrior ? "rotate(180deg)" : "rotate(0deg)",
                }}
              >
                &#9660;
              </span>
            </h3>
          </button>
          {showPrior && (
            <div className="space-y-3 stagger">
              {priorIssues.map((issue) => (
                <IssueCard
                  key={`prior-${issue.diagnosis_code}-${issue.first_seen}`}
                  issue={issue}
                  defaultExpanded={false}
                  labTrajectories={labTrajectories}
                  encounters={encounters}
                  careGaps={careGaps}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/* ── Category View (original layout) ────────────────── */

function CategoryView({
  labTrajectories,
  vitalTrajectories,
  medication_alerts,
  sortedGaps,
  last10Encounters,
  hasMedAlerts,
}: {
  labTrajectories: LabTrajectory[];
  vitalTrajectories: VitalTrajectory[];
  medication_alerts: SessionDelta["medication_alerts"];
  sortedGaps: CareGap[];
  last10Encounters: Encounter[];
  hasMedAlerts: boolean;
}) {
  return (
    <>
      {/* Lab Trajectories */}
      {labTrajectories.length > 0 && (
        <section>
          <SectionHeading
            title="Lab Trajectories"
            count={labTrajectories.length}
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 stagger">
            {labTrajectories.map((lab) => (
              <LabTrajectoryCard key={lab.test_code} lab={lab} />
            ))}
          </div>
        </section>
      )}

      {/* Vital Trajectories */}
      {vitalTrajectories.length > 0 && (
        <section>
          <SectionHeading
            title="Vital Trajectories"
            count={vitalTrajectories.length}
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 stagger">
            {vitalTrajectories.map((vital) => (
              <VitalTrajectoryCard key={vital.vital_name} vital={vital} />
            ))}
          </div>
        </section>
      )}

      {/* Medication Alerts */}
      {hasMedAlerts && (
        <section>
          <SectionHeading title="Medication Alerts" />

          {medication_alerts.duplications.length > 0 && (
            <div className="mb-4">
              <h4
                className="text-xs font-medium uppercase tracking-wide mb-2"
                style={{ color: "var(--color-urgent)" }}
              >
                Therapeutic Duplications
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {medication_alerts.duplications.map((dup) => (
                  <DuplicationAlert key={dup.drug_class} dup={dup} />
                ))}
              </div>
            </div>
          )}

          {medication_alerts.temporal_correlations.length > 0 && (
            <div className="mb-4">
              <h4
                className="text-xs font-medium uppercase tracking-wide mb-2"
                style={{ color: "var(--color-warning)" }}
              >
                Temporal Correlations
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {medication_alerts.temporal_correlations.map((corr, i) => (
                  <CorrelationAlert key={`corr-${corr.drug_name}-${corr.symptom_date}-${i}`} corr={corr} />
                ))}
              </div>
            </div>
          )}

          {medication_alerts.expiring.length > 0 && (
            <div className="mb-4">
              <h4
                className="text-xs font-medium uppercase tracking-wide mb-2"
                style={{ color: "var(--color-warning)" }}
              >
                Expiring Medications
              </h4>
              <div className="space-y-2">
                {medication_alerts.expiring.map((med, i) => (
                  <ExpiringMedAlert key={`exp-${med.drug_name}-${i}`} med={med} />
                ))}
              </div>
            </div>
          )}

          {medication_alerts.cross_facility.length > 0 && (
            <div className="mb-4">
              <h4
                className="text-xs font-medium uppercase tracking-wide mb-2"
                style={{ color: "var(--text-accent)" }}
              >
                Cross-Facility Medications
              </h4>
              <div className="space-y-2">
                {medication_alerts.cross_facility.map((med, i) => (
                  <CrossFacilityMedCard
                    key={`xfac-${med.drug_name}-${med.facility}-${i}`}
                    med={med}
                  />
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Care Gaps */}
      {sortedGaps.length > 0 && (
        <section>
          <SectionHeading title="Care Gaps" count={sortedGaps.length} />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
            {sortedGaps.map((gap) => (
              <CareGapCard
                key={`${gap.diagnosis_code}-${gap.required_test}`}
                gap={gap}
              />
            ))}
          </div>
        </section>
      )}

      {/* Recent Encounters */}
      {last10Encounters.length > 0 && (
        <section>
          <SectionHeading
            title="Recent Encounters"
            count={last10Encounters.length}
          />
          <div className="card-elevated overflow-x-auto rounded-2xl">
            <table className="w-full text-left min-w-[700px]" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid var(--border-default)",
                  }}
                >
                  {["Date", "Facility", "Type", "Chief Complaint", "Diagnosis", "Disposition"].map(
                    (h) => (
                      <th
                        key={h}
                        className="py-3 px-3 text-[11px] font-semibold uppercase tracking-widest whitespace-nowrap"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {last10Encounters.map((enc) => (
                  <EncounterRow key={enc.encounter_id} enc={enc} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

/* ── Main Component ──────────────────────────────────── */

interface ClinicalBriefProps {
  brief: SessionDelta;
}

export default function ClinicalBrief({ brief }: ClinicalBriefProps) {
  const { patient, medication_alerts, care_gaps, recent_encounters } = brief;

  const [viewMode, setViewMode] = useState<"category" | "issue">("category");
  const [issues, setIssues] = useState<PatientIssue[]>([]);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [issuesFetched, setIssuesFetched] = useState<string | null>(null);

  // Fetch issues when switching to issue view (lazy load)
  useEffect(() => {
    if (viewMode !== "issue") return;
    if (issuesFetched === patient.patient_id) return;

    setLoadingIssues(true);
    getPatientIssues(patient.patient_id)
      .then((data) => {
        setIssues(data);
        setIssuesFetched(patient.patient_id);
        setLoadingIssues(false);
      })
      .catch(() => {
        setIssues([]);
        setIssuesFetched(patient.patient_id);
        setLoadingIssues(false);
      });
  }, [viewMode, patient.patient_id, issuesFetched]);

  // Reset issues when patient changes
  useEffect(() => {
    if (issuesFetched && issuesFetched !== patient.patient_id) {
      setIssues([]);
      setIssuesFetched(null);
    }
  }, [patient.patient_id, issuesFetched]);

  // Filter and sort lab trajectories: non-stable, spiking first
  const labTrajectories = [...brief.lab_trajectories]
    .filter((l) => l.trend !== "stable")
    .sort((a, b) => (trendOrder[a.trend] ?? 3) - (trendOrder[b.trend] ?? 3));

  // All lab trajectories (including stable) for issue view
  const allLabTrajectories = [...brief.lab_trajectories].sort(
    (a, b) => (trendOrder[a.trend] ?? 3) - (trendOrder[b.trend] ?? 3)
  );

  // Filter and sort vital trajectories similarly
  const vitalTrajectories = [...brief.vital_trajectories]
    .filter((v) => v.trend !== "stable")
    .sort((a, b) => (trendOrder[a.trend] ?? 3) - (trendOrder[b.trend] ?? 3));

  // Sort care gaps: urgent first
  const sortedGaps = [...care_gaps].sort((a, b) =>
    a.severity === "urgent" && b.severity !== "urgent" ? -1 : b.severity === "urgent" && a.severity !== "urgent" ? 1 : 0
  );

  const last10Encounters = recent_encounters.slice(0, 10);

  const hasMedAlerts =
    medication_alerts.duplications.length > 0 ||
    medication_alerts.temporal_correlations.length > 0 ||
    medication_alerts.expiring.length > 0 ||
    medication_alerts.cross_facility.length > 0;

  return (
    <div className="space-y-8 animate-fade-in max-w-[1200px]">
      {/* Patient Header */}
      <div className="card-elevated p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-2xl font-semibold"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--text-primary)",
              }}
            >
              {patient.last_name}, {patient.first_name}
            </h1>
            <div
              className="flex items-center gap-4 mt-1 text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              <span>{patient.age}y {patient.sex}</span>
              <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>
                DOB {formatDate(patient.date_of_birth)}
              </span>
              <span>Blood: {patient.blood_type}</span>
              <span>Lang: {patient.primary_language}</span>
              <span
                className="font-mono text-xs"
                style={{ color: "var(--text-accent)" }}
              >
                {patient.patient_id}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex items-center justify-between">
        <div className="view-toggle">
          <button
            className={`view-toggle-btn ${viewMode === "category" ? "active" : ""}`}
            onClick={() => setViewMode("category")}
          >
            By Category
          </button>
          <button
            className={`view-toggle-btn ${viewMode === "issue" ? "active" : ""}`}
            onClick={() => setViewMode("issue")}
          >
            By Issue
          </button>
        </div>
      </div>

      {/* Content based on view mode */}
      {viewMode === "category" ? (
        <CategoryView
          labTrajectories={labTrajectories}
          vitalTrajectories={vitalTrajectories}
          medication_alerts={medication_alerts}
          sortedGaps={sortedGaps}
          last10Encounters={last10Encounters}
          hasMedAlerts={hasMedAlerts}
        />
      ) : (
        <IssueView
          issues={issues}
          loading={loadingIssues}
          labTrajectories={allLabTrajectories}
          encounters={recent_encounters}
          careGaps={care_gaps}
        />
      )}
    </div>
  );
}
