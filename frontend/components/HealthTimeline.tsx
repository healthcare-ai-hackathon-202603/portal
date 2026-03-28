"use client";

import { useState } from "react";
import type { Encounter } from "@/lib/types";
import { FACILITY_COLORS, FACILITY_SHORT_NAMES } from "@/lib/types";

interface HealthTimelineProps {
  encounters: Encounter[];
}

const encounterTypeBadge: Record<string, string> = {
  emergency: "badge-urgent",
  inpatient: "badge-warning",
  outpatient: "badge-info",
};

export default function HealthTimeline({ encounters }: HealthTimelineProps) {
  const [showAll, setShowAll] = useState(false);
  const sorted = [...encounters].sort(
    (a, b) => new Date(b.encounter_date).getTime() - new Date(a.encounter_date).getTime()
  );
  const displayed = showAll ? sorted : sorted.slice(0, 20);
  const hasMore = sorted.length > 20;

  return (
    <section>
      <h2
        className="text-sm font-semibold uppercase tracking-widest mb-4"
        style={{ color: "var(--text-muted)" }}
      >
        Health Timeline
      </h2>
      <div className="relative" style={{ maxHeight: showAll ? "none" : "680px", overflow: "auto" }}>
        <div className="relative pl-8">
          {/* Vertical line */}
          <div
            className="absolute left-[11px] top-0 bottom-0 w-px"
            style={{ background: "var(--border-default)" }}
          />

          {displayed.map((enc, i) => {
            const facilityColor = FACILITY_COLORS[enc.facility] || "var(--text-muted)";
            const shortName = FACILITY_SHORT_NAMES[enc.facility] || enc.facility;
            const isEmergency = enc.encounter_type === "emergency";
            const date = new Date(enc.encounter_date);
            const formatted = date.toLocaleDateString("en-CA", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });

            return (
              <div
                key={enc.encounter_id || i}
                className="relative pb-6 last:pb-0 animate-fade-in-up"
                style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}
              >
                {/* Facility dot */}
                <div
                  className="facility-dot absolute left-[-21px] top-[6px]"
                  style={{
                    background: facilityColor,
                    boxShadow: isEmergency ? `0 0 8px ${facilityColor}` : "none",
                  }}
                />

                <div
                  className={`card p-4 ${isEmergency ? "glow-urgent" : ""}`}
                  style={{ borderLeft: `3px solid ${facilityColor}` }}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-xs font-mono"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {formatted}
                      </span>
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded"
                        style={{ color: facilityColor, background: `${facilityColor}15` }}
                      >
                        {shortName}
                      </span>
                      <span
                        className={`${encounterTypeBadge[enc.encounter_type] || "badge-info"} text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider`}
                      >
                        {enc.encounter_type}
                      </span>
                    </div>
                  </div>

                  {enc.chief_complaint && (
                    <p
                      className="text-sm font-medium mb-1"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {enc.chief_complaint}
                    </p>
                  )}

                  {enc.diagnosis_description && (
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      {enc.diagnosis_description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Fade overlay when not showing all */}
        {!showAll && hasMore && (
          <div
            className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
            style={{
              background: "linear-gradient(transparent, var(--bg-primary))",
            }}
          />
        )}
      </div>

      {hasMore && (
        <button
          onClick={() => setShowAll((prev) => !prev)}
          className="mt-4 w-full py-3 text-sm font-medium rounded-xl transition-colors cursor-pointer"
          style={{
            color: "var(--text-accent)",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          {showAll ? "Show fewer" : `Show all ${sorted.length} encounters`}
        </button>
      )}
    </section>
  );
}
