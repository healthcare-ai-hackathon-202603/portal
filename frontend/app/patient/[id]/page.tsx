"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getPatientSummary, getTimeline, getLabTrajectories, getVitalTrajectories } from "@/lib/api";
import type { PatientSummary, Encounter, LabTrajectory, VitalTrajectory } from "@/lib/types";
import ViewToggle from "@/components/ViewToggle";
import HealthPulse from "@/components/HealthPulse";
import HealthTimeline from "@/components/HealthTimeline";
import MedList from "@/components/MedList";
import TrendChart from "@/components/TrendChart";

type ExpandedSection = "medications" | "labs" | "vitals" | null;

export default function PatientPage() {
  const params = useParams<{ id: string }>();
  const patientId = params.id;

  const [summary, setSummary] = useState<PatientSummary | null>(null);
  const [timeline, setTimeline] = useState<Encounter[]>([]);
  const [labTrajectories, setLabTrajectories] = useState<LabTrajectory[]>([]);
  const [vitalTrajectories, setVitalTrajectories] = useState<VitalTrajectory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<ExpandedSection>(null);

  useEffect(() => {
    if (!patientId) return;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const [summaryData, timelineData, labData, vitalData] = await Promise.all([
          getPatientSummary(patientId),
          getTimeline(patientId),
          getLabTrajectories(patientId).catch(() => [] as LabTrajectory[]),
          getVitalTrajectories(patientId).catch(() => [] as VitalTrajectory[]),
        ]);
        setSummary(summaryData);
        setTimeline(timelineData);
        setLabTrajectories(labData);
        setVitalTrajectories(vitalData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load patient data");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [patientId]);

  const toggleSection = (section: ExpandedSection) => {
    setExpandedSection((prev) => (prev === section ? null : section));
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error || !summary) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="card p-8 max-w-md w-full text-center">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: "rgba(248, 113, 113, 0.1)" }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="var(--color-urgent)" strokeWidth="1.5" />
              <path d="M12 8V12" stroke="var(--color-urgent)" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="12" cy="16" r="1" fill="var(--color-urgent)" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
            Unable to Load Patient Data
          </h2>
          <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
            {error || "Patient not found. Please check the ID and try again."}
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium no-underline"
            style={{ color: "var(--text-accent)" }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 13L5 8L10 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to Home
          </Link>
        </div>
      </main>
    );
  }

  const { patient, alerts, active_medications } = summary;

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header
        className="sticky top-0 z-40 backdrop-blur-xl"
        style={{
          background: "rgba(11, 15, 20, 0.85)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-1 text-sm no-underline transition-colors"
              style={{ color: "var(--text-muted)" }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 13L5 8L10 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Home
            </Link>
            <div
              className="w-px h-6"
              style={{ background: "var(--border-default)" }}
            />
            <div>
              <h1
                className="text-lg font-bold leading-tight"
                style={{ color: "var(--text-primary)" }}
              >
                {patient.first_name} {patient.last_name}
              </h1>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {patient.age} years old &middot; {patient.sex === "M" ? "Male" : patient.sex === "F" ? "Female" : patient.sex}
                {patient.primary_language && patient.primary_language !== "English" && (
                  <> &middot; {patient.primary_language}</>
                )}
              </p>
            </div>
          </div>
          <ViewToggle currentView="patient" patientId={patientId} />
        </div>
      </header>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">
        {/* Health Pulse */}
        {alerts && alerts.length > 0 && (
          <div className="animate-fade-in-up">
            <HealthPulse alerts={alerts} />
          </div>
        )}

        {/* Health Timeline */}
        {timeline && timeline.length > 0 && (
          <div className="animate-fade-in-up" style={{ animationDelay: "150ms" }}>
            <HealthTimeline encounters={timeline} />
          </div>
        )}

        {/* Expandable Details */}
        <div className="space-y-3 animate-fade-in-up" style={{ animationDelay: "300ms" }}>
          <h2
            className="text-sm font-semibold uppercase tracking-widest mb-4"
            style={{ color: "var(--text-muted)" }}
          >
            Details
          </h2>

          {/* Medications */}
          <ExpandableSection
            title="Medications"
            subtitle={`${active_medications?.length || 0} active`}
            isOpen={expandedSection === "medications"}
            onToggle={() => toggleSection("medications")}
          >
            <MedList medications={active_medications || []} />
          </ExpandableSection>

          {/* Lab Trends */}
          {labTrajectories.length > 0 && (
            <ExpandableSection
              title="Lab Results"
              subtitle={`${labTrajectories.length} tracked`}
              isOpen={expandedSection === "labs"}
              onToggle={() => toggleSection("labs")}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {labTrajectories.map((lab, i) => (
                  <div key={i} className="card p-4 overflow-hidden">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{lab.test_name}</h4>
                        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                          Normal: {lab.reference_range_low}{lab.unit} - {lab.reference_range_high}{lab.unit}
                        </p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full badge-${lab.trend === "spiking" ? "urgent" : lab.trend === "worsening" ? "warning" : lab.trend === "improving" ? "healthy" : "info"}`}>
                        {lab.trend}
                      </span>
                    </div>
                    <div style={{ height: 160, width: "100%" }}>
                      <TrendChart
                        data={lab.values}
                        title={lab.test_name}
                        unit={lab.unit}
                        trend={lab.trend}
                        referenceRangeLow={lab.reference_range_low}
                        referenceRangeHigh={lab.reference_range_high}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </ExpandableSection>
          )}

          {/* Vital Trends */}
          {vitalTrajectories.length > 0 && (
            <ExpandableSection
              title="Vitals"
              subtitle={`${vitalTrajectories.length} tracked`}
              isOpen={expandedSection === "vitals"}
              onToggle={() => toggleSection("vitals")}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {vitalTrajectories.map((vital, i) => (
                  <div key={i} className="card p-4 overflow-hidden">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{vital.vital_name}</h4>
                        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                          Normal: {vital.normal_range}
                        </p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full badge-${vital.trend === "spiking" ? "urgent" : vital.trend === "worsening" ? "warning" : vital.trend === "improving" ? "healthy" : "info"}`}>
                        {vital.trend}
                      </span>
                    </div>
                    <div style={{ height: 160, width: "100%" }}>
                      <TrendChart
                        data={vital.values}
                        title={vital.vital_name}
                        unit={vital.unit}
                        trend={vital.trend}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </ExpandableSection>
          )}
        </div>

        {/* Footer */}
        <footer className="pt-8 pb-12 text-center">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            This summary is generated from your health records for your reference.
            Always consult your healthcare provider for medical advice.
          </p>
        </footer>
      </div>
    </main>
  );
}

/* Expandable Section Component */
function ExpandableSection({
  title,
  subtitle,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  subtitle: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="card-elevated overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-5 cursor-pointer text-left"
        style={{ background: "transparent", border: "none" }}
      >
        <div className="flex items-center gap-3">
          <h3
            className="text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {title}
          </h3>
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{
              background: "var(--bg-surface)",
              color: "var(--text-secondary)",
            }}
          >
            {subtitle}
          </span>
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className="transition-transform duration-200"
          style={{
            color: "var(--text-muted)",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          <path
            d="M4 6L8 10L12 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {isOpen && (
        <div
          className="px-5 pb-5 animate-fade-in-up"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        >
          <div className="pt-4">{children}</div>
        </div>
      )}
    </div>
  );
}

/* Loading Skeleton */
function LoadingSkeleton() {
  return (
    <main className="min-h-screen">
      <header
        className="sticky top-0 z-40"
        style={{
          background: "var(--bg-primary)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-4 rounded animate-pulse-soft"
              style={{ background: "var(--bg-surface)" }}
            />
            <div
              className="w-px h-6"
              style={{ background: "var(--border-default)" }}
            />
            <div>
              <div
                className="w-32 h-5 rounded mb-1 animate-pulse-soft"
                style={{ background: "var(--bg-surface)" }}
              />
              <div
                className="w-24 h-3 rounded animate-pulse-soft"
                style={{ background: "var(--bg-surface)" }}
              />
            </div>
          </div>
          <div
            className="w-48 h-10 rounded-xl animate-pulse-soft"
            style={{ background: "var(--bg-surface)" }}
          />
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">
        {/* Pulse skeleton */}
        <div>
          <div
            className="w-28 h-4 rounded mb-4 animate-pulse-soft"
            style={{ background: "var(--bg-surface)" }}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="card p-5 animate-pulse-soft"
                style={{ animationDelay: `${n * 100}ms` }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-8 h-8 rounded-lg"
                    style={{ background: "var(--bg-surface)" }}
                  />
                  <div className="flex-1 space-y-2">
                    <div
                      className="w-16 h-3 rounded"
                      style={{ background: "var(--bg-surface)" }}
                    />
                    <div
                      className="w-full h-4 rounded"
                      style={{ background: "var(--bg-surface)" }}
                    />
                    <div
                      className="w-3/4 h-3 rounded"
                      style={{ background: "var(--bg-surface)" }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline skeleton */}
        <div>
          <div
            className="w-32 h-4 rounded mb-4 animate-pulse-soft"
            style={{ background: "var(--bg-surface)" }}
          />
          <div className="space-y-4 pl-8">
            {[1, 2, 3, 4, 5].map((n) => (
              <div
                key={n}
                className="card p-4 animate-pulse-soft"
                style={{ animationDelay: `${n * 80}ms` }}
              >
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div
                      className="w-20 h-3 rounded"
                      style={{ background: "var(--bg-surface)" }}
                    />
                    <div
                      className="w-10 h-3 rounded"
                      style={{ background: "var(--bg-surface)" }}
                    />
                  </div>
                  <div
                    className="w-2/3 h-4 rounded"
                    style={{ background: "var(--bg-surface)" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
