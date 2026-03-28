"use client";

import { useState, useMemo } from "react";
import type { PatientListItem } from "@/lib/types";

interface PatientListProps {
  patients: PatientListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function AlertBadge({ score }: { score: number }) {
  let badgeClass = "badge-info";
  if (score >= 7) badgeClass = "badge-urgent";
  else if (score >= 4) badgeClass = "badge-warning";
  else if (score <= 1) badgeClass = "badge-healthy";

  return (
    <span
      className={`${badgeClass} text-[11px] font-semibold px-1.5 py-0.5 rounded font-mono`}
    >
      {score}
    </span>
  );
}

export default function PatientList({
  patients,
  selectedId,
  onSelect,
}: PatientListProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const list = q
      ? patients.filter(
          (p) =>
            p.patient_id.toLowerCase().includes(q) ||
            `${p.first_name} ${p.last_name}`.toLowerCase().includes(q)
        )
      : patients;

    // Sort: high alert_score first
    return [...list].sort((a, b) => b.alert_score - a.alert_score);
  }, [patients, search]);

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-4 pb-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search patients..."
          className="w-full px-3 py-2 text-sm rounded-lg border-0 outline-none"
          style={{
            background: "var(--bg-surface)",
            color: "var(--text-primary)",
          }}
        />
      </div>

      {/* Count */}
      <div className="px-4 pb-2">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {filtered.length} patients
        </span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
        {filtered.map((p) => {
          const isSelected = p.patient_id === selectedId;
          const isHighAlert = p.alert_score >= 7;

          return (
            <button
              key={p.patient_id}
              onClick={() => onSelect(p.patient_id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-all duration-150 border-0 cursor-pointer ${
                isHighAlert && !isSelected ? "glow-urgent" : ""
              }`}
              style={{
                background: isSelected
                  ? "var(--bg-surface)"
                  : "transparent",
                borderLeft: isSelected
                  ? "2px solid var(--text-accent)"
                  : "2px solid transparent",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div
                    className="text-sm font-medium truncate"
                    style={{
                      color: isSelected
                        ? "var(--text-primary)"
                        : "var(--text-secondary)",
                    }}
                  >
                    {p.last_name}, {p.first_name}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className="text-xs font-mono"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {p.patient_id}
                    </span>
                    <span
                      className="text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {p.age}{p.sex.charAt(0).toUpperCase()}
                    </span>
                    {p.facility_count > 1 && (
                      <span
                        className="text-[10px] px-1 py-0 rounded"
                        style={{
                          background: "rgba(110, 207, 255, 0.1)",
                          color: "var(--text-accent)",
                        }}
                      >
                        {p.facility_count} sites
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className="text-[11px] font-mono"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {p.encounter_count}
                  </span>
                  <AlertBadge score={p.alert_score} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
