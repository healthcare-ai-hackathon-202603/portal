"use client";

import type { PatientMedication } from "@/lib/types";

interface MedListProps {
  medications: PatientMedication[];
}

export default function MedList({ medications }: MedListProps) {
  if (!medications || medications.length === 0) {
    return (
      <div className="card p-6 text-center">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          No active medications on file.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {medications.map((med, i) => (
        <div key={i} className="group relative card p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4
                  className="text-sm font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {med.name}
                </h4>
                {med.active ? (
                  <span className="badge-healthy text-[10px] px-2 py-0.5 rounded-full font-medium">
                    Active
                  </span>
                ) : (
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{
                      background: "var(--bg-surface)",
                      color: "var(--text-muted)",
                    }}
                  >
                    Inactive
                  </span>
                )}
              </div>
              {med.purpose && (
                <p className="text-xs mb-1" style={{ color: "var(--text-accent)" }}>
                  {med.purpose}
                </p>
              )}
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {med.dosage} &middot; {med.frequency}
              </p>
            </div>

            {/* Info icon that triggers tooltip */}
            <div className="relative flex-shrink-0">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center cursor-help transition-colors"
                style={{
                  background: "var(--bg-surface)",
                  color: "var(--text-muted)",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M7 6V10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  <circle cx="7" cy="4.25" r="0.6" fill="currentColor" />
                </svg>
              </div>

              {/* Tooltip */}
              <div
                className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 absolute right-0 top-full mt-2 z-50 w-64 p-3 rounded-xl text-xs"
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-default)",
                  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
                }}
              >
                <div className="space-y-2">
                  {med.clinical_details?.prescriber && (
                    <div className="flex justify-between">
                      <span style={{ color: "var(--text-muted)" }}>Prescriber</span>
                      <span style={{ color: "var(--text-primary)" }}>
                        {med.clinical_details.prescriber}
                      </span>
                    </div>
                  )}
                  {med.clinical_details?.start_date && (
                    <div className="flex justify-between">
                      <span style={{ color: "var(--text-muted)" }}>Started</span>
                      <span style={{ color: "var(--text-primary)" }}>
                        {new Date(med.clinical_details.start_date).toLocaleDateString("en-CA", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  )}
                  {med.clinical_details?.end_date && (
                    <div className="flex justify-between">
                      <span style={{ color: "var(--text-muted)" }}>Ends</span>
                      <span style={{ color: "var(--text-primary)" }}>
                        {new Date(med.clinical_details.end_date).toLocaleDateString("en-CA", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  )}
                  {med.clinical_details?.route && (
                    <div className="flex justify-between">
                      <span style={{ color: "var(--text-muted)" }}>Route</span>
                      <span style={{ color: "var(--text-primary)" }}>
                        {med.clinical_details.route}
                      </span>
                    </div>
                  )}
                  {med.clinical_details?.drug_code && (
                    <div className="flex justify-between">
                      <span style={{ color: "var(--text-muted)" }}>DIN</span>
                      <span
                        className="font-mono"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {med.clinical_details.drug_code}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
