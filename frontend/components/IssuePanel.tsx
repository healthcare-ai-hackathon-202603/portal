"use client";

import { useState } from "react";
import type { PatientIssue } from "@/lib/types";
import { FACILITY_COLORS, FACILITY_SHORT_NAMES } from "@/lib/types";
import { SectionHeader } from "@/components/ActionCenter";

interface IssuePanelProps {
  issues: PatientIssue[];
  selectedIssue: string | null;
  onIssueSelect: (code: string | null) => void;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function IssueRow({
  issue,
  isSelected,
  onSelect,
}: {
  issue: PatientIssue;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  function handleClick() {
    onSelect();
    setExpanded(!expanded);
  }

  return (
    <div
      className="rounded-xl transition-all duration-200 cursor-pointer"
      style={{
        background: isSelected
          ? "var(--bg-elevated)"
          : "var(--bg-secondary)",
        border: isSelected
          ? "1px solid var(--border-focus)"
          : "1px solid var(--border-subtle)",
      }}
      onClick={handleClick}
    >
      {/* Collapsed view */}
      <div className="flex items-center gap-3 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4
              className="text-sm font-semibold truncate"
              style={{ color: "var(--text-primary)" }}
            >
              {issue.diagnosis_description}
            </h4>
            <span
              className="text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
              style={{
                background: "var(--bg-surface)",
                color: "var(--text-muted)",
              }}
            >
              {issue.encounter_count}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="font-mono text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              {issue.diagnosis_code}
            </span>
            <span
              className="text-xs"
              style={{ color: "var(--text-secondary)" }}
            >
              Last: {formatDate(issue.last_seen)}
            </span>
          </div>
        </div>

        {/* Facility dots */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {issue.facilities.map((facility) => (
            <span
              key={facility}
              className="facility-dot"
              style={{
                background: FACILITY_COLORS[facility] || "var(--text-muted)",
              }}
              title={facility}
            />
          ))}
        </div>

        {/* Chevron */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          className="flex-shrink-0"
          style={{
            color: "var(--text-muted)",
            transform: expanded && isSelected ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
          }}
        >
          <path
            d="M3 5.5L7 9.5L11 5.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Expanded view */}
      {expanded && isSelected && (
        <div
          className="px-4 pb-4 animate-fade-in"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        >
          <div className="pt-3 space-y-3">
            {/* First seen */}
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] uppercase tracking-wide font-semibold"
                style={{ color: "var(--text-muted)" }}
              >
                First seen
              </span>
              <span
                className="text-xs"
                style={{ color: "var(--text-secondary)" }}
              >
                {formatDate(issue.first_seen)}
              </span>
            </div>

            {/* Facilities */}
            <div>
              <span
                className="text-[10px] uppercase tracking-wide font-semibold block mb-1.5"
                style={{ color: "var(--text-muted)" }}
              >
                Facilities
              </span>
              <div className="flex flex-wrap gap-2">
                {issue.facilities.map((facility) => (
                  <span
                    key={facility}
                    className="text-xs px-2 py-0.5 rounded-md flex items-center gap-1.5"
                    style={{
                      background: "var(--bg-surface)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        background: FACILITY_COLORS[facility] || "var(--text-muted)",
                      }}
                    />
                    {FACILITY_SHORT_NAMES[facility] || facility}
                  </span>
                ))}
              </div>
            </div>

            {/* Linked medications */}
            {issue.linked_medications.length > 0 && (
              <div>
                <span
                  className="text-[10px] uppercase tracking-wide font-semibold block mb-1.5"
                  style={{ color: "var(--text-muted)" }}
                >
                  Linked Medications
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {issue.linked_medications.map((med) => (
                    <span
                      key={med}
                      className="badge-info text-xs px-2 py-0.5 rounded-md"
                    >
                      {med}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function IssuePanel({
  issues,
  selectedIssue,
  onIssueSelect,
}: IssuePanelProps) {
  const [showPrior, setShowPrior] = useState(false);

  const activeIssues = issues
    .filter((i) => i.status === "active")
    .sort((a, b) => new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime());

  const priorIssues = issues
    .filter((i) => i.status === "prior")
    .sort((a, b) => new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime());

  return (
    <section>
      <SectionHeader title="Active Issues" count={activeIssues.length} />

      <div className="space-y-2 stagger">
        {activeIssues.map((issue) => (
          <IssueRow
            key={issue.diagnosis_code}
            issue={issue}
            isSelected={selectedIssue === issue.diagnosis_code}
            onSelect={() =>
              onIssueSelect(
                selectedIssue === issue.diagnosis_code ? null : issue.diagnosis_code
              )
            }
          />
        ))}
      </div>

      {/* Prior issues */}
      {priorIssues.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowPrior(!showPrior)}
            className="flex items-center gap-2 text-xs font-medium cursor-pointer mb-3"
            style={{ color: "var(--text-muted)" }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              style={{
                transform: showPrior ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s ease",
              }}
            >
              <path
                d="M2.5 4.5L6 8L9.5 4.5"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Prior Issues
            <span
              className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{
                background: "var(--bg-surface)",
                color: "var(--text-muted)",
              }}
            >
              {priorIssues.length}
            </span>
          </button>

          {showPrior && (
            <div className="space-y-2 animate-fade-in">
              {priorIssues.map((issue) => (
                <IssueRow
                  key={issue.diagnosis_code}
                  issue={issue}
                  isSelected={selectedIssue === issue.diagnosis_code}
                  onSelect={() =>
                    onIssueSelect(
                      selectedIssue === issue.diagnosis_code
                        ? null
                        : issue.diagnosis_code
                    )
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
