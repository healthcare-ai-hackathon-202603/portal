"use client";

import type { CareGap } from "@/lib/types";

interface CareGapCardProps {
  gap: CareGap;
}

export default function CareGapCard({ gap }: CareGapCardProps) {
  const severityClass = gap.severity === "urgent" ? "badge-urgent" : "badge-warning";

  return (
    <div
      className={`card p-5 ${gap.severity === "urgent" ? "glow-urgent" : ""}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4
            className="text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {gap.condition}
          </h4>
          <span
            className="font-mono text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            {gap.diagnosis_code}
          </span>
        </div>
        <span
          className={`${severityClass} text-xs font-medium px-2 py-0.5 rounded-md`}
        >
          {gap.severity.toUpperCase()}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span
            className="text-xs uppercase tracking-wide"
            style={{ color: "var(--text-muted)" }}
          >
            Required
          </span>
          <span
            className="text-sm font-medium"
            style={{ color: "var(--text-secondary)" }}
          >
            {gap.required_test}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span
            className="text-xs uppercase tracking-wide"
            style={{ color: "var(--text-muted)" }}
          >
            Last tested
          </span>
          <span
            className="text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            {gap.last_test_date
              ? new Date(gap.last_test_date).toLocaleDateString("en-CA", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })
              : "No record found"}
          </span>
        </div>

        {gap.months_overdue != null && (
          <div
            className="text-sm font-semibold mt-1"
            style={{
              color:
                gap.severity === "urgent"
                  ? "var(--color-urgent)"
                  : "var(--color-warning)",
            }}
          >
            {gap.months_overdue} months overdue
          </div>
        )}

        <div
          className="text-xs mt-2 pt-2"
          style={{
            color: "var(--text-muted)",
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          Guideline: {gap.required_test} every {gap.frequency_months} months
        </div>
      </div>
    </div>
  );
}
