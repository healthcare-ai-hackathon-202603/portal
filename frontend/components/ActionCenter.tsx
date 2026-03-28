"use client";

import type { AlertItem, PatientMedication, LabTrajectory } from "@/lib/types";

export interface ActionItem {
  id: string;
  type: "care_gap" | "expiring_med" | "lab_result" | "follow_up";
  priority: "urgent" | "warning" | "info";
  title: string;
  context: string;
  cta: string;
}

function deriveActionItems(
  alerts: AlertItem[],
  medications: PatientMedication[],
  labTrajectories: LabTrajectory[]
): ActionItem[] {
  const items: ActionItem[] = [];

  // Derive from alerts — filter to actionable only
  for (const alert of alerts) {
    if (alert.severity === "info") continue; // info-only alerts are not actionable for patients

    if (alert.category === "care_gap") {
      items.push({
        id: `care_gap_${alert.title}`,
        type: "care_gap",
        priority: alert.severity === "urgent" ? "urgent" : "warning",
        title: alert.title,
        context: alert.description,
        cta: "Schedule test",
      });
    } else if (alert.category === "follow_up" && alert.severity !== "info") {
      items.push({
        id: `follow_up_${alert.title}`,
        type: "follow_up",
        priority: alert.severity === "urgent" ? "urgent" : "warning",
        title: alert.title,
        context: alert.description,
        cta: "Book follow-up",
      });
    } else if (
      alert.category === "lab_trend" &&
      (alert.severity === "urgent" || alert.severity === "warning")
    ) {
      items.push({
        id: `lab_${alert.title}`,
        type: "lab_result",
        priority: alert.severity,
        title: alert.title,
        context: alert.description,
        cta: "Review with provider",
      });
    }
  }

  // Expiring medications — derive from medication end_date
  const today = new Date("2026-03-28");
  for (const med of medications) {
    if (!med.clinical_details?.end_date) continue;
    const endDate = new Date(med.clinical_details.end_date);
    const daysLeft = Math.ceil(
      (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysLeft > 0 && daysLeft <= 30) {
      items.push({
        id: `med_${med.name}`,
        type: "expiring_med",
        priority: daysLeft <= 7 ? "urgent" : "warning",
        title: `Renew prescription: ${med.name}`,
        context: `Expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"} · ${med.dosage} ${med.frequency}`,
        cta: "Contact prescriber",
      });
    }
  }

  // Spiking lab results as actionable items
  for (const lab of labTrajectories) {
    if (lab.trend === "spiking" && lab.current_status !== "normal") {
      const alreadyHave = items.some(
        (i) => i.type === "lab_result" && i.title.toLowerCase().includes(lab.test_name.toLowerCase())
      );
      if (!alreadyHave) {
        items.push({
          id: `lab_spike_${lab.test_name}`,
          type: "lab_result",
          priority: "urgent",
          title: `Concerning change: ${lab.test_name}`,
          context: `Latest result ${lab.latest_value} ${lab.unit} — ${lab.change_percent > 0 ? "+" : ""}${lab.change_percent.toFixed(0)}% from baseline`,
          cta: "Review with provider",
        });
      }
    }
  }

  // Sort: urgent first, then warning
  items.sort((a, b) => {
    const order = { urgent: 0, warning: 1, info: 2 };
    return order[a.priority] - order[b.priority];
  });

  // Deduplicate by id
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  }).slice(0, 5);
}

const priorityConfig = {
  urgent: {
    borderColor: "var(--color-urgent)",
    glowColor: "rgba(248, 113, 113, 0.08)",
    accentColor: "var(--color-urgent)",
    labelColor: "var(--color-urgent)",
    label: "Action needed",
    dotColor: "#F87171",
  },
  warning: {
    borderColor: "var(--color-warning)",
    glowColor: "rgba(251, 191, 36, 0.06)",
    accentColor: "var(--color-warning)",
    labelColor: "var(--color-warning)",
    label: "Review soon",
    dotColor: "#FBBF24",
  },
  info: {
    borderColor: "var(--color-info)",
    glowColor: "rgba(96, 165, 250, 0.06)",
    accentColor: "var(--color-info)",
    labelColor: "var(--color-info)",
    label: "For your attention",
    dotColor: "#60A5FA",
  },
};

