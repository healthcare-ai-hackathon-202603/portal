# Patient View Redesign + Chat Widget + Smart RX Scheduler

**Date:** 2026-03-28
**Status:** Approved

## Overview

Three coordinated changes to the patient-facing experience:
1. Restructure the patient page from a data dump into a priority-ordered, contextual layout
2. Add a floating AI health assistant chat widget backed by the existing `chat.py`
3. Add a Smart RX Scheduler showing medications by time-of-day slots

## 1. Patient Page Redesign

### Information Hierarchy

Single-column layout, sections ordered by priority:

1. **Patient Header** — name, age, language, compact demographics (existing, keep as-is)
2. **Contextual Hero** — dynamically selects lead content:
   - If urgent/warning actions exist → render **Action Center** as hero
   - If no urgent actions → render **Health Snapshot** as hero
3. **Health Snapshot** (if not hero) — compact metric cards for non-stable lab/vital trends only. Stable metrics are hidden entirely. Each card shows: metric name, latest value, trend direction (arrow + label: worsening/improving/spiking), and change percentage.
4. **Smart RX Scheduler** — time-of-day medication grid (see Section 3)
5. **Active Medications** — simplified list: drug name, dosage, purpose. Expandable rows for clinical details (prescriber, dates, route, DIN).
6. **Timeline** — collapsed by default. Shows last 5 encounters with facility color dots. "Show all" expands full list.

### Action Center

Derived from existing alert/session-delta data. Each item is an actionable to-do with a clear verb:

| Source Data | Action Item |
|-------------|-------------|
| Care gap (overdue test) | "Book your HbA1c test — overdue by X months" |
| Expiring medication | "Your [drug] prescription expires in X days — contact your pharmacy" |
| Temporal correlation | "Talk to your doctor about [symptom] — it may be related to [medication]" |
| Abnormal lab (spiking) | "Your [metric] has changed significantly — discuss with your provider" |

Items sorted by severity: urgent first, then warning, then info.

### Health Snapshot

Only non-stable trends are shown. Each metric rendered as a compact card:
- Metric name (patient-friendly, from templates.py)
- Latest value + unit
- Trend arrow: up-right for worsening, down-right for improving, lightning bolt for spiking
- Change percentage
- Status badge (urgent/warning/healthy)

If all metrics are stable, show a single "All stable" reassurance message.

### Medications Section

Simplified from current MedList:
- Default view: drug name, dosage, frequency, purpose (one line per med)
- Expand row for: prescriber, start/end dates, route, drug code
- No hover tooltips — use expandable rows instead (better mobile support)

### Timeline Section

- Collapsed by default with encounter count badge: "12 visits"
- Expanded: reverse-chronological list, facility color dots, chief complaint, diagnosis
- Initially shows 5, "Show all" loads rest
- De-emphasized visually (lighter text, smaller font than sections above)

## 2. Chat Widget

### UI

**Trigger:** Floating button, bottom-right corner, pill-shaped. Subtle pulse animation on first load (2 cycles), then static. Contains health assistant icon + "Ask" label.

**Panel:** Overlay anchored bottom-right, 400px wide x 500px tall. Components:
- Header bar: "Health Assistant" title + close (X) button
- Message area: scrollable, auto-scrolls to latest message
- Messages styled as bubbles (user right-aligned, assistant left-aligned)
- Pre-loaded welcome message with 2-3 suggested question buttons
- Input area: text field + send button, disabled while awaiting response
- Loading indicator (typing dots) while waiting for API response

**Behavior:**
- Conversation state held in React useState (no localStorage per CLAUDE.md)
- Resets on page reload
- Suggested questions rendered as clickable buttons after each assistant response
- Panel can be closed and reopened without losing conversation (within same page session)

### Backend Endpoint

`POST /api/patients/{patient_id}/chat`

**Request body:**
```json
{
  "message": "string",
  "history": [{"role": "user"|"assistant", "content": "string"}]
}
```

**Response:**
```json
{
  "response": "string",
  "suggested_questions": ["string", "string", "string"]
}
```

Wires directly to existing `chat.py`:
- `HealthAssistantChat` class already handles context building, rate limiting, system prompt
- Uses Claude Haiku 4.5, 500 max_tokens
- Rate limit: 10 requests per 60 seconds per patient (already implemented)
- System prompt enforces: no diagnoses, plain language, suggests follow-up questions

**New code needed:**
- Add Pydantic models: `ChatRequest`, `ChatResponse` to `models.py`
- Add `POST /api/patients/{patient_id}/chat` route to `main.py`
- Instantiate `HealthAssistantChat` in main.py and call `chat()` method
- Add `ANTHROPIC_API_KEY` env var handling

## 3. Smart RX Scheduler

### Frequency Parsing

Map medication `frequency` field to time-of-day slots:

| Frequency Pattern | Slots |
|-------------------|-------|
| "once daily", "daily", "QD" | Morning |
| "twice daily", "BID" | Morning, Evening |
| "three times daily", "TID" | Morning, Midday, Evening |
| "four times daily", "QID" | Morning, Midday, Evening, Bedtime |
| "at bedtime", "QHS" | Bedtime |
| "every morning" | Morning |
| "as needed", "PRN" | Separate "as needed" section |
| Unrecognized | "As directed" note, no slot |

Parsing is case-insensitive substring matching. Done on the frontend from medication data already fetched.

### Visual Design

4-column grid layout:
- **Morning** (6-11am) — sunrise icon
- **Midday** (11am-5pm) — sun icon
- **Evening** (5-10pm) — moon icon
- **Bedtime** (10pm+) — sleep icon

Each slot contains medication pills showing: drug name + dosage. Empty slots show "No medications" in muted text.

Separate "As Needed" row below the grid for PRN medications.

Compact card that fits between Health Snapshot and the full Medications list.

## Files to Create/Modify

### New Files
- `frontend/components/ChatWidget.tsx` — floating button + chat panel
- `frontend/components/RxScheduler.tsx` — time-of-day medication grid
- `frontend/components/HealthSnapshot.tsx` — compact non-stable metric cards

### Modified Files
- `frontend/app/patient/[id]/page.tsx` — restructure layout, integrate new components
- `frontend/components/ActionCenter.tsx` — refine to match new action item format (file exists but may need rework)
- `frontend/components/MedList.tsx` — simplify to expandable rows
- `frontend/components/HealthTimeline.tsx` — add collapsed-by-default behavior
- `frontend/app/globals.css` — styles for chat widget, RX scheduler, snapshot cards
- `frontend/lib/types.ts` — add ChatMessage, ChatResponse types
- `frontend/lib/api.ts` — add sendChatMessage function
- `backend/main.py` — add POST /api/patients/{id}/chat endpoint
- `backend/models.py` — add ChatRequest, ChatResponse models

## Non-Goals

- No localStorage or persistent chat history
- No medication tracking/reminders (just a visual schedule)
- No theme changes (keep existing dark theme)
- No mobile-specific responsive layout (can be added later)
- No authentication or user accounts
