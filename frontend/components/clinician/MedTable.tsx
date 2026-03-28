"use client";

import { useState } from "react";
import type { MedicationAlerts } from "@/lib/types";
import { getDrugClass } from "@/lib/clinician-filters";

export interface MedRow {
  name: string;
  dosage: string;
  frequency: string;
  active: boolean;
  end_date?: string;
  prescriber: string;
  start_date: string;
  route: string;
  drug_code: string;
  facility?: string;
}

interface MedTableProps {
  medications: MedRow[];
  alerts: MedicationAlerts;
}

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const end = new Date(dateStr);
  const now = new Date("2026-03-28");
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function renewalColor(days: number | null): string {
  if (days === null) return "var(--text-muted)";
  if (days < 7) return "var(--color-urgent)";
  if (days <= 30) return "var(--color-warning)";
  return "var(--color-healthy)";
}

function renewalLabel(days: number | null): string {
  if (days === null) return "No end date";
  if (days < 0) return `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return "Expires today";
  return `${days}d remaining`;
}

function getAlertBadges(
  drugName: string,
  alerts: MedicationAlerts
): { label: string; className: string; detail: string }[] {
  const badges: { label: string; className: string; detail: string }[] = [];
  const lower = drugName.toLowerCase();

  for (const dup of alerts.duplications) {
    if (dup.drugs.some((d) => d.toLowerCase() === lower)) {
      const others = dup.drugs.filter((d) => d.toLowerCase() !== lower);
      badges.push({
        label: "DUP",
        className: "badge-urgent",
        detail: `Duplicate ${dup.drug_class}: also on ${others.join(", ")}`,
      });
    }
  }
  for (const tc of alerts.temporal_correlations) {
    if (tc.drug_name.toLowerCase() === lower) {
      badges.push({
        label: "TC",
        className: "badge-warning",
        detail: `${tc.mechanism}`,
      });
    }
  }
  for (const cf of alerts.cross_facility) {
    if (cf.drug_name.toLowerCase() === lower) {
      badges.push({
        label: "XF",
        className: "badge-info",
        detail: `Prescribed at ${cf.facility} by ${cf.prescriber}`,
      });
    }
  }
  return badges;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function MedTable({ medications, alerts }: MedTableProps) {
  const [expandedMed, setExpandedMed] = useState<string | null>(null);

  const active = medications.filter((m) => m.active);
  const inactive = medications.filter((m) => !m.active);

  function renderRow(med: MedRow) {
    const days = daysUntil(med.end_date);
    const isExpanded = expandedMed === med.name;
    const badges = getAlertBadges(med.name, alerts);

    return (
      <div key={med.name}>
        <button
          onClick={() => setExpandedMed(isExpanded ? null : med.name)}
          className="w-full text-left px-4 py-3 flex items-center gap-4 transition-colors duration-150 cursor-pointer border-0"
          style={{
            background: isExpanded ? "var(--bg-elevated)" : "transparent",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <span
            className="flex-1 min-w-0 text-sm font-medium truncate"
            style={{
              color: med.active ? "var(--text-primary)" : "var(--text-muted)",
            }}
          >
            {med.name}
            {badges.map((b) => (
              <span
                key={b.label}
                className={`${b.className} text-[10px] font-semibold px-1.5 py-0.5 rounded ml-2`}
              >
                {b.label}
              </span>
            ))}
          </span>

          <span
            className="text-xs shrink-0 w-40 truncate"
            style={{ color: "var(--text-secondary)" }}
          >
            {med.dosage} {med.frequency}
          </span>

          <span
            className="text-xs font-mono shrink-0 w-28 text-right"
            style={{ color: renewalColor(days) }}
          >
            {renewalLabel(days)}
          </span>

          <span
            className="text-xs shrink-0 transition-transform duration-150"
            style={{
              color: "var(--text-muted)",
              transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
            }}
          >
            &#9662;
          </span>
        </button>

        {isExpanded && (
          <div
            className="px-6 py-3 text-xs space-y-1.5 animate-fade-in"
            style={{ background: "var(--bg-elevated)" }}
          >
            <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
              <div>
                <span style={{ color: "var(--text-muted)" }}>Prescriber: </span>
                <span style={{ color: "var(--text-secondary)" }}>{med.prescriber}</span>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }}>Route: </span>
                <span style={{ color: "var(--text-secondary)" }}>{med.route}</span>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }}>Start: </span>
                <span style={{ color: "var(--text-secondary)" }}>{formatDate(med.start_date)}</span>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }}>End: </span>
                <span style={{ color: "var(--text-secondary)" }}>
                  {med.end_date ? formatDate(med.end_date) : "Ongoing"}
                </span>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }}>DIN: </span>
                <span className="font-mono" style={{ color: "var(--text-secondary)" }}>
                  {med.drug_code}
                </span>
              </div>
              {med.facility && (
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Facility: </span>
                  <span style={{ color: "var(--text-secondary)" }}>{med.facility}</span>
                </div>
              )}
            </div>
            {badges.length > 0 && (
              <div className="pt-1.5 space-y-1">
                {badges.map((b) => (
                  <div key={b.label} className="flex items-start gap-2">
                    <span className={`${b.className} text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0`}>
                      {b.label}
                    </span>
                    <span style={{ color: "var(--text-secondary)" }}>{b.detail}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {active.map(renderRow)}
      {inactive.length > 0 && (
        <>
          <div
            className="px-4 py-2 text-[10px] uppercase tracking-widest"
            style={{
              color: "var(--text-muted)",
              background: "var(--bg-surface)",
              borderTop: "1px solid var(--border-subtle)",
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            Inactive
          </div>
          {inactive.map(renderRow)}
        </>
      )}
    </div>
  );
}
