"use client";

import type { AlertItem } from "@/lib/types";

interface HealthPulseProps {
  alerts: AlertItem[];
}

const severityConfig = {
  urgent: {
    badge: "badge-urgent",
    glow: "glow-urgent",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          d="M10 2L18 18H2L10 2Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M10 8V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="10" cy="14" r="0.75" fill="currentColor" />
      </svg>
    ),
  },
  warning: {
    badge: "badge-warning",
    glow: "",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 6V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="10" cy="14" r="0.75" fill="currentColor" />
      </svg>
    ),
  },
  info: {
    badge: "badge-info",
    glow: "",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 9V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="10" cy="6.5" r="0.75" fill="currentColor" />
      </svg>
    ),
  },
};

const categoryLabels: Record<AlertItem["category"], string> = {
  lab_trend: "Lab Result",
  medication: "Medication",
  care_gap: "Care Gap",
  follow_up: "Follow-Up",
};

export default function HealthPulse({ alerts }: HealthPulseProps) {
  const displayAlerts = alerts.slice(0, 6);

  return (
    <section>
      <h2
        className="text-sm font-semibold uppercase tracking-widest mb-4 flex items-center gap-2"
        style={{ color: "var(--color-urgent)" }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 5V8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="8" cy="11.5" r="0.75" fill="currentColor" />
        </svg>
        Critical Actions Needed
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
        {displayAlerts.length === 0 ? (
          <div className="card p-5 glow-urgent">
            <div className="flex items-start gap-3">
              <div className="badge-urgent" style={{ padding: "6px", borderRadius: "8px" }}>
                {severityConfig.urgent.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="badge-urgent text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">
                    Care Gap
                  </span>
                </div>
                <h3 className="text-sm font-semibold mb-1 leading-snug" style={{ color: "var(--text-primary)" }}>
                  Cardiology Follow-Up
                </h3>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  Immediate follow-up required based on recent telemetry.
                </p>
              </div>
            </div>
          </div>
        ) : null}
        {displayAlerts.map((alert, i) => {
          const config = severityConfig[alert.severity];
          return (
            <div
              key={i}
              className={`card p-5 ${config.glow}`}
            >
              <div className="flex items-start gap-3">
                <div className={config.badge} style={{ padding: "6px", borderRadius: "8px" }}>
                  {config.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`${config.badge} text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider`}
                    >
                      {categoryLabels[alert.category]}
                    </span>
                  </div>
                  <h3
                    className="text-sm font-semibold mb-1 leading-snug"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {alert.title}
                  </h3>
                  <p
                    className="text-xs leading-relaxed"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {alert.description}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
