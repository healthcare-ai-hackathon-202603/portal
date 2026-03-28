# Project Brief: HealthSync — AI-Powered FHIR Patient Companion

## 1. Project Objective
This product is the patient's primary point of contact with their healthcare community. Its purpose is to accelerate access to the most appropriate care — people, information, and services — while fostering communication and building trust between patients and their circle of healthcare providers.
The product is designed to reduce the cognitive load of managing one's health and navigating the healthcare system, for both patients and care teams.
Patient needs can be broadly grouped into three modes:

**Symptom resolution** — "I have symptoms. What should I do, and can I stop worrying?" The patient wants a clear, reassuring path to the right care without having to figure out the system themselves.
**Ongoing management** — "I'm managing a health condition. Help me stay on top of appointments, prescriptions, activities, symptoms, and tests without letting it take over my life."
**Proactive wellness** — "I want to protect my health. Keep me focused on evidence-based habits and preventive care."

## Human-Centered UX Design
The interface is built on the principle of progressive disclosure — information surfaces only when it's relevant, keeping the experience calm and focused rather than overwhelming.
Users can navigate both through conversational AI chat and traditional structured navigation, allowing each person to engage in the way that feels most natural to them.
Home Screen
When a patient opens the application, they are presented with a minimal, purposeful home view containing three primary elements:
### 1. Action List
A prioritized list of things the patient needs to do — monitoring symptom progression, completing treatment steps, tracking health activities, and so on.

- Actions can be created automatically from provider treatment plans or initiated by the patient themselves.
- Tapping an action shifts focus to it: the view expands to surface relevant context, details, and tools needed to complete it.
- Tapping the list itself opens a management view where the patient can review, prioritize, and organize all current actions.

### 2. Event List
A timeline of upcoming and recent engagements with the healthcare system — appointments, prescription pickups, lab tests, referrals, and similar touchpoints.

- Events are automatically created and synchronized from provider scheduling systems and prescription records.
- Tapping an event surfaces the context and tools most relevant to the patient for that specific engagement.
- Tapping the list opens a full management view for reviewing and organizing upcoming events.

### 3. Persistent Chat
An always-available conversational interface for navigating and managing healthcare needs interactively.

- The chat is context-aware, reflecting whatever the patient is currently focused on — whether a specific action, event, or the home view.
- The chat proactively and transparently prompts the patient before sharing any information with the healthcare system or storing it locally, maintaining clear boundaries around data and consent.

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
