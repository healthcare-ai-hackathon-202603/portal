"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import type { PatientListItem, UrgencyClassification } from "@/lib/types";
import { getUrgency } from "@/lib/api";

interface PatientListProps {
  patients: PatientListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const URGENCY_SORT_ORDER: Record<string, number> = {
  red: 0,
  yellow: 1,
  green: 2,
};

const URGENCY_DOT_COLOR: Record<string, string> = {
  red: "var(--color-urgent)",
  yellow: "var(--color-warning)",
  green: "var(--color-healthy)",
};

function UrgencyDot({ urgency }: { urgency: UrgencyClassification | undefined }) {
  const color = urgency ? URGENCY_DOT_COLOR[urgency.level] : "var(--text-muted)";
  const label = urgency?.label ?? "Loading...";

  return (
    <span
      title={label}
      className="shrink-0 rounded-full inline-block"
      style={{
        width: 8,
        height: 8,
        backgroundColor: color,
        opacity: urgency ? 1 : 0.4,
        transition: "background-color 0.3s ease, opacity 0.3s ease",
      }}
    />
  );
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
  const [urgencyMap, setUrgencyMap] = useState<Record<string, UrgencyClassification>>({});
  const fetchedRef = useRef<Set<string>>(new Set());

  // Filter patients by search query
  const searchFiltered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return q
      ? patients.filter(
          (p) =>
            p.patient_id.toLowerCase().includes(q) ||
            `${p.first_name} ${p.last_name}`.toLowerCase().includes(q)
        )
      : patients;
  }, [patients, search]);

  // Fetch urgency for the first 20 visible patients that we haven't fetched yet
  const fetchUrgencies = useCallback((visiblePatients: PatientListItem[]) => {
    const toFetch = visiblePatients
      .slice(0, 20)
      .filter((p) => !fetchedRef.current.has(p.patient_id));

    if (toFetch.length === 0) return;

    // Mark as fetching immediately to prevent duplicate requests
    toFetch.forEach((p) => fetchedRef.current.add(p.patient_id));

    Promise.allSettled(
      toFetch.map((p) =>
        getUrgency(p.patient_id).then((u) => ({ id: p.patient_id, urgency: u }))
      )
    ).then((results) => {
      const newEntries: Record<string, UrgencyClassification> = {};
      for (const result of results) {
        if (result.status === "fulfilled") {
          newEntries[result.value.id] = result.value.urgency;
        }
      }
      if (Object.keys(newEntries).length > 0) {
        setUrgencyMap((prev) => ({ ...prev, ...newEntries }));
      }
    });
  }, []);

  useEffect(() => {
    fetchUrgencies(searchFiltered);
  }, [searchFiltered, fetchUrgencies]);

  // Sort: urgency level first (red > yellow > green > unknown), then alert_score descending
  const filtered = useMemo(() => {
    return [...searchFiltered].sort((a, b) => {
      const aLevel = urgencyMap[a.patient_id]?.level;
      const bLevel = urgencyMap[b.patient_id]?.level;
      const aOrder = aLevel ? URGENCY_SORT_ORDER[aLevel] : 3;
      const bOrder = bLevel ? URGENCY_SORT_ORDER[bLevel] : 3;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return b.alert_score - a.alert_score;
    });
  }, [searchFiltered, urgencyMap]);

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
          const urgency = urgencyMap[p.patient_id];

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
                <div className="min-w-0 flex items-center gap-2">
                  <UrgencyDot urgency={urgency} />
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
                    {urgency && (
                      <div
                        className="text-[10px] mt-0.5 truncate"
                        style={{ color: URGENCY_DOT_COLOR[urgency.level] }}
                      >
                        {urgency.reasons?.[0] ?? urgency.label}
                      </div>
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
