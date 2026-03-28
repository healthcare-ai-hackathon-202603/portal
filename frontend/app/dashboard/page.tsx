"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  getPatients,
  getClinicalBrief,
  getPatient,
  getPatientIssues,
  getMedications,
} from "@/lib/api";
import type {
  PatientListItem,
  SessionDelta,
  Patient,
  PatientIssue,
  MedicationsResponse,
} from "@/lib/types";
import PatientList from "@/components/PatientList";
import ClinicianPanel from "@/components/clinician/ClinicianPanel";
import ViewToggle from "@/components/ViewToggle";

interface PatientData {
  patient: Patient;
  brief: SessionDelta;
  issues: PatientIssue[];
  medications: MedicationsResponse;
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const preselected = searchParams.get("patient");

  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(preselected);
  const [patientData, setPatientData] = useState<PatientData | null>(null);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loadingBrief, setLoadingBrief] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load patient list
  useEffect(() => {
    setLoadingPatients(true);
    getPatients()
      .then((data) => {
        setPatients(data);
        setLoadingPatients(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoadingPatients(false);
      });
  }, []);

  // Load all patient data when selected
  useEffect(() => {
    if (!selectedId) {
      setPatientData(null);
      return;
    }
    setLoadingBrief(true);
    setError(null);

    Promise.all([
      getPatient(selectedId),
      getClinicalBrief(selectedId),
      getPatientIssues(selectedId),
      getMedications(selectedId),
    ])
      .then(([patient, brief, issues, medications]) => {
        setPatientData({ patient, brief, issues, medications });
        setLoadingBrief(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoadingBrief(false);
      });
  }, [selectedId]);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    window.history.replaceState(null, "", `/dashboard?patient=${id}`);
  }, []);

  return (
    <div
      className="h-screen flex flex-col"
      style={{ background: "var(--bg-primary)" }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-3 shrink-0"
        style={{
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--bg-secondary)",
        }}
      >
        <div className="flex items-center gap-4">
          <h1
            className="text-lg font-semibold tracking-tight"
            style={{
              fontFamily: "var(--font-display)",
              color: "var(--text-primary)",
            }}
          >
            HealthSync
          </h1>
          <span
            className="text-xs uppercase tracking-widest"
            style={{ color: "var(--text-muted)" }}
          >
            Clinical Dashboard
          </span>
        </div>
        {selectedId && (
          <ViewToggle currentView="clinician" patientId={selectedId} />
        )}
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside
          className="w-80 shrink-0 flex flex-col"
          style={{
            borderRight: "1px solid var(--border-subtle)",
            background: "var(--bg-secondary)",
          }}
        >
          {loadingPatients ? (
            <div className="flex items-center justify-center h-full">
              <div
                className="text-sm animate-pulse-soft"
                style={{ color: "var(--text-muted)" }}
              >
                Loading patients...
              </div>
            </div>
          ) : (
            <PatientList
              patients={patients}
              selectedId={selectedId}
              onSelect={handleSelect}
            />
          )}
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-6">
          {error && (
            <div className="card p-4 mb-4 glow-urgent">
              <span
                className="text-sm"
                style={{ color: "var(--color-urgent)" }}
              >
                {error}
              </span>
            </div>
          )}

          {!selectedId && !error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p
                  className="text-lg"
                  style={{
                    fontFamily: "var(--font-display)",
                    color: "var(--text-muted)",
                  }}
                >
                  Select a patient to view clinical brief
                </p>
                <p
                  className="text-sm mt-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  Flagged patients appear at the top of the list
                </p>
              </div>
            </div>
          )}

          {selectedId && loadingBrief && (
            <div className="flex items-center justify-center h-64">
              <div className="space-y-3 text-center">
                <div
                  className="text-sm animate-pulse-soft"
                  style={{ color: "var(--text-muted)" }}
                >
                  Generating clinical brief...
                </div>
                <div
                  className="text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  Computing session delta for {selectedId}
                </div>
              </div>
            </div>
          )}

          {patientData && !loadingBrief && (
            <ClinicianPanel
              patient={patientData.patient}
              brief={patientData.brief}
              issues={patientData.issues}
              medications={patientData.medications}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div
          className="h-screen flex items-center justify-center"
          style={{ background: "var(--bg-primary)" }}
        >
          <div
            className="text-sm animate-pulse-soft"
            style={{ color: "var(--text-muted)" }}
          >
            Loading dashboard...
          </div>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
