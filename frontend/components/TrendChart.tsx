"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceArea,
  ResponsiveContainer,
} from "recharts";
import type { DataPoint } from "@/lib/types";
import { FACILITY_SHORT_NAMES } from "@/lib/types";

interface TrendChartProps {
  data: DataPoint[];
  title: string;
  unit: string;
  trend: string;
  referenceRangeLow?: number;
  referenceRangeHigh?: number;
  normalRange?: string;
}

const trendColorHex: Record<string, string> = {
  improving: "#34D399",
  stable: "#60A5FA",
  worsening: "#FBBF24",
  spiking: "#F87171",
};

interface ChartDataPoint {
  timestamp: number;
  value: number;
  date: string;
  facility: string;
  abnormal: boolean;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartDataPoint }>;
  unit: string;
}

function CustomTooltip({ active, payload, unit }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const point = payload[0].payload;
  return (
    <div
      className="rounded-lg p-3 text-xs"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-default)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
      }}
    >
      <p className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
        {point.value} {unit}
      </p>
      <p style={{ color: "var(--text-secondary)" }}>{point.date}</p>
      {point.facility && (
        <p style={{ color: "var(--text-muted)" }}>{point.facility}</p>
      )}
    </div>
  );
}

export default function TrendChart({
  data,
  title,
  unit,
  trend,
  referenceRangeLow,
  referenceRangeHigh,
  normalRange,
}: TrendChartProps) {
  if (!data || data.length === 0) return null;

  if (data.length === 1) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          Single data point: {data[0].value} {unit}
        </span>
      </div>
    );
  }

  const lineColor = trendColorHex[trend] || "#60A5FA";

  const chartData: ChartDataPoint[] = data
    .map((d) => ({
      timestamp: new Date(d.date).getTime(),
      value: d.value,
      date: new Date(d.date).toLocaleDateString("en-CA", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      facility: d.facility
        ? FACILITY_SHORT_NAMES[d.facility] || d.facility
        : "",
      abnormal: d.abnormal,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  const values = chartData.map((d) => d.value);
  const allVals = [
    ...values,
    ...(referenceRangeLow !== undefined ? [referenceRangeLow] : []),
    ...(referenceRangeHigh !== undefined ? [referenceRangeHigh] : []),
  ];
  const minVal = Math.min(...allVals);
  const maxVal = Math.max(...allVals);
  const padding = (maxVal - minVal) * 0.15 || 1;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
        {referenceRangeLow !== undefined && referenceRangeHigh !== undefined && (
          <ReferenceArea
            y1={referenceRangeLow}
            y2={referenceRangeHigh}
            fill="rgba(52, 211, 153, 0.06)"
            stroke="rgba(52, 211, 153, 0.15)"
            strokeDasharray="4 4"
          />
        )}
        <XAxis
          dataKey="timestamp"
          type="number"
          domain={["dataMin", "dataMax"]}
          tickFormatter={(ts: number) => {
            const d = new Date(ts);
            return d.toLocaleDateString("en-CA", { month: "short", year: "2-digit" });
          }}
          tick={{ fill: "#5A6677", fontSize: 10 }}
          axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
          tickLine={false}
        />
        <YAxis
          domain={[minVal - padding, maxVal + padding]}
          tick={{ fill: "#5A6677", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip content={<CustomTooltip unit={unit} />} />
        <Line
          type="monotone"
          dataKey="value"
          stroke={lineColor}
          strokeWidth={2}
          dot={{
            r: 4,
            fill: lineColor,
            stroke: "var(--bg-secondary)",
            strokeWidth: 2,
          }}
          activeDot={{
            r: 6,
            fill: lineColor,
            stroke: "#fff",
            strokeWidth: 2,
          }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
