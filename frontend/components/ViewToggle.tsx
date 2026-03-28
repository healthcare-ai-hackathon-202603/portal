"use client";

import Link from "next/link";

interface ViewToggleProps {
  currentView: "patient" | "clinician";
  patientId: string;
}

export default function ViewToggle({ currentView, patientId }: ViewToggleProps) {
  return (
    <div className="view-toggle">
      <Link
        href={`/patient/${patientId}`}
        className={`view-toggle-btn no-underline ${currentView === "patient" ? "active" : ""}`}
      >
        Patient View
      </Link>
      <Link
        href={`/dashboard?patient=${patientId}`}
        className={`view-toggle-btn no-underline ${currentView === "clinician" ? "active" : ""}`}
      >
        Clinician View
      </Link>
    </div>
  );
}
