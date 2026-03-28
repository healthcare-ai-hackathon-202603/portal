"use client";

import { useState } from "react";
import type { RiskScore } from "@/lib/types";

interface RiskScoreCardProps {
  riskScore: RiskScore;
}

const levelConfig = {
  good: {
    label: "Low Risk",
    badgeClass: "badge-healthy",
    accentColor: "var(--color-healthy)",
    glowColor: "rgba(52, 211, 153, 0.08)",
    borderColor: "rgba(52, 211, 153, 0.2)",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M6.5 10L9 12.5L13.5 7.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  watch: {
    label: "Watch",
    badgeClass: "badge-warning",
    accentColor: "var(--color-warning)",
    glowColor: "rgba(251, 191, 36, 0.08)",
    borderColor: "rgba(251, 191, 36, 0.2)",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M10 6V10"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="10" cy="13" r="0.75" fill="currentColor" />
      </svg>
    ),
  },
  "at-risk": {
    label: "At Risk",
    badgeClass: "badge-urgent",
    accentColor: "var(--color-urgent)",
    glowColor: "rgba(248, 113, 113, 0.08)",
    borderColor: "rgba(248, 113, 113, 0.2)",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          d="M10 2L18.5 17H1.5L10 2Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M10 8V11.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="10" cy="14" r="0.75" fill="currentColor" />
      </svg>
    ),
  },
};

export default function RiskScoreCard({ riskScore }: RiskScoreCardProps) {
  const [expanded, setExpanded] = useState(false);
  const config = levelConfig[riskScore.level];

  return (
    <div
      className={`card p-5 ${riskScore.level === "at-risk" ? "glow-urgent" : ""}`}
      style={{
        borderColor: config.borderColor,
      }}
    >
      <div className="flex items-center gap-4">
        {/* Icon */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: config.glowColor,
            color: config.accentColor,
            border: `1px solid ${config.borderColor}`,
          }}
        >
          {config.icon}
        </div>

        {/* Score + Label */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <span
              className="text-2xl font-bold tabular-nums"
              style={{ color: config.accentColor }}
            >
              {riskScore.score}
            </span>
            <span
              className={`${config.badgeClass} text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full`}
            >
              {config.label}
            </span>
          </div>
          <p
            className="text-xs mt-0.5"
            style={{ color: "var(--text-secondary)" }}
          >
            Risk Score
          </p>
        </div>

        {/* Expand toggle */}
        {riskScore.factors.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-200 cursor-pointer"
            style={{
              background: "var(--bg-surface)",
              color: "var(--text-muted)",
            }}
            aria-label={expanded ? "Collapse factors" : "Expand factors"}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              style={{
                transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
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
          </button>
        )}
      </div>

      {/* Contributing factors */}
      {expanded && riskScore.factors.length > 0 && (
        <div
          className="mt-4 pt-3 space-y-2 animate-fade-in"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        >
          <p
            className="text-[10px] font-semibold uppercase tracking-widest mb-2"
            style={{ color: "var(--text-muted)" }}
          >
            Contributing Factors
          </p>
          {riskScore.factors.map((factor, i) => (
            <div key={i} className="flex items-start gap-2">
              <span
                className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0"
                style={{ background: config.accentColor, opacity: 0.6 }}
              />
              <span
                className="text-xs leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                {factor}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
