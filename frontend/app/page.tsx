"use client";

import Link from "next/link";

const DEMO_PATIENTS = [
  {
    id: "PAT-001918",
    name: "Jose Page",
    age: 65,
    sex: "M",
    tagline: "Accelerating HbA1c Deterioration",
    description:
      "HbA1c spiked from 4.98% to 10.87% across 5 facilities. On prednisone (glucose elevator) with no diabetes medication. Critically low sodium.",
    encounters: 309,
    facilities: 5,
    highlights: [
      { label: "HbA1c Spike", severity: "urgent" as const },
      { label: "Drug-Lab Correlation", severity: "urgent" as const },
      { label: "No Diabetes Rx", severity: "warning" as const },
    ],
  },
  {
    id: "PAT-001792",
    name: "Michael",
    age: 44,
    sex: "M",
    tagline: "Duplicate Medications & Care Gaps",
    description:
      "On both pantoprazole AND omeprazole (duplicate PPIs). HbA1c 8.1% with no diabetes medication. Cholesterol 6.21 with no statin. Three care gaps.",
    encounters: 74,
    facilities: 3,
    highlights: [
      { label: "Duplicate PPIs", severity: "warning" as const },
      { label: "Unmanaged Diabetes", severity: "urgent" as const },
      { label: "No Statin", severity: "warning" as const },
    ],
  },
  {
    id: "PAT-001421",
    name: "William",
    age: 40,
    sex: "M",
    tagline: "Persistent Lipid Pattern",
    description:
      "HbA1c spiked to 6.94%. LDL consistently elevated (4.48, 4.91, 4.52). On sertraline + sitagliptin but no statin despite persistent lipid elevation.",
    encounters: 219,
    facilities: 4,
    highlights: [
      { label: "Elevated LDL", severity: "warning" as const },
      { label: "HbA1c Rising", severity: "warning" as const },
      { label: "Missing Statin", severity: "info" as const },
    ],
  },
];

const severityStyles = {
  urgent: "badge-urgent",
  warning: "badge-warning",
  info: "badge-info",
};

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="max-w-4xl w-full text-center mb-16 stagger">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-default)",
            }}
          >
            <span
              className="w-2 h-2 rounded-full animate-pulse-soft"
              style={{ background: "var(--color-healthy)" }}
            />
            <span
              className="text-xs font-medium tracking-wide uppercase"
              style={{ color: "var(--text-secondary)" }}
            >
              Pre-Visit Intelligence System
            </span>
          </div>

          <h1
            className="text-5xl md:text-6xl font-bold tracking-tight mb-4"
            style={{ fontFamily: "var(--font-display)" }}
          >
            <span style={{ color: "var(--text-primary)" }}>Health</span>
            <span style={{ color: "var(--text-accent)" }}>Sync</span>
          </h1>

          <p
            className="text-lg md:text-xl max-w-2xl mx-auto leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            Same patient data. Two lenses. See how intelligence flows from
            longitudinal history into actionable insights for{" "}
            <span style={{ color: "var(--text-primary)" }}>patients</span> and{" "}
            <span style={{ color: "var(--text-primary)" }}>clinicians</span>.
          </p>
        </div>

        {/* Demo patient cards */}
        <div className="max-w-5xl w-full stagger">
          <p
            className="text-sm font-medium uppercase tracking-widest mb-6 text-center"
            style={{ color: "var(--text-muted)" }}
          >
            Select a demo patient
          </p>

          <div className="grid md:grid-cols-3 gap-5">
            {DEMO_PATIENTS.map((patient) => (
              <Link
                href={`/patient/${patient.id}`}
                key={patient.id}
                className="card group p-6 flex flex-col cursor-pointer no-underline"
              >
                {/* Patient header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-xs font-mono"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {patient.id}
                      </span>
                    </div>
                    <h3
                      className="text-lg font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {patient.name}
                    </h3>
                    <span
                      className="text-sm"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {patient.age}{patient.sex}
                    </span>
                  </div>
                  <div
                    className="flex items-center gap-3 text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <span>{patient.encounters} visits</span>
                  </div>
                </div>

                {/* Tagline */}
                <p
                  className="text-sm font-medium mb-2"
                  style={{ color: "var(--text-accent)" }}
                >
                  {patient.tagline}
                </p>

                {/* Description */}
                <p
                  className="text-sm leading-relaxed mb-4 flex-1"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {patient.description}
                </p>

                {/* Highlight badges */}
                <div className="flex flex-wrap gap-2">
                  {patient.highlights.map((h, i) => (
                    <span
                      key={i}
                      className={`${severityStyles[h.severity]} text-xs px-2.5 py-1 rounded-full font-medium`}
                    >
                      {h.label}
                    </span>
                  ))}
                </div>

                {/* Arrow indicator */}
                <div
                  className="mt-4 pt-4 flex items-center gap-2 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    borderTop: "1px solid var(--border-subtle)",
                    color: "var(--text-accent)",
                  }}
                >
                  View patient intelligence
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    className="transform group-hover:translate-x-1 transition-transform"
                  >
                    <path
                      d="M6 3L11 8L6 13"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Footer note */}
        <p
          className="mt-12 text-xs text-center max-w-lg"
          style={{ color: "var(--text-muted)" }}
        >
          Built with synthetic patient data (2,000 patients, 10,000 encounters
          across 5 Island Health facilities). No real patient information is used.
        </p>
      </div>
    </main>
  );
}
