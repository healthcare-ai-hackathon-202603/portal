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

          <div className="flex items-center gap-1.5 shrink-0 w-14">
            <span
              className="facility-dot"
              style={{ backgroundColor: FACILITY_COLORS[enc.facility] ?? "var(--text-muted)" }}
            />
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {FACILITY_SHORT_NAMES[enc.facility] ?? enc.facility}
            </span>
          </div>

          <span
            className={`${ENCOUNTER_TYPE_BADGE[enc.encounter_type] ?? "badge-info"} text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0`}
          >
            {enc.encounter_type}
          </span>

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
