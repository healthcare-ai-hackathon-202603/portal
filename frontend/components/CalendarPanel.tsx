"use client";

import { useState, useMemo } from "react";
import type { AlertItem, PatientMedication, Encounter } from "@/lib/types";
import { FACILITY_SHORT_NAMES } from "@/lib/types";

// ─── Types ───────────────────────────────────────────────────────────────────

interface UpcomingItem {
  id: string;
  type: "test" | "medication" | "follow-up";
  title: string;
  suggestedLabel: string;
  suggestedDate: Date;
  priority: "urgent" | "warning" | "info";
}

interface CalendarPanelProps {
  alerts: AlertItem[];
  medications: PatientMedication[];
  recentEncounters: Encounter[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TODAY = new Date("2026-03-28");
const TODAY_YEAR = TODAY.getFullYear();
const TODAY_MONTH = TODAY.getMonth();
const TODAY_DATE = TODAY.getDate();
const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const typeBadgeConfig: Record<UpcomingItem["type"], { label: string; color: string; bg: string; border: string }> = {
  test: {
    label: "Test",
    color: "var(--color-info)",
    bg: "rgba(96, 165, 250, 0.10)",
    border: "rgba(96, 165, 250, 0.20)",
  },
  medication: {
    label: "Medication",
    color: "var(--color-warning)",
    bg: "rgba(251, 191, 36, 0.10)",
    border: "rgba(251, 191, 36, 0.20)",
  },
  "follow-up": {
    label: "Follow-up",
    color: "var(--text-accent)",
    bg: "rgba(110, 207, 255, 0.10)",
    border: "rgba(110, 207, 255, 0.20)",
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function startDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatShortDate(d: Date): string {
  return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// ─── Derive upcoming items ──────────────────────────────────────────────────

function deriveUpcomingItems(
  alerts: AlertItem[],
  medications: PatientMedication[],
  recentEncounters: Encounter[],
): UpcomingItem[] {
  const items: UpcomingItem[] = [];

  // 1. Care gaps from alerts
  for (const alert of alerts) {
    if (alert.category !== "care_gap") continue;
    // Suggest "this week" — pick a date 3 days from today
    const suggestedDate = addDays(TODAY, 3);
    items.push({
      id: `cal_care_gap_${alert.title}`,
      type: "test",
      title: `Schedule ${alert.title} — overdue`,
      suggestedLabel: "This week",
      suggestedDate,
      priority: alert.severity === "urgent" ? "urgent" : "warning",
    });
  }

  // 2. Expiring medications
  for (const med of medications) {
    if (!med.active || !med.clinical_details?.end_date) continue;
    const endDate = new Date(med.clinical_details.end_date);
    const daysLeft = Math.ceil((endDate.getTime() - TODAY.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft > 0 && daysLeft <= 30) {
      // Suggest renewal a few days before expiry
      const suggestedDate = addDays(endDate, -3);
      const endLabel = formatShortDate(endDate);
      items.push({
        id: `cal_med_${med.name}`,
        type: "medication",
        title: `Renew ${med.name} before ${endLabel}`,
        suggestedLabel: daysLeft <= 7 ? `${daysLeft}d left` : `By ${formatShortDate(suggestedDate)}`,
        suggestedDate: suggestedDate < TODAY ? TODAY : suggestedDate,
        priority: daysLeft <= 7 ? "urgent" : "warning",
      });
    }
  }

  // 3. Recent encounters → follow-up suggestions (last 30 days)
  const thirtyDaysAgo = addDays(TODAY, -30);
  for (const enc of recentEncounters) {
    const encDate = new Date(enc.encounter_date);
    if (encDate < thirtyDaysAgo || encDate > TODAY) continue;
    // Suggest follow-up 2 weeks after encounter
    const suggestedDate = addDays(encDate, 14);
    // Only include if the follow-up date hasn't passed yet
    if (suggestedDate < TODAY) continue;
    const facility = FACILITY_SHORT_NAMES[enc.facility] || enc.facility;
    items.push({
      id: `cal_followup_${enc.encounter_id}`,
      type: "follow-up",
      title: `Follow-up from ${enc.chief_complaint} at ${facility}`,
      suggestedLabel: formatShortDate(suggestedDate),
      suggestedDate,
      priority: "info",
    });
  }

  // Sort by date, then priority
  const priorityOrder = { urgent: 0, warning: 1, info: 2 };
  items.sort((a, b) => {
    const dateDiff = a.suggestedDate.getTime() - b.suggestedDate.getTime();
    if (dateDiff !== 0) return dateDiff;
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  // Deduplicate by id
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function CalendarPanel({ alerts, medications, recentEncounters }: CalendarPanelProps) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const items = useMemo(
    () => deriveUpcomingItems(alerts, medications, recentEncounters),
    [alerts, medications, recentEncounters],
  );

  // Build a set of days-of-month that have items (within current month)
  const itemDaySet = useMemo(() => {
    const s = new Set<number>();
    for (const item of items) {
      if (item.suggestedDate.getFullYear() === TODAY_YEAR && item.suggestedDate.getMonth() === TODAY_MONTH) {
        s.add(item.suggestedDate.getDate());
      }
    }
    return s;
  }, [items]);

  // Filter items when a day is selected
  const visibleItems = useMemo(() => {
    if (selectedDay === null) return items;
    return items.filter((item) => {
      return (
        item.suggestedDate.getFullYear() === TODAY_YEAR &&
        item.suggestedDate.getMonth() === TODAY_MONTH &&
        item.suggestedDate.getDate() === selectedDay
      );
    });
  }, [items, selectedDay]);

  // Calendar grid computation
  const totalDays = daysInMonth(TODAY_YEAR, TODAY_MONTH);
  const firstDay = startDayOfMonth(TODAY_YEAR, TODAY_MONTH);
  const prevMonthDays = daysInMonth(TODAY_YEAR, TODAY_MONTH - 1);

  // Build grid cells
  const cells: { day: number; currentMonth: boolean }[] = [];
  // Previous month trailing days
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: prevMonthDays - i, currentMonth: false });
  }
  // Current month
  for (let d = 1; d <= totalDays; d++) {
    cells.push({ day: d, currentMonth: true });
  }
  // Next month leading days to fill grid (fill to 35 or 42)
  const targetCells = cells.length > 35 ? 42 : 35;
  let nextDay = 1;
  while (cells.length < targetCells) {
    cells.push({ day: nextDay++, currentMonth: false });
  }

  function handleDayClick(day: number, currentMonth: boolean) {
    if (!currentMonth) return;
    setSelectedDay((prev) => (prev === day ? null : day));
  }

  return (
    <section>
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <h2
          className="text-sm font-semibold tracking-wide"
          style={{ color: "var(--text-secondary)", fontFamily: "'DM Sans', sans-serif" }}
        >
          Upcoming
        </h2>
        <span
          className="text-xs font-medium"
          style={{ color: "var(--text-muted)" }}
        >
          {MONTH_NAMES[TODAY_MONTH]} {TODAY_YEAR}
        </span>
      </div>

      {/* Mini Calendar */}
      <div
        className="card p-4 mb-4"
        style={{ background: "var(--bg-secondary)" }}
      >
        {/* Day-of-week headers */}
        <div className="calendar-grid mb-1">
          {DAY_LABELS.map((label, i) => (
            <div
              key={`dh-${i}`}
              className="text-[10px] font-semibold uppercase tracking-wider py-1"
              style={{ color: "var(--text-muted)" }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Date cells */}
        <div className="calendar-grid">
          {cells.map((cell, i) => {
            const isToday = cell.currentMonth && cell.day === TODAY_DATE;
            const hasItem = cell.currentMonth && itemDaySet.has(cell.day);
            const isSelected = cell.currentMonth && selectedDay === cell.day;

            const classes = [
              "calendar-day",
              !cell.currentMonth && "other-month",
              isToday && "today",
              hasItem && "has-item",
              isSelected && "selected",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <div
                key={`d-${i}`}
                className={classes}
                onClick={() => handleDayClick(cell.day, cell.currentMonth)}
              >
                {cell.day}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming items list */}
      {visibleItems.length === 0 ? (
        <div
          className="card p-5 flex items-center gap-3"
          style={{ borderColor: "rgba(110, 207, 255, 0.12)" }}
        >
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(110, 207, 255, 0.08)", color: "var(--text-accent)" }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.3" />
              <path d="M5 1.5V4.5M11 1.5V4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </div>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {selectedDay !== null
              ? "No items scheduled for this day."
              : "No upcoming items right now."}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 stagger">
          {visibleItems.slice(0, 6).map((item) => {
            const badge = typeBadgeConfig[item.type];
            return (
              <div
                key={item.id}
                className="card p-4 flex items-start gap-3"
                style={{ background: "var(--bg-secondary)" }}
              >
                {/* Left: date label */}
                <div
                  className="flex-shrink-0 w-14 pt-0.5 text-center"
                >
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wider block leading-tight"
                    style={{ color: item.priority === "urgent" ? "var(--color-urgent)" : "var(--text-accent)" }}
                  >
                    {item.suggestedLabel}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium leading-snug mb-1.5"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {item.title}
                  </p>
                  <span
                    className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      color: badge.color,
                      background: badge.bg,
                      border: `1px solid ${badge.border}`,
                    }}
                  >
                    {badge.label}
                  </span>
                </div>

                {/* CTA */}
                <button
                  className="flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-200 cursor-pointer"
                  style={{
                    color: "var(--text-accent)",
                    background: "rgba(110, 207, 255, 0.06)",
                    border: "1px solid rgba(110, 207, 255, 0.15)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(110, 207, 255, 0.12)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(110, 207, 255, 0.06)";
                  }}
                >
                  Schedule
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
