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

  function handleIssueSelect(code: string | null) {
    setSelectedIssue(code);
    setDetailTest(null);
  }

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
        className="sticky top-0 z-10 flex items-center gap-4 px-1 py-2 max-h-12"
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
          onSelect={handleIssueSelect}
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
