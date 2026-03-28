"use client";

import { useState } from "react";
import type { LabTrajectory, VitalTrajectory } from "@/lib/types";
import TrendChart from "@/components/TrendChart";

interface ContextMetricsProps {
  labTrajectories: LabTrajectory[];
  vitalTrajectories: VitalTrajectory[];
  relevantMetrics: string[];
  defaultCount?: number;
}

const trendConfig: Record<
  string,
  { label: string; badgeClass: string; color: string }
> = {
  improving: {
    label: "Improving",
    badgeClass: "badge-healthy",
    color: "var(--color-improving)",
  },
  stable: {
    label: "Stable",
    badgeClass: "badge-info",
    color: "var(--color-stable)",
  },
  worsening: {
    label: "Worsening",
    badgeClass: "badge-warning",
    color: "var(--color-worsening)",
  },
  spiking: {
    label: "Spiking",
    badgeClass: "badge-urgent",
    color: "var(--color-spiking)",
  },
};

const trendPriority: Record<string, number> = {
  spiking: 0,
  worsening: 1,
  improving: 2,
  stable: 3,
};

type MetricItem =
  | { kind: "lab"; data: LabTrajectory }
  | { kind: "vital"; data: VitalTrajectory };

function getMetricName(item: MetricItem): string {
  return item.kind === "lab" ? item.data.test_name : item.data.vital_name;
}

function getMetricTrend(item: MetricItem): string {
  return item.data.trend;
}

function getLatestValue(item: MetricItem): number {
  return item.data.latest_value;
}

function getUnit(item: MetricItem): string {
  return item.data.unit;
}

function getChangePercent(item: MetricItem): number | null {
  if (item.kind === "lab") return item.data.change_percent;
  // Compute change for vitals from values array
  const vals = item.data.values;
  if (vals.length < 2) return null;
  const sorted = [...vals].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const first = sorted[0].value;
  const last = sorted[sorted.length - 1].value;
  if (first === 0) return null;
  return ((last - first) / Math.abs(first)) * 100;
}

function MetricCard({
  item,
  isExpanded,
  onToggle,
}: {
  item: MetricItem;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const name = getMetricName(item);
  const trend = getMetricTrend(item);
  const config = trendConfig[trend] || trendConfig.stable;
  const value = getLatestValue(item);
  const unit = getUnit(item);
  const changePct = getChangePercent(item);

  return (
    <div
      className="rounded-xl transition-all duration-200 cursor-pointer"
      style={{
        background: isExpanded ? "var(--bg-elevated)" : "var(--bg-secondary)",
        border: isExpanded
          ? "1px solid var(--border-default)"
          : "1px solid var(--border-subtle)",
      }}
      onClick={onToggle}
    >
      {/* Compact view */}
      <div className="flex items-center gap-3 p-4">
        {/* Trend indicator bar */}
        <div
          className="w-1 h-8 rounded-full flex-shrink-0"
          style={{ background: config.color, opacity: 0.7 }}
        />

        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-semibold truncate"
            style={{ color: "var(--text-primary)" }}
          >
            {name}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className="text-xs font-medium tabular-nums"
              style={{ color: "var(--text-secondary)" }}
            >
              {value} {unit}
            </span>
            {changePct !== null && (
              <span
                className="text-[10px] font-medium tabular-nums"
                style={{ color: config.color }}
              >
                {changePct > 0 ? "+" : ""}
                {changePct.toFixed(1)}%
              </span>
            )}
          </div>
        </div>

        {/* Trend badge */}
        <span
          className={`${config.badgeClass} text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full flex-shrink-0`}
        >
          {config.label}
        </span>

        {/* Chevron */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          className="flex-shrink-0"
          style={{
            color: "var(--text-muted)",
            transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
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

      {/* Expanded: TrendChart */}
      {isExpanded && (
        <div
          className="px-4 pb-4 animate-fade-in"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="pt-3" style={{ height: 180 }}>
            <TrendChart
              data={item.data.values}
              title={name}
              unit={unit}
              trend={trend}
              referenceRangeLow={
                item.kind === "lab" ? item.data.reference_range_low : undefined
              }
              referenceRangeHigh={
                item.kind === "lab" ? item.data.reference_range_high : undefined
              }
              normalRange={
                item.kind === "vital" ? item.data.normal_range : undefined
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function ContextMetrics({
  labTrajectories,
  vitalTrajectories,
  relevantMetrics,
  defaultCount = 3,
}: ContextMetricsProps) {
  const [showAll, setShowAll] = useState(false);
  const [expandedMetric, setExpandedMetric] = useState<string | null>(null);

  // Build unified list
  const allMetrics: MetricItem[] = [
    ...labTrajectories.map(
      (lab) => ({ kind: "lab" as const, data: lab })
    ),
    ...vitalTrajectories.map(
      (vital) => ({ kind: "vital" as const, data: vital })
    ),
  ];

  // Filter or rank
  let filtered: MetricItem[];

  if (relevantMetrics.length > 0) {
    const relevantSet = new Set(
      relevantMetrics.map((m) => m.toLowerCase())
    );
    filtered = allMetrics.filter((item) =>
      relevantSet.has(getMetricName(item).toLowerCase())
    );
  } else {
    // Sort: non-stable first (spiking > worsening > improving > stable)
    filtered = [...allMetrics].sort(
      (a, b) =>
        (trendPriority[getMetricTrend(a)] ?? 3) -
        (trendPriority[getMetricTrend(b)] ?? 3)
    );
  }

  const displayMetrics = showAll ? filtered : filtered.slice(0, defaultCount);
  const hasMore = filtered.length > defaultCount;

  if (allMetrics.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="flex items-center gap-2.5 mb-4">
        <h2
          className="text-sm font-semibold tracking-wide"
          style={{
            color: "var(--text-secondary)",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {relevantMetrics.length > 0 ? "Related Metrics" : "Key Metrics"}
        </h2>
        <span
          className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
          style={{
            background: "var(--bg-surface)",
            color: "var(--text-muted)",
          }}
        >
          {filtered.length}
        </span>
      </div>

      <div className="space-y-2 stagger">
        {displayMetrics.map((item) => {
          const name = getMetricName(item);
          return (
            <MetricCard
              key={name}
              item={item}
              isExpanded={expandedMetric === name}
              onToggle={() =>
                setExpandedMetric(expandedMetric === name ? null : name)
              }
            />
          );
        })}
      </div>

      {/* Show all / collapse toggle */}
      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="flex items-center gap-2 mt-3 text-xs font-medium cursor-pointer transition-colors duration-200"
          style={{ color: "var(--text-accent)" }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            style={{
              transform: showAll ? "rotate(180deg)" : "rotate(0deg)",
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
          {showAll
            ? "Show fewer"
            : `Show all metrics (${filtered.length})`}
        </button>
      )}
    </section>
  );
}
