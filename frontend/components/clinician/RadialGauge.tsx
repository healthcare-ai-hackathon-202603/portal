"use client";

import type { LabTrajectory } from "@/lib/types";

interface RadialGaugeProps {
  lab: LabTrajectory;
  onShowDetails: (testName: string) => void;
  isDetailOpen: boolean;
}

const TREND_COLORS: Record<string, string> = {
  improving: "var(--color-improving)",
  stable: "var(--color-stable)",
  worsening: "var(--color-worsening)",
  spiking: "var(--color-spiking)",
};

const TREND_ARROWS: Record<string, string> = {
  improving: "\u2193",
  stable: "\u2192",
  worsening: "\u2191",
  spiking: "\u2191\u2191",
};

const CX = 90;
const CY = 90;
const RADIUS = 70;
const START_ANGLE = 135;
const END_ANGLE = 405;
const SWEEP = END_ANGLE - START_ANGLE;

function polarToCartesian(angle: number): { x: number; y: number } {
  const rad = ((angle - 90) * Math.PI) / 180;
  return {
    x: CX + RADIUS * Math.cos(rad),
    y: CY + RADIUS * Math.sin(rad),
  };
}

function describeArc(startAngle: number, endAngle: number): string {
  const start = polarToCartesian(endAngle);
  const end = polarToCartesian(startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

function valueToAngle(value: number, min: number, max: number): number {
  if (max === min) return START_ANGLE + SWEEP / 2;
  const clamped = Math.max(min, Math.min(max, value));
  const ratio = (clamped - min) / (max - min);
  return START_ANGLE + ratio * SWEEP;
}

function getArcColor(value: number, low: number, high: number): string {
  if (value >= low && value <= high) return "var(--color-healthy)";
  const range = high - low;
  const margin = range * 0.1;
  if (
    (value >= low - margin && value < low) ||
    (value > high && value <= high + margin)
  )
    return "var(--color-warning)";
  return "var(--color-urgent)";
}

export default function RadialGauge({
  lab,
  onShowDetails,
  isDetailOpen,
}: RadialGaugeProps) {
  const { test_name, unit, latest_value, reference_range_low, reference_range_high, trend, change_percent } = lab;

  const range = reference_range_high - reference_range_low;
  const scaleMin = reference_range_low - range * 0.3;
  const scaleMax = reference_range_high + range * 0.3;

  const refStartAngle = valueToAngle(reference_range_low, scaleMin, scaleMax);
  const refEndAngle = valueToAngle(reference_range_high, scaleMin, scaleMax);

  const needleAngle = valueToAngle(latest_value, scaleMin, scaleMax);
  const needlePos = polarToCartesian(needleAngle);

  const arcColor = getArcColor(latest_value, reference_range_low, reference_range_high);
  const trendColor = TREND_COLORS[trend] ?? "var(--color-info)";
  const sign = change_percent >= 0 ? "+" : "";

  return (
    <div className="flex flex-col items-center">
      <div
        className="card p-4 flex flex-col items-center cursor-pointer transition-all duration-150"
        style={{
          borderColor: isDetailOpen ? "var(--border-focus)" : undefined,
        }}
        onClick={() => onShowDetails(test_name)}
      >
        <svg width="180" height="130" viewBox="0 0 180 130">
          {/* Background track */}
          <path
            d={describeArc(START_ANGLE, END_ANGLE)}
            fill="none"
            stroke="var(--bg-surface)"
            strokeWidth="10"
            strokeLinecap="round"
          />

          {/* Reference range (green zone) */}
          <path
            d={describeArc(refStartAngle, refEndAngle)}
            fill="none"
            stroke="rgba(52, 211, 153, 0.25)"
            strokeWidth="10"
            strokeLinecap="round"
          />

          {/* Active arc from start to needle */}
          <path
            d={describeArc(START_ANGLE, needleAngle)}
            fill="none"
            stroke={arcColor}
            strokeWidth="10"
            strokeLinecap="round"
          />

          {/* Needle dot */}
          <circle
            cx={needlePos.x}
            cy={needlePos.y}
            r="6"
            fill={arcColor}
            stroke="var(--bg-secondary)"
            strokeWidth="2"
          />

          {/* Center hero value */}
          <text
            x={CX}
            y={CY - 6}
            textAnchor="middle"
            fill="var(--text-primary)"
            fontSize="22"
            fontWeight="700"
            fontFamily="var(--font-mono)"
          >
            {latest_value % 1 === 0 ? latest_value : latest_value.toFixed(1)}
          </text>
          <text
            x={CX}
            y={CY + 12}
            textAnchor="middle"
            fill="var(--text-muted)"
            fontSize="11"
          >
            {unit}
          </text>

          {/* Trend label at bottom */}
          <text
            x={CX}
            y={CY + 36}
            textAnchor="middle"
            fill={trendColor}
            fontSize="11"
            fontWeight="600"
          >
            {TREND_ARROWS[trend]} {trend.charAt(0).toUpperCase() + trend.slice(1)} {sign}{change_percent.toFixed(0)}%
          </text>
        </svg>

        <span
          className="text-xs font-medium mt-1"
          style={{ color: "var(--text-secondary)" }}
        >
          {test_name}
        </span>
      </div>
    </div>
  );
}
