"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { 
  getPatientSummary, 
  getTimeline, 
  getLabTrajectories, 
  getVitalTrajectories,
  getRiskScore,
  getPatientIssues
} from "@/lib/api";
import type { 
  PatientSummary, 
  Encounter, 
  LabTrajectory, 
  VitalTrajectory,
  RiskScore,
  PatientIssue
} from "@/lib/types";

import ViewToggle from "@/components/ViewToggle";
import HealthPulse from "@/components/HealthPulse";
import RiskScoreCard from "@/components/RiskScoreCard";
import ActionCenter from "@/components/ActionCenter";
import CalendarPanel from "@/components/CalendarPanel";
import ChatWidget from "@/components/ChatWidget";
import ContextMetrics from "@/components/ContextMetrics";
import IssuePanel from "@/components/IssuePanel";

export default function PatientPage() {
  const params = useParams<{ id: string }>();
  const patientId = params.id;

  const [summary, setSummary] = useState<PatientSummary | null>(null);
  const [timeline, setTimeline] = useState<Encounter[]>([]);
  const [labTrajectories, setLabTrajectories] = useState<LabTrajectory[]>([]);
  const [vitalTrajectories, setVitalTrajectories] = useState<VitalTrajectory[]>([]);
  const [riskScore, setRiskScore] = useState<RiskScore | null>(null);
  const [issues, setIssues] = useState<PatientIssue[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
  const [relevantMetrics, setRelevantMetrics] = useState<string[]>([]);

  useEffect(() => {
    if (!patientId) return;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const [summaryData, timelineData, labData, vitalData, riskData, issuesData] = await Promise.all([
          getPatientSummary(patientId),
          getTimeline(patientId),
          getLabTrajectories(patientId).catch(() => [] as LabTrajectory[]),
          getVitalTrajectories(patientId).catch(() => [] as VitalTrajectory[]),
          getRiskScore(patientId).catch(() => null),
          getPatientIssues(patientId).catch(() => [] as PatientIssue[]),
        ]);
        setSummary(summaryData);
        setTimeline(timelineData);
        setLabTrajectories(labData);
        setVitalTrajectories(vitalData);
        setRiskScore(riskData);
        setIssues(issuesData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load patient data");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [patientId]);

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
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-1 text-sm no-underline transition-colors"
              style={{ color: "var(--text-muted)" }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 13L5 8L10 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Directory
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
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Bar — Risk → Metrics → Issues */}
          <div className="lg:col-span-3 space-y-8 animate-fade-in-up">
            {riskScore && <RiskScoreCard riskScore={riskScore} />}
            <ContextMetrics 
              labTrajectories={labTrajectories} 
              vitalTrajectories={vitalTrajectories} 
              relevantMetrics={relevantMetrics} 
            />
            <IssuePanel 
              issues={issues} 
              selectedIssue={selectedIssue} 
              onIssueSelect={setSelectedIssue}
              maxActive={3}
            />
          </div>

          {/* Center — Action Tasks (HealthPulse Cards) & Timeline */}
          <div className="lg:col-span-6 space-y-8 animate-fade-in-up" style={{ animationDelay: "150ms" }}>
            {/* Health Pulse (Urgent alerts always visible) */}
            {alerts && alerts.length > 0 && (
              <HealthPulse alerts={alerts.filter((a) => a.severity === "urgent")} />
            )}
            
            <ActionCenter 
              alerts={alerts} 
              medications={active_medications || []} 
              labTrajectories={labTrajectories} 
            />
          </div>

          {/* Right Bar — Calendar */}
          <div className="lg:col-span-3 space-y-8 animate-fade-in-up" style={{ animationDelay: "300ms" }}>
            <CalendarPanel 
              alerts={alerts} 
              medications={active_medications || []} 
              recentEncounters={timeline || []} 
            />
          </div>
        </div>

        {/* Footer */}
        <footer className="pt-16 pb-12 text-center">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            This summary is generated from your health records for your reference.
            Always consult your healthcare provider for medical advice.
          </p>
        </footer>
      </div>

      <ChatWidget 
        patientId={patientId} 
        patientName={`${patient.first_name} ${patient.last_name}`} 
        onMetricsUpdate={setRelevantMetrics} 
      />
    </main>
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
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
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

      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-3 space-y-6">
            <div className="w-full h-32 rounded-xl animate-pulse-soft" style={{ background: "var(--bg-surface)" }} />
            <div className="w-full h-48 rounded-xl animate-pulse-soft" style={{ background: "var(--bg-surface)" }} />
          </div>
          <div className="lg:col-span-6 space-y-6">
            <div className="w-full h-40 rounded-xl animate-pulse-soft" style={{ background: "var(--bg-surface)" }} />
            <div className="w-full h-64 rounded-xl animate-pulse-soft" style={{ background: "var(--bg-surface)" }} />
          </div>
          <div className="lg:col-span-3 space-y-6">
            <div className="w-full h-56 rounded-xl animate-pulse-soft" style={{ background: "var(--bg-surface)" }} />
          </div>
        </div>
      </div>
    </main>
  );
}
