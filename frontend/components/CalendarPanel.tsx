"use client";

import { useState, useMemo, useEffect } from "react";
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

const TODAY = new Date("2026-03-28T12:00:00Z"); // fixed mid-day to avoid timezone offset issues
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

function formatShortDate(d: Date): string {
  return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function startDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function CalendarPanel({ alerts, medications, recentEncounters }: CalendarPanelProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(TODAY));
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("month");
  const [isLoading, setIsLoading] = useState(false);
  const [scheduledIds, setScheduledIds] = useState<Set<string>>(new Set());

  // Simulate progressive loading when switching views
  useEffect(() => {
    setIsLoading(true);
    const t = setTimeout(() => {
      setIsLoading(false);
    }, 400); // 400ms loading skeleton simulation
    return () => clearTimeout(t);
  }, [viewMode, selectedDate]);

  const items = useMemo(() => {
    const rawItems: UpcomingItem[] = [];

    // Derive care gaps
    for (const alert of alerts) {
      if (alert.category !== "care_gap") continue;
      const suggestedDate = addDays(TODAY, 3);
      rawItems.push({
        id: `cal_care_gap_${alert.title}`,
        type: "test",
        title: `Schedule ${alert.title} — overdue`,
        suggestedLabel: "This week",
        suggestedDate,
        priority: alert.severity === "urgent" ? "urgent" : "warning",
      });
    }

    // Derive expiring meds
    for (const med of medications) {
      if (!med.active || !med.clinical_details?.end_date) continue;
      const endDate = new Date(med.clinical_details.end_date);
      const daysLeft = Math.ceil((endDate.getTime() - TODAY.getTime()) / (1000 * 60 * 60 * 24));
      if (daysLeft > 0 && daysLeft <= 30) {
        const suggestedDate = addDays(endDate, -3);
        const endLabel = formatShortDate(endDate);
        rawItems.push({
          id: `cal_med_${med.name}`,
          type: "medication",
          title: `Renew ${med.name} before ${endLabel}`,
          suggestedLabel: daysLeft <= 7 ? `${daysLeft}d left` : `By ${formatShortDate(suggestedDate)}`,
          suggestedDate: suggestedDate < TODAY ? TODAY : suggestedDate,
          priority: daysLeft <= 7 ? "urgent" : "warning",
        });
      }
    }

    // Mock injected items to pad the calendar visually
    rawItems.push({
      id: "mock_cal_1",
      type: "follow-up",
      title: "Neurology Specialist Assessment",
      suggestedLabel: "Tomorrow",
      suggestedDate: addDays(TODAY, 1),
      priority: "info",
    });

    rawItems.push({
      id: "mock_cal_2",
      type: "test",
      title: "Complete Blood Count (CBC) Panel",
      suggestedLabel: "Apr 5",
      suggestedDate: addDays(TODAY, 8), // April 5th approx
      priority: "warning",
    });
    
    rawItems.push({
      id: "mock_cal_3",
      type: "test",
      title: "Annual Preventative Screening",
      suggestedLabel: "Apr 12",
      suggestedDate: addDays(TODAY, 15), 
      priority: "info",
    });

    // Sort by date, then priority
    const priorityOrder = { urgent: 0, warning: 1, info: 2 };
    rawItems.sort((a, b) => {
      const dateDiff = a.suggestedDate.getTime() - b.suggestedDate.getTime();
      if (dateDiff !== 0) return dateDiff;
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    // Deduplicate by id
    const seen = new Set<string>();
    return rawItems.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [alerts, medications]);

  // Build a set of date strings (YYYY-MM-DD) that have items
  const itemDatesSet = useMemo(() => {
    const s = new Set<string>();
    for (const item of items) {
      const d = item.suggestedDate;
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      s.add(key);
    }
    return s;
  }, [items]);

  // Determine which items to display based on ViewMode
  const visibleItems = useMemo(() => {
    return items.filter((item) => {
      const idate = startOfDay(item.suggestedDate);
      if (viewMode === "day") {
        return idate.getTime() === selectedDate.getTime();
      } else if (viewMode === "week") {
        const dayOfWeek = selectedDate.getDay();
        const startOfWeek = addDays(selectedDate, -dayOfWeek);
        const endOfWeek = addDays(startOfWeek, 6);
        return idate >= startOfWeek && idate <= endOfWeek;
      } else {
        // month view
        return idate.getFullYear() === selectedDate.getFullYear() && idate.getMonth() === selectedDate.getMonth();
      }
    });
  }, [items, selectedDate, viewMode]);

  // Build grid cells for the calendar
  const activeCells = useMemo(() => {
    const cells: { dateObj: Date; isSelected: boolean; isToday: boolean; hasItem: boolean; isCurrentMonthBase: boolean }[] = [];
    
    if (viewMode === "month") {
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const totalDays = daysInMonth(year, month);
      const firstDay = startDayOfMonth(year, month);
      const prevMonthDays = daysInMonth(year, month - 1);

      // Previous month trailing
      for (let i = firstDay - 1; i >= 0; i--) {
        const d = new Date(year, month - 1, prevMonthDays - i);
        cells.push({ dateObj: d, isSelected: false, isToday: false, hasItem: itemDatesSet.has(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`), isCurrentMonthBase: false });
      }
      // Current month
      for (let d = 1; d <= totalDays; d++) {
        const dateObj = new Date(year, month, d);
        cells.push({ dateObj, isSelected: startOfDay(dateObj).getTime() === startOfDay(selectedDate).getTime(), isToday: startOfDay(dateObj).getTime() === startOfDay(TODAY).getTime(), hasItem: itemDatesSet.has(`${dateObj.getFullYear()}-${dateObj.getMonth()}-${dateObj.getDate()}`), isCurrentMonthBase: true });
      }
      // Next month leading
      const targetCells = cells.length > 35 ? 42 : 35;
      let nextDay = 1;
      while (cells.length < targetCells) {
        const d = new Date(year, month + 1, nextDay++);
        cells.push({ dateObj: d, isSelected: false, isToday: false, hasItem: itemDatesSet.has(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`), isCurrentMonthBase: false });
      }

    } else if (viewMode === "week") {
      const dayOfWeek = selectedDate.getDay();
      const startOfWeekDate = addDays(selectedDate, -dayOfWeek);
      for (let i = 0; i < 7; i++) {
        const dateObj = addDays(startOfWeekDate, i);
        cells.push({
          dateObj,
          isSelected: startOfDay(dateObj).getTime() === startOfDay(selectedDate).getTime(),
          isToday: startOfDay(dateObj).getTime() === startOfDay(TODAY).getTime(),
          hasItem: itemDatesSet.has(`${dateObj.getFullYear()}-${dateObj.getMonth()}-${dateObj.getDate()}`),
          isCurrentMonthBase: dateObj.getMonth() === selectedDate.getMonth()
        });
      }
    } else if (viewMode === "day") {
      cells.push({
        dateObj: selectedDate,
        isSelected: true,
        isToday: startOfDay(selectedDate).getTime() === startOfDay(TODAY).getTime(),
        hasItem: itemDatesSet.has(`${selectedDate.getFullYear()}-${selectedDate.getMonth()}-${selectedDate.getDate()}`),
        isCurrentMonthBase: true
      });
    }
    
    return cells;
  }, [viewMode, selectedDate, itemDatesSet]);

  return (
    <section>
      {/* Header with Toggles */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <h2
            className="text-sm font-semibold tracking-wide"
            style={{ color: "var(--text-secondary)", fontFamily: "'DM Sans', sans-serif" }}
          >
            Calendar
          </h2>
          <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
            {MONTH_NAMES[selectedDate.getMonth()]} {selectedDate.getFullYear()}
          </span>
        </div>
        
        {/* Progressive View Toggles */}
        <div className="flex p-0.5 rounded-lg" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)" }}>
          {(["day", "week", "month"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className="text-[10px] capitalize font-semibold px-2.5 py-1 rounded-md transition-all duration-200 cursor-pointer"
              style={{
                background: viewMode === mode ? "var(--bg-surface)" : "transparent",
                color: viewMode === mode ? "var(--text-primary)" : "var(--text-muted)",
                boxShadow: viewMode === mode ? "0 1px 2px rgba(0,0,0,0.2)" : "none",
              }}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Dynamic Mini Calendar */}
      <div
        className="card p-4 mx-auto mb-4 transition-all duration-300 overflow-hidden"
        style={{ background: "var(--bg-secondary)" }}
      >
        {viewMode !== "day" && (
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
        )}

        <div className={viewMode === "day" ? "flex justify-center" : "calendar-grid"}>
          {activeCells.map((cell, i) => {
            const classes = [
              "calendar-day",
              !cell.isCurrentMonthBase && "other-month",
              cell.isToday && "today",
              cell.hasItem && "has-item",
              cell.isSelected && "selected",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <div
                key={`d-${i}`}
                className={classes}
                onClick={() => setSelectedDate(cell.dateObj)}
                title={cell.dateObj.toDateString()}
              >
                {viewMode === "day" ? formatShortDate(cell.dateObj) : cell.dateObj.getDate()}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming items list (with progressive loading overlay) */}
      <div className={`transition-opacity duration-300 ${isLoading ? "opacity-40 pointer-events-none" : "opacity-100"}`}>
        {visibleItems.length === 0 ? (
          <div
            className="card p-5 flex items-center gap-3 animate-fade-in"
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
              {viewMode === "day" 
                ? "No items scheduled for this day." 
                : `No items scheduled for this ${viewMode}.`}
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
                  <div className="flex-shrink-0 pt-0.5 text-center w-14">
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wider block leading-tight"
                      style={{ color: item.priority === "urgent" ? "var(--color-urgent)" : "var(--text-accent)" }}
                    >
                      {item.suggestedLabel}
                    </span>
                  </div>

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

                  <button
                    className="flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-200 cursor-pointer hidden sm:block"
                    style={{
                      color: scheduledIds.has(item.id) ? "var(--color-healthy)" : "var(--text-accent)",
                      background: scheduledIds.has(item.id) ? "rgba(16, 185, 129, 0.1)" : "rgba(110, 207, 255, 0.06)",
                      border: scheduledIds.has(item.id) ? "1px solid rgba(16, 185, 129, 0.2)" : "1px solid rgba(110, 207, 255, 0.15)",
                    }}
                    onClick={() => {
                      setScheduledIds((prev) => {
                        const next = new Set(prev);
                        next.add(item.id);
                        return next;
                      });
                    }}
                    onMouseEnter={(e) => {
                      if (!scheduledIds.has(item.id)) {
                        (e.currentTarget as HTMLButtonElement).style.background = "rgba(110, 207, 255, 0.12)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!scheduledIds.has(item.id)) {
                        (e.currentTarget as HTMLButtonElement).style.background = "rgba(110, 207, 255, 0.06)";
                      }
                    }}
                  >
                    {scheduledIds.has(item.id) ? "Scheduled ✓" : "Schedule"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
