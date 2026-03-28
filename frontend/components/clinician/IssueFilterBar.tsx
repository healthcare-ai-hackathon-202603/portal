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
