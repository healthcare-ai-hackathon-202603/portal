# HealthForge — Product Specification

---

## Overview

HealthForge is a clinical intelligence platform designed to reduce cognitive load for both patients and clinicians. All views are issue-driven: the core data unit is the **diagnosis** pulled from `encounters.csv {diagnosis}`. Every metric, action, and recommendation surfaces in context of the patient's active issues and session history.

The guiding principle is **progressive disclosure** — the minimal relevant view is shown by default, with the ability to expand into deeper detail at every layer.

---

## Patient View

### Layout: Three-Column Structure

| Left Bar | Center | Right Bar |
|---|---|---|
| Metrics / Risk Score | Action Tasks (HealthPulse Cards) | Calendar |

Emergency indicators are **always visible** regardless of disclosure state.

---

### Left Bar — Metrics & Risk Score

- Displays a **risk score** derived from the patient's history and active issues, giving an at-a-glance signal of overall health status (good / watch / at-risk).
- Key metrics rendered are **context-sensitive**: shown based on relevance to the patient's current issues and session history.
  - Example: A patient reporting severe headaches → blood pressure surfaced as a priority metric.
  - If the current view does not include a relevant metric, it is **dynamically rendered** based on chat input or issue context.
- A dropdown allows the patient to view additional metrics beyond those automatically surfaced.
- Compact metric cards default to a summary value; expanding a card shows a **graph over time**.

---

### Center — Action Tasks (HealthPulse Cards)

- Action items presented as **HealthPulse cards**, prioritized by urgency and relevance to the current session.
- Cards can include: recommended next steps, clinic/provider suggestions, referral routing, and follow-up reminders.
- **Decision Tree for Action Routing:**

  1. **Knowledge of the patient & situation** — history, active diagnoses, current symptoms
  2. **Urgency of the issue** — severity determines routing (self-care → GP → specialist → ER)
  3. **Availability of local providers** — agents pull real-time data on nearby ERs, clinics, and specialists
     - Physiotherapists (no referral required): route directly
     - Specialists requiring referral: route to GP first, then automate referral workflow
     - Previous practitioners: identify and automate information transfer requests

- Automation scope: find provider → check availability → map route → book appointment → send relevant records.

---

### Right Bar — Calendar

- Upcoming appointments linked to active issues.
- Suggested appointment slots surfaced from the action routing agent.
- Quick-add and rescheduling actions.

---

### Issue Panel — Left Section

- **Active Issues List**: ordered by urgency / severity.
- Visual cue to expand **prior issues** below the active list.
- Selecting an issue shifts UI focus to that issue across all three columns.

#### Issue Summary View (collapsed)
- Diagnosis label
- Key medications
- Symptoms to track
- Recent test results
- Next appointment

#### Issue Expanded View
- Full detail on each summary metric
- Historical trend data
- Related HealthPulse action cards

---

### Chatbot

- **Entry point**: bubble in the bottom-right corner; opens as a popup overlay.
- **Dynamic rendering**: if the patient describes a symptom or concern in chat, the agent analyzes the input and **re-renders the metrics view** to surface the most relevant indicators.
  - Example: Patient types "I've had a severe headache for two days" → blood pressure, hydration notes, and recent medication history are foregrounded.
- Uses **Tavily** for real-time web search where applicable (e.g., pulling current clinic availability, drug interaction lookups).
- Recommends action steps and can trigger the end-to-end provider routing workflow directly from the chat.

---

## Clinician View

### Summary Sections

Clinicians see patient summaries scoped to the current session's relevant data:

- **Urgency classification** per patient:
  - 🔴 Need to see **now** (urgent)
  - 🟡 Need to see in **X days**
  - 🟢 Can see in **X months**

- Summary panels pulled from relevant history: active diagnoses, recent labs, medication changes, outstanding referrals.

### Issue-Driven Layout

- Same issue-centric data model as the patient view, surfaced with clinical detail.
- Expandable issue cards showing full diagnostic context, test history, and prior encounter notes.
- Metrics and action items scoped to clinician workflow: ordering tests, updating medications, triggering referrals.

---

## Agent Architecture

All agents operate on the decision tree above. Key agents:

| Agent | Responsibility |
|---|---|
| **Triage Agent** | Assess urgency from symptom input + patient history |
| **Provider Routing Agent** | Find local ERs, clinics, specialists; check availability; map route |
| **Referral Automation Agent** | Determine if referral is needed; route to GP or specialist accordingly |
| **Records Transfer Agent** | Identify prior practitioners; automate information transfer requests |
| **Metric Relevance Agent** | Dynamically surface metrics based on current issue or chat input |

Agents use **Tavily** for real-time external data retrieval (clinic availability, provider directories, routing).

---

## Data Model

- **Core entity**: Issue = `{diagnosis}` from `encounters.csv`
- All views, metrics, and actions derive from the patient's issue set.
- Metric relevance rules are conditioned on:
  - Active diagnoses
  - Symptom history
  - Current session context (chat input, selected issue)

---

## Design Principles

1. **Progressive disclosure** — minimal view first; depth on demand.
2. **Issue-driven rendering** — every element traces back to a diagnosis.
3. **Reduced cognitive load** — right metric, right place, right time.
4. **Emergency always visible** — urgency indicators never hidden behind disclosure.
5. **End-to-end automation** — recommendations connect directly to action; patients are routed, not just advised.