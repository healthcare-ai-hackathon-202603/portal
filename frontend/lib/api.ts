const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchAPI<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

import type {
  PatientListItem,
  Patient,
  PatientSummary,
  SessionDelta,
  Encounter,
  LabTrajectory,
  VitalTrajectory,
  MedicationsResponse,
} from "./types";

export async function getPatients(): Promise<PatientListItem[]> {
  return fetchAPI<PatientListItem[]>("/api/patients");
}

export async function getPatient(id: string): Promise<Patient> {
  return fetchAPI<Patient>(`/api/patients/${id}`);
}

export async function getPatientSummary(
  id: string,
  lang = "en"
): Promise<PatientSummary> {
  return fetchAPI<PatientSummary>(`/api/patients/${id}/summary?lang=${lang}`);
}

export async function getClinicalBrief(id: string): Promise<SessionDelta> {
  return fetchAPI<SessionDelta>(`/api/patients/${id}/clinical-brief`);
}

export async function getTimeline(id: string): Promise<Encounter[]> {
  return fetchAPI<Encounter[]>(`/api/patients/${id}/timeline`);
}

export async function getLabTrajectories(
  id: string
): Promise<LabTrajectory[]> {
  return fetchAPI<LabTrajectory[]>(`/api/patients/${id}/labs`);
}

export async function getVitalTrajectories(
  id: string
): Promise<VitalTrajectory[]> {
  return fetchAPI<VitalTrajectory[]>(`/api/patients/${id}/vitals`);
}

export async function getMedications(id: string): Promise<MedicationsResponse> {
  return fetchAPI<MedicationsResponse>(`/api/patients/${id}/medications`);
}
