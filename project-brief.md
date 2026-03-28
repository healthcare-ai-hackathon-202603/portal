# Project Brief: HealthSync — AI-Powered FHIR Patient Companion

## 1. Project Objective
To build a FHIR-native patient portal that transforms raw clinical data into a proactive health management tool. The platform will provide patients with a longitudinal view of their progress, medication safety alerts, and an intelligent chat interface powered by the UVic Healthcare AI dataset.

## 2. Core Feature Set
*   **Health Progress Dashboard:** Time-series visualization of vitals (BP, Heart Rate) and lab trends (HbA1c, Cholesterol) with interpretation of abnormal flags.
*   **Proactive Action Center:** Automated "to-do" lists for medication renewals (based on `active` status and `end_date`) and clinical follow-ups.
*   **Clinical Event Timeline:** A merged, chronological feed of all encounters, lab results, and medication changes.
*   **Smart RX Scheduler:** A detailed medication regimen view extracted from `dosage` and `frequency` data.
*   **AI Health Assistant:** A RAG-powered (Retrieval-Augmented Generation) chat interface that answers questions about specific patient history, drug-drug interactions, and dietary precautions.

## 3. Technical Strategy
*   **Data Standard:** **FHIR R4**. All internal data models map to FHIR resources (`Patient`, `Encounter`, `Observation`, `MedicationRequest`).
*   **Logic Engine:** 
    *   **Temporal Joins:** Correlate medication start dates with subsequent symptom reports (`chief_complaint`) to detect potential side effects.
    *   **Inference Engine:** Use `drug_class` to trigger dietary and safety warnings (e.g., Statins + Grapefruit).
*   **Data Source:** UVic Hackathon Synthetic Dataset (Synthea-based BC patient records).

## 4. Key Development Tracks

### Track 1: FHIR Data Foundation
*   Implement CSV-to-FHIR mapping logic for the five core clinical files.
*   Develop a "Unified Patient Profile" generator that aggregates a single patient's history into a JSON context object.

### Track 2: Clinical Analytics & Trends
*   Build the dashboard logic to calculate treatment efficacy (e.g., % drop in BP after starting Amlodipine).
*   Implement the `abnormal_flag` alerting system for the progress dashboard.

### Track 3: Safety & Interaction Intelligence
*   Map `drug_class` to a library of common dietary and side-effect interactions.
*   Develop the "Side Effect Detector" by monitoring for new symptoms reported shortly after a new prescription.

### Track 4: Intelligent Interface & Chat
*   Design the patient-facing UI (Dashboard, Timeline, Action List).
*   Integrate the LLM chat interface using the "Unified Patient Profile" as grounding context for all queries.

## 5. Success Metrics
1.  **Contextual Accuracy:** AI identifies specific drivers for treatment changes by referencing the Vitals and Labs data.
2.  **FHIR Compliance:** System can generate and export a valid FHIR Bundle for any patient.
3.  **Safety Validation:** Successfully flags a known class-based side effect (e.g., a "dry cough" appearing after starting an ACE Inhibitor).