const typeIcons: Record<ActionItem["type"], React.ReactNode> = {
  care_gap: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="1.5" width="13" height="13" rx="3.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 5V8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="8" cy="10.5" r="0.65" fill="currentColor" />
    </svg>
  ),
  expiring_med: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 4.5V8L10 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  lab_result: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M6 2H10V8L12.5 13H3.5L6 8V2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M5.5 10H10.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  follow_up: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5 1.5V4.5M11 1.5V4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M5 8H8M5 10.5H10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
};

interface ActionCenterProps {
  alerts: AlertItem[];
  medications: PatientMedication[];
  labTrajectories: LabTrajectory[];
}

export default function ActionCenter({ alerts, medications, labTrajectories }: ActionCenterProps) {
  const items = deriveActionItems(alerts, medications, labTrajectories);

  if (items.length === 0) {
    return (
      <section>
        <SectionHeader title="Your Action Items" count={0} />
        <div
          className="card p-6 flex items-center gap-4"
          style={{ borderColor: "rgba(52, 211, 153, 0.2)", background: "rgba(52, 211, 153, 0.03)" }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(52, 211, 153, 0.1)", color: "var(--color-healthy)" }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M5 9L7.5 11.5L13 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="9" cy="9" r="7.5" stroke="currentColor" strokeWidth="1.3" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              You&apos;re all caught up
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
              No urgent actions needed right now.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section>
      <SectionHeader title="Your Action Items" count={items.length} />
      <div className="space-y-3 stagger">
        {items.map((item) => {
          const config = priorityConfig[item.priority];
          return (
            <div
              key={item.id}
              className="relative rounded-2xl overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${config.glowColor}, rgba(17, 24, 32, 0.0))`,
                border: `1px solid rgba(255,255,255,0.07)`,
                borderLeft: `3px solid ${config.borderColor}`,
              }}
            >
              <div className="flex items-start gap-4 p-4 sm:p-5">
                {/* Icon */}
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{
                    background: `${config.glowColor}`,
                    color: config.accentColor,
                    border: `1px solid ${config.borderColor}22`,
                  }}
                >
                  {typeIcons[item.type]}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-[10px] font-semibold uppercase tracking-widest"
                      style={{ color: config.labelColor, opacity: 0.85 }}
                    >
                      {config.label}
                    </span>
                    <span
                      className="w-1 h-1 rounded-full flex-shrink-0"
                      style={{ background: config.dotColor, opacity: 0.6 }}
                    />
                  </div>
                  <p
                    className="text-sm font-semibold leading-snug mb-1"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {item.title}
                  </p>
                  <p
                    className="text-xs leading-relaxed"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {item.context}
                  </p>
                </div>

                {/* CTA */}
                <button
                  className="flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-200 cursor-pointer hidden sm:block"
                  style={{
                    color: config.accentColor,
                    background: `${config.glowColor}`,
                    border: `1px solid ${config.borderColor}33`,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = `${config.borderColor}18`;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = `${config.glowColor}`;
                  }}
                >
                  {item.cta}
                </button>
              </div>

              {/* Mobile CTA */}
              <div
                className="sm:hidden px-4 pb-4"
                style={{ paddingLeft: "calc(1rem + 2rem + 1rem)" }}
              >
                <button
                  className="text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer"
                  style={{
                    color: config.accentColor,
                    background: `${config.glowColor}`,
                    border: `1px solid ${config.borderColor}33`,
                  }}
                >
                  {item.cta}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <h2
        className="text-sm font-semibold tracking-wide"
        style={{ color: "var(--text-secondary)", fontFamily: "'DM Sans', sans-serif" }}
      >
        {title}
      </h2>
      {count !== undefined && count > 0 && (
        <span
          className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
          style={{
            background: "var(--bg-surface)",
            color: "var(--text-muted)",
          }}
        >
          {count}
        </span>
      )}
    </div>
  );
}
