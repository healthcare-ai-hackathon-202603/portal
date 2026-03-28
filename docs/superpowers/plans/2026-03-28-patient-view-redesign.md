# Patient View Redesign + Chat Widget + RX Scheduler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the patient page into a priority-ordered contextual layout, add a floating AI chat widget backed by Claude, and add a Smart RX Scheduler showing medications by time-of-day.

**Architecture:** Three independent feature streams that converge on the patient page. Backend gets one new POST endpoint for chat. Frontend gets three new components (HealthSnapshot, ChatWidget, RxScheduler) and a rewritten patient page layout. ActionCenter and HealthTimeline get behavior updates.

**Tech Stack:** Next.js 16 + React 19 + Tailwind 4, Python/FastAPI, Anthropic Claude Haiku 4.5

---

### Task 1: Add Chat Models to Backend

**Files:**
- Modify: `backend/models.py` (add after line 198)

- [ ] **Step 1: Add ChatMessage, ChatRequest, ChatResponse models to `backend/models.py`**

Add the following after the `PatientSummary` class at the end of `backend/models.py`:

```python
# --- Chat models ---

class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    conversation_history: list[ChatMessage] = []


class ChatResponse(BaseModel):
    response: str
    suggested_questions: list[str] = []
```

- [ ] **Step 2: Verify the backend still starts**

Run: `cd /Users/markaxelus/Documents/_Code_Projects/portal && python -c "from backend.models import ChatMessage, ChatRequest, ChatResponse; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/models.py
git commit -m "feat: add ChatMessage, ChatRequest, ChatResponse models"
```

---

### Task 2: Wire Chat Endpoint in FastAPI

**Files:**
- Modify: `backend/main.py` (add import + endpoint)

- [ ] **Step 1: Add chat import to `backend/main.py`**

Add to the imports section (after line 36):

```python
from .chat import handle_patient_chat
from .models import ChatRequest, ChatResponse
```

Note: `ChatResponse` is already importable but not yet imported in main.py. `ChatRequest` needs to be added to the import from `.models` block OR imported separately. Since main.py already imports specific models from `.models`, add `ChatRequest` and `ChatResponse` to a new import line to keep it clean.

Actually, looking at the existing imports more carefully — main.py imports models individually on lines 21-28. Add `ChatRequest` and `ChatResponse` to that import block:

In `backend/main.py`, change the models import block (lines 21-28) from:

```python
from .models import (
    Encounter,
    LabTrajectory,
    MedicationAlerts,
    Patient,
    PatientListItem,
    PatientSummary,
    SessionDelta,
)
```

to:

```python
from .models import (
    ChatRequest,
    ChatResponse,
    Encounter,
    LabTrajectory,
    MedicationAlerts,
    Patient,
    PatientListItem,
    PatientSummary,
    SessionDelta,
)
```

And add after line 36:

```python
from .chat import handle_patient_chat
```

- [ ] **Step 2: Add the POST /api/patients/{patient_id}/chat endpoint**

Add before the `# Run config` section (before line 184):

```python
@app.post("/api/patients/{patient_id}/chat", response_model=ChatResponse)
async def chat_with_patient(patient_id: str, request: ChatRequest):
    """Patient-facing AI health assistant chat."""
    _require_patient(patient_id)
    return handle_patient_chat(patient_id, request)
```

- [ ] **Step 3: Verify the backend starts and the endpoint is registered**

Run: `cd /Users/markaxelus/Documents/_Code_Projects/portal && python -c "from backend.main import app; routes = [r.path for r in app.routes]; assert '/api/patients/{patient_id}/chat' in routes; print('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/main.py
git commit -m "feat: add POST /api/patients/{id}/chat endpoint"
```

---

### Task 3: Add Frontend Chat Types and API Function

**Files:**
- Modify: `frontend/lib/types.ts` (add after line 163)
- Modify: `frontend/lib/api.ts` (add function)

- [ ] **Step 1: Add chat types to `frontend/lib/types.ts`**

Add after the `MedicationsResponse` interface (after line 167):

```typescript
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  response: string;
  suggested_questions: string[];
}
```

- [ ] **Step 2: Add `sendChatMessage` to `frontend/lib/api.ts`**

Add the import of the new types to the existing import block (line 11-19). Add `ChatMessage` and `ChatResponse` to the import:

```typescript
import type {
  PatientListItem,
  Patient,
  PatientSummary,
  SessionDelta,
  Encounter,
  LabTrajectory,
  VitalTrajectory,
  MedicationsResponse,
  ChatMessage,
  ChatResponse,
} from "./types";
```

Add at the end of the file:

```typescript
export async function sendChatMessage(
  patientId: string,
  message: string,
  history: ChatMessage[]
): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/api/patients/${patientId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, conversation_history: history }),
  });
  if (!res.ok) {
    throw new Error(`Chat error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/types.ts frontend/lib/api.ts
git commit -m "feat: add chat types and sendChatMessage API function"
```

---

### Task 4: Create HealthSnapshot Component

**Files:**
- Create: `frontend/components/HealthSnapshot.tsx`

This component shows only non-stable lab/vital trends as compact metric cards.

- [ ] **Step 1: Create `frontend/components/HealthSnapshot.tsx`**

```tsx
"use client";

import type { LabTrajectory, VitalTrajectory } from "@/lib/types";

interface HealthSnapshotProps {
  labTrajectories: LabTrajectory[];
  vitalTrajectories: VitalTrajectory[];
}

const FRIENDLY_NAMES: Record<string, string> = {
  HbA1c: "Blood Sugar (Long-Term)",
  "Fasting Glucose": "Fasting Blood Sugar",
  "Total Cholesterol": "Cholesterol",
  LDL: "Bad Cholesterol (LDL)",
  HDL: "Good Cholesterol (HDL)",
  Creatinine: "Kidney Function",
  TSH: "Thyroid Levels",
  Potassium: "Potassium",
  Sodium: "Sodium",
  INR: "Blood Clotting (INR)",
  "Systolic BP": "Blood Pressure (Top)",
  "Diastolic BP": "Blood Pressure (Bottom)",
  "Heart Rate": "Heart Rate",
  "O2 Saturation": "Oxygen Level",
};

const trendConfig = {
  spiking: {
    label: "Spiking",
    color: "var(--color-spiking)",
    bgColor: "rgba(248, 113, 113, 0.08)",
    borderColor: "rgba(248, 113, 113, 0.25)",
    icon: "\u26A1", // lightning
  },
  worsening: {
    label: "Worsening",
    color: "var(--color-worsening)",
    bgColor: "rgba(251, 191, 36, 0.08)",
    borderColor: "rgba(251, 191, 36, 0.25)",
    icon: "\u2197", // arrow up-right
  },
  improving: {
    label: "Improving",
    color: "var(--color-improving)",
    bgColor: "rgba(52, 211, 153, 0.08)",
    borderColor: "rgba(52, 211, 153, 0.25)",
    icon: "\u2198", // arrow down-right
  },
  stable: {
    label: "Stable",
    color: "var(--color-stable)",
    bgColor: "rgba(96, 165, 250, 0.08)",
    borderColor: "rgba(96, 165, 250, 0.25)",
    icon: "\u2192", // arrow right
  },
};

export default function HealthSnapshot({
  labTrajectories,
  vitalTrajectories,
}: HealthSnapshotProps) {
  // Filter to non-stable only
  const nonStableLabs = labTrajectories.filter((l) => l.trend !== "stable");
  const nonStableVitals = vitalTrajectories.filter((v) => v.trend !== "stable");

  if (nonStableLabs.length === 0 && nonStableVitals.length === 0) {
    return (
      <section>
        <h2
          className="text-sm font-semibold tracking-wide mb-4"
          style={{ color: "var(--text-secondary)" }}
        >
          Health Snapshot
        </h2>
        <div
          className="card p-6 flex items-center gap-4"
          style={{
            borderColor: "rgba(52, 211, 153, 0.2)",
            background: "rgba(52, 211, 153, 0.03)",
          }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: "rgba(52, 211, 153, 0.1)",
              color: "var(--color-healthy)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M5 9L7.5 11.5L13 6.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="9" cy="9" r="7.5" stroke="currentColor" strokeWidth="1.3" />
            </svg>
          </div>
          <div>
            <p
              className="text-sm font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              All metrics stable
            </p>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--text-secondary)" }}
            >
              No significant changes in your recent lab results or vitals.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2
        className="text-sm font-semibold tracking-wide mb-4"
        style={{ color: "var(--text-secondary)" }}
      >
        Health Snapshot
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 stagger">
        {nonStableLabs.map((lab) => {
          const config = trendConfig[lab.trend];
          const friendly = FRIENDLY_NAMES[lab.test_name] || lab.test_name;
          return (
            <div
              key={lab.test_name}
              className="rounded-2xl p-4"
              style={{
                background: config.bgColor,
                border: `1px solid ${config.borderColor}`,
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-xs font-medium"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {friendly}
                </span>
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    color: config.color,
                    background: `${config.bgColor}`,
                    border: `1px solid ${config.borderColor}`,
                  }}
                >
                  {config.icon} {config.label}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span
                  className="text-xl font-bold font-mono"
                  style={{ color: "var(--text-primary)" }}
                >
                  {lab.latest_value}
                </span>
                <span
                  className="text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  {lab.unit}
                </span>
              </div>
              <p
                className="text-xs mt-1"
                style={{ color: "var(--text-muted)" }}
              >
                {lab.change_percent > 0 ? "+" : ""}
                {lab.change_percent.toFixed(0)}% from baseline &middot; Normal:{" "}
                {lab.reference_range_low}&ndash;{lab.reference_range_high}
              </p>
            </div>
          );
        })}
        {nonStableVitals.map((vital) => {
          const config = trendConfig[vital.trend];
          const friendly = FRIENDLY_NAMES[vital.vital_name] || vital.vital_name;
          return (
            <div
              key={vital.vital_name}
              className="rounded-2xl p-4"
              style={{
                background: config.bgColor,
                border: `1px solid ${config.borderColor}`,
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-xs font-medium"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {friendly}
                </span>
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    color: config.color,
                    background: `${config.bgColor}`,
                    border: `1px solid ${config.borderColor}`,
                  }}
                >
                  {config.icon} {config.label}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span
                  className="text-xl font-bold font-mono"
                  style={{ color: "var(--text-primary)" }}
                >
                  {vital.latest_value}
                </span>
                <span
                  className="text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  {vital.unit}
                </span>
              </div>
              <p
                className="text-xs mt-1"
                style={{ color: "var(--text-muted)" }}
              >
                Normal: {vital.normal_range}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/HealthSnapshot.tsx
git commit -m "feat: add HealthSnapshot component for non-stable metric cards"
```

---

### Task 5: Create RxScheduler Component

**Files:**
- Create: `frontend/components/RxScheduler.tsx`

- [ ] **Step 1: Create `frontend/components/RxScheduler.tsx`**

```tsx
"use client";

import type { PatientMedication } from "@/lib/types";

interface RxSchedulerProps {
  medications: PatientMedication[];
}

type TimeSlot = "morning" | "midday" | "evening" | "bedtime";

interface SlotConfig {
  label: string;
  time: string;
  icon: string;
}

const SLOTS: Record<TimeSlot, SlotConfig> = {
  morning: { label: "Morning", time: "6\u201311 AM", icon: "\uD83C\uDF05" },
  midday: { label: "Midday", time: "11 AM\u20135 PM", icon: "\u2600\uFE0F" },
  evening: { label: "Evening", time: "5\u201310 PM", icon: "\uD83C\uDF19" },
  bedtime: { label: "Bedtime", time: "10 PM+", icon: "\uD83D\uDCA4" },
};

function parseFrequencyToSlots(frequency: string): TimeSlot[] {
  const f = frequency.toLowerCase().trim();

  if (/\bat\s*bedtime\b|qhs/i.test(f)) return ["bedtime"];
  if (/\bevery\s*morning\b/i.test(f)) return ["morning"];
  if (/four\s*times\s*daily|qid|4\s*times/i.test(f))
    return ["morning", "midday", "evening", "bedtime"];
  if (/three\s*times\s*daily|tid|3\s*times/i.test(f))
    return ["morning", "midday", "evening"];
  if (/twice\s*daily|bid|2\s*times|two\s*times/i.test(f))
    return ["morning", "evening"];
  if (/once\s*daily|daily|qd|1\s*time/i.test(f)) return ["morning"];
  if (/as\s*needed|prn/i.test(f)) return [];

  // Default: morning for unrecognized patterns
  return ["morning"];
}

interface MedInSlot {
  name: string;
  dosage: string;
}

export default function RxScheduler({ medications }: RxSchedulerProps) {
  const activeMeds = medications.filter((m) => m.active);
  if (activeMeds.length === 0) return null;

  // Build slot assignments
  const slotMap: Record<TimeSlot, MedInSlot[]> = {
    morning: [],
    midday: [],
    evening: [],
    bedtime: [],
  };
  const prnMeds: MedInSlot[] = [];

  for (const med of activeMeds) {
    const slots = parseFrequencyToSlots(med.frequency);
    if (slots.length === 0) {
      prnMeds.push({ name: med.name, dosage: med.dosage });
    } else {
      for (const slot of slots) {
        slotMap[slot].push({ name: med.name, dosage: med.dosage });
      }
    }
  }

  return (
    <section>
      <h2
        className="text-sm font-semibold tracking-wide mb-4"
        style={{ color: "var(--text-secondary)" }}
      >
        Daily Medication Schedule
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(Object.keys(SLOTS) as TimeSlot[]).map((slot) => {
          const config = SLOTS[slot];
          const meds = slotMap[slot];
          return (
            <div
              key={slot}
              className="rounded-2xl p-4"
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{config.icon}</span>
                <div>
                  <p
                    className="text-xs font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {config.label}
                  </p>
                  <p
                    className="text-[10px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {config.time}
                  </p>
                </div>
              </div>
              {meds.length === 0 ? (
                <p
                  className="text-xs italic"
                  style={{ color: "var(--text-muted)" }}
                >
                  No medications
                </p>
              ) : (
                <div className="space-y-2">
                  {meds.map((med, i) => (
                    <div
                      key={`${med.name}-${i}`}
                      className="rounded-lg px-3 py-2"
                      style={{
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      <p
                        className="text-xs font-medium leading-tight"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {med.name}
                      </p>
                      <p
                        className="text-[10px] mt-0.5"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {med.dosage}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {prnMeds.length > 0 && (
        <div
          className="mt-3 rounded-2xl p-4"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <p
            className="text-xs font-semibold mb-2"
            style={{ color: "var(--text-secondary)" }}
          >
            As Needed
          </p>
          <div className="flex flex-wrap gap-2">
            {prnMeds.map((med, i) => (
              <span
                key={`${med.name}-${i}`}
                className="text-xs px-3 py-1.5 rounded-lg"
                style={{
                  background: "var(--bg-elevated)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                {med.name} {med.dosage}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/RxScheduler.tsx
git commit -m "feat: add RxScheduler component with time-of-day medication grid"
```

---

### Task 6: Create ChatWidget Component

**Files:**
- Create: `frontend/components/ChatWidget.tsx`
- Modify: `frontend/app/globals.css` (add chat styles)

- [ ] **Step 1: Create `frontend/components/ChatWidget.tsx`**

```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { sendChatMessage } from "@/lib/api";
import type { ChatMessage } from "@/lib/types";

interface ChatWidgetProps {
  patientId: string;
  patientName: string;
}

export default function ChatWidget({ patientId, patientName }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([
    "What do my recent lab results mean?",
    "What medications am I currently taking?",
    "Do I have any overdue health checks?",
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSend = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setSuggestedQuestions([]);

    try {
      const res = await sendChatMessage(patientId, text.trim(), messages);
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: res.response,
      };
      setMessages([...newMessages, assistantMsg]);
      setSuggestedQuestions(res.suggested_questions);
    } catch {
      const errorMsg: ChatMessage = {
        role: "assistant",
        content:
          "I'm having trouble connecting right now. Please try again in a moment.",
      };
      setMessages([...newMessages, errorMsg]);
      setSuggestedQuestions([
        "What do my recent lab results mean?",
        "What medications am I currently taking?",
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="chat-fab"
          aria-label="Open health assistant"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M3 5C3 3.89543 3.89543 3 5 3H15C16.1046 3 17 3.89543 17 5V12C17 13.1046 16.1046 14 15 14H11L7 17V14H5C3.89543 14 3 13.1046 3 12V5Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M7 7.5H13M7 10H11"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <span className="text-sm font-medium">Ask</span>
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div className="chat-panel">
          {/* Header */}
          <div className="chat-panel-header">
            <div>
              <h3
                className="text-sm font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                Health Assistant
              </h3>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                For {patientName}
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
              }}
              aria-label="Close chat"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M3 3L11 11M3 11L11 3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="px-4 py-6 text-center">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3"
                  style={{
                    background: "rgba(110, 207, 255, 0.1)",
                    color: "var(--text-accent)",
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path
                      d="M3 5C3 3.89543 3.89543 3 5 3H15C16.1046 3 17 3.89543 17 5V12C17 13.1046 16.1046 14 15 14H11L7 17V14H5C3.89543 14 3 13.1046 3 12V5Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <p
                  className="text-sm font-medium mb-1"
                  style={{ color: "var(--text-primary)" }}
                >
                  Hi! I&apos;m your Health Assistant.
                </p>
                <p
                  className="text-xs"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Ask me about your lab results, medications, or upcoming health checks.
                </p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`chat-bubble ${msg.role === "user" ? "chat-bubble-user" : "chat-bubble-assistant"}`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {msg.content}
                </p>
              </div>
            ))}

            {loading && (
              <div className="chat-bubble chat-bubble-assistant">
                <div className="flex gap-1.5">
                  <span className="chat-typing-dot" />
                  <span
                    className="chat-typing-dot"
                    style={{ animationDelay: "0.15s" }}
                  />
                  <span
                    className="chat-typing-dot"
                    style={{ animationDelay: "0.3s" }}
                  />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggested questions */}
          {suggestedQuestions.length > 0 && !loading && (
            <div className="chat-suggestions">
              {suggestedQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(q)}
                  className="chat-suggestion-btn"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="chat-input-area">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(input);
                }
              }}
              placeholder="Ask about your health..."
              disabled={loading}
              className="chat-input"
            />
            <button
              onClick={() => handleSend(input)}
              disabled={!input.trim() || loading}
              className="chat-send-btn"
              aria-label="Send message"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M14 2L7 9M14 2L9.5 14L7 9M14 2L2 6.5L7 9"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Add chat styles to `frontend/app/globals.css`**

Add at the end of the file (after line 248):

```css
/* Chat widget */
.chat-fab {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border-radius: 999px;
  border: 1px solid var(--border-default);
  background: var(--bg-elevated);
  color: var(--text-accent);
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  animation: fadeInUp 0.5s ease forwards;
}
.chat-fab:hover {
  background: var(--bg-surface);
  border-color: var(--border-focus);
  box-shadow: 0 4px 24px rgba(110, 207, 255, 0.15);
}

.chat-panel {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 50;
  width: 400px;
  max-height: 520px;
  display: flex;
  flex-direction: column;
  border-radius: 20px;
  border: 1px solid var(--border-default);
  background: var(--bg-primary);
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
  animation: fadeInUp 0.3s ease forwards;
  overflow: hidden;
}

.chat-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-secondary);
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 200px;
  max-height: 320px;
}

.chat-bubble {
  max-width: 85%;
  padding: 10px 14px;
  border-radius: 16px;
}
.chat-bubble-user {
  align-self: flex-end;
  background: rgba(110, 207, 255, 0.12);
  color: var(--text-primary);
  border-bottom-right-radius: 4px;
}
.chat-bubble-assistant {
  align-self: flex-start;
  background: var(--bg-secondary);
  color: var(--text-primary);
  border-bottom-left-radius: 4px;
  border: 1px solid var(--border-subtle);
}

.chat-typing-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-muted);
  animation: pulse-soft 1s ease-in-out infinite;
}

.chat-suggestions {
  padding: 8px 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  border-top: 1px solid var(--border-subtle);
}

.chat-suggestion-btn {
  font-size: 11px;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--border-default);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}
.chat-suggestion-btn:hover {
  background: var(--bg-elevated);
  color: var(--text-accent);
  border-color: var(--border-focus);
}

.chat-input-area {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid var(--border-subtle);
  background: var(--bg-secondary);
}

.chat-input {
  flex: 1;
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s ease;
}
.chat-input:focus {
  border-color: var(--border-focus);
}
.chat-input::placeholder {
  color: var(--text-muted);
}
.chat-input:disabled {
  opacity: 0.5;
}

.chat-send-btn {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: none;
  background: rgba(110, 207, 255, 0.15);
  color: var(--text-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}
.chat-send-btn:hover:not(:disabled) {
  background: rgba(110, 207, 255, 0.25);
}
.chat-send-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

@media (max-width: 480px) {
  .chat-panel {
    width: calc(100vw - 32px);
    bottom: 16px;
    right: 16px;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/components/ChatWidget.tsx frontend/app/globals.css
git commit -m "feat: add ChatWidget floating panel with chat styles"
```

---

### Task 7: Rewrite Patient Page Layout

**Files:**
- Modify: `frontend/app/patient/[id]/page.tsx` (full rewrite of the content section)

This is the integration task. The patient page gets restructured to use the new priority-ordered layout with contextual hero.

- [ ] **Step 1: Rewrite `frontend/app/patient/[id]/page.tsx`**

Replace the entire file with the new layout that integrates all components:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  getPatientSummary,
  getTimeline,
  getLabTrajectories,
  getVitalTrajectories,
} from "@/lib/api";
import type {
  PatientSummary,
  Encounter,
  LabTrajectory,
  VitalTrajectory,
} from "@/lib/types";
import ViewToggle from "@/components/ViewToggle";
import ActionCenter from "@/components/ActionCenter";
import HealthSnapshot from "@/components/HealthSnapshot";
import RxScheduler from "@/components/RxScheduler";
import MedList from "@/components/MedList";
import HealthTimeline from "@/components/HealthTimeline";
import TrendChart from "@/components/TrendChart";
import ChatWidget from "@/components/ChatWidget";

type ExpandedSection = "medications" | "labs" | "vitals" | null;

export default function PatientPage() {
  const params = useParams<{ id: string }>();
  const patientId = params.id;

  const [summary, setSummary] = useState<PatientSummary | null>(null);
  const [timeline, setTimeline] = useState<Encounter[]>([]);
  const [labTrajectories, setLabTrajectories] = useState<LabTrajectory[]>([]);
  const [vitalTrajectories, setVitalTrajectories] = useState<VitalTrajectory[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<ExpandedSection>(null);

  useEffect(() => {
    if (!patientId) return;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const [summaryData, timelineData, labData, vitalData] =
          await Promise.all([
            getPatientSummary(patientId),
            getTimeline(patientId),
            getLabTrajectories(patientId).catch(() => [] as LabTrajectory[]),
            getVitalTrajectories(patientId).catch(
              () => [] as VitalTrajectory[]
            ),
          ]);
        setSummary(summaryData);
        setTimeline(timelineData);
        setLabTrajectories(labData);
        setVitalTrajectories(vitalData);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load patient data"
        );
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
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="var(--color-urgent)"
                strokeWidth="1.5"
              />
              <path
                d="M12 8V12"
                stroke="var(--color-urgent)"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <circle cx="12" cy="16" r="1" fill="var(--color-urgent)" />
            </svg>
          </div>
          <h2
            className="text-lg font-semibold mb-2"
            style={{ color: "var(--text-primary)" }}
          >
            Unable to Load Patient Data
          </h2>
          <p
            className="text-sm mb-6"
            style={{ color: "var(--text-secondary)" }}
          >
            {error || "Patient not found. Please check the ID and try again."}
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium no-underline"
            style={{ color: "var(--text-accent)" }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M10 13L5 8L10 3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Back to Home
          </Link>
        </div>
      </main>
    );
  }

  const { patient, alerts, active_medications } = summary;
  const hasUrgentActions =
    alerts &&
    alerts.some(
      (a) => a.severity === "urgent" || a.severity === "warning"
    );

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
                <path
                  d="M10 13L5 8L10 3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
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
              <p
                className="text-xs"
                style={{ color: "var(--text-secondary)" }}
              >
                {patient.age} years old &middot;{" "}
                {patient.sex === "M"
                  ? "Male"
                  : patient.sex === "F"
                    ? "Female"
                    : patient.sex}
                {patient.primary_language &&
                  patient.primary_language !== "English" && (
                    <> &middot; {patient.primary_language}</>
                  )}
              </p>
            </div>
          </div>
          <ViewToggle currentView="patient" patientId={patientId} />
        </div>
      </header>

      {/* Content — priority-ordered layout */}
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">
        {/* Contextual Hero: Action Center if urgent, otherwise Health Snapshot */}
        {hasUrgentActions ? (
          <>
            <div className="animate-fade-in-up">
              <ActionCenter
                alerts={alerts}
                medications={active_medications || []}
                labTrajectories={labTrajectories}
              />
            </div>
            <div
              className="animate-fade-in-up"
              style={{ animationDelay: "100ms" }}
            >
              <HealthSnapshot
                labTrajectories={labTrajectories}
                vitalTrajectories={vitalTrajectories}
              />
            </div>
          </>
        ) : (
          <>
            <div className="animate-fade-in-up">
              <HealthSnapshot
                labTrajectories={labTrajectories}
                vitalTrajectories={vitalTrajectories}
              />
            </div>
            {alerts && alerts.length > 0 && (
              <div
                className="animate-fade-in-up"
                style={{ animationDelay: "100ms" }}
              >
                <ActionCenter
                  alerts={alerts}
                  medications={active_medications || []}
                  labTrajectories={labTrajectories}
                />
              </div>
            )}
          </>
        )}

        {/* Smart RX Scheduler */}
        {active_medications && active_medications.length > 0 && (
          <div
            className="animate-fade-in-up"
            style={{ animationDelay: "200ms" }}
          >
            <RxScheduler medications={active_medications} />
          </div>
        )}

        {/* Expandable Details */}
        <div
          className="space-y-3 animate-fade-in-up"
          style={{ animationDelay: "300ms" }}
        >
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
                {labTrajectories.map((lab) => (
                  <div
                    key={lab.test_name}
                    className="card p-4 overflow-hidden"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4
                          className="text-sm font-medium"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {lab.test_name}
                        </h4>
                        <p
                          className="text-[11px]"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Normal: {lab.reference_range_low}
                          {lab.unit} - {lab.reference_range_high}
                          {lab.unit}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full badge-${lab.trend === "spiking" ? "urgent" : lab.trend === "worsening" ? "warning" : lab.trend === "improving" ? "healthy" : "info"}`}
                      >
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
                {vitalTrajectories.map((vital) => (
                  <div
                    key={vital.vital_name}
                    className="card p-4 overflow-hidden"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4
                          className="text-sm font-medium"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {vital.vital_name}
                        </h4>
                        <p
                          className="text-[11px]"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Normal: {vital.normal_range}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full badge-${vital.trend === "spiking" ? "urgent" : vital.trend === "worsening" ? "warning" : vital.trend === "improving" ? "healthy" : "info"}`}
                      >
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

        {/* Timeline — collapsed by default */}
        {timeline && timeline.length > 0 && (
          <div
            className="animate-fade-in-up"
            style={{ animationDelay: "400ms" }}
          >
            <HealthTimeline encounters={timeline} defaultCollapsed={true} />
          </div>
        )}

        {/* Footer */}
        <footer className="pt-8 pb-12 text-center">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            This summary is generated from your health records for your
            reference. Always consult your healthcare provider for medical
            advice.
          </p>
        </footer>
      </div>

      {/* Chat Widget */}
      <ChatWidget
        patientId={patientId}
        patientName={`${patient.first_name} ${patient.last_name}`}
      />
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
        {/* Action center skeleton */}
        <div>
          <div
            className="w-36 h-4 rounded mb-4 animate-pulse-soft"
            style={{ background: "var(--bg-surface)" }}
          />
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="card p-5 animate-pulse-soft"
                style={{ animationDelay: `${n * 100}ms` }}
              >
                <div className="flex items-start gap-4">
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

        {/* Snapshot skeleton */}
        <div>
          <div
            className="w-32 h-4 rounded mb-4 animate-pulse-soft"
            style={{ background: "var(--bg-surface)" }}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="rounded-2xl p-4 animate-pulse-soft"
                style={{
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  animationDelay: `${n * 80}ms`,
                }}
              >
                <div
                  className="w-24 h-3 rounded mb-3"
                  style={{ background: "var(--bg-surface)" }}
                />
                <div
                  className="w-16 h-6 rounded mb-2"
                  style={{ background: "var(--bg-surface)" }}
                />
                <div
                  className="w-32 h-3 rounded"
                  style={{ background: "var(--bg-surface)" }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/patient/\[id\]/page.tsx
git commit -m "feat: rewrite patient page with contextual hero, snapshot, RX scheduler, and chat"
```

---

### Task 8: Update HealthTimeline to Support Collapsed Default

**Files:**
- Modify: `frontend/components/HealthTimeline.tsx`

The patient page now passes `defaultCollapsed={true}` to HealthTimeline. The component needs to support this prop.

- [ ] **Step 1: Update HealthTimeline props and initial state**

In `frontend/components/HealthTimeline.tsx`, change the interface and component:

Change lines 7-9 from:
```tsx
interface HealthTimelineProps {
  encounters: Encounter[];
}
```

to:
```tsx
interface HealthTimelineProps {
  encounters: Encounter[];
  defaultCollapsed?: boolean;
}
```

Change line 17 from:
```tsx
export default function HealthTimeline({ encounters }: HealthTimelineProps) {
```

to:
```tsx
export default function HealthTimeline({ encounters, defaultCollapsed = false }: HealthTimelineProps) {
```

Add a `collapsed` state after the existing `showAll` state (after line 18):

```tsx
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
```

- [ ] **Step 2: Wrap the timeline body in a collapsible container**

Replace the section return (lines 25-138) with:

```tsx
  return (
    <section>
      <button
        onClick={() => setCollapsed((prev) => !prev)}
        className="flex items-center gap-2 mb-4 cursor-pointer"
        style={{ background: "transparent", border: "none", padding: 0 }}
      >
        <h2
          className="text-sm font-semibold uppercase tracking-widest"
          style={{ color: "var(--text-muted)" }}
        >
          Health Timeline
        </h2>
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{
            background: "var(--bg-surface)",
            color: "var(--text-secondary)",
          }}
        >
          {sorted.length} visits
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          className="transition-transform duration-200"
          style={{
            color: "var(--text-muted)",
            transform: collapsed ? "rotate(0deg)" : "rotate(180deg)",
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

      {!collapsed && (
        <>
          <div
            className="relative"
            style={{
              maxHeight: showAll ? "none" : "680px",
              overflow: "auto",
            }}
          >
            <div className="relative pl-8">
              {/* Vertical line */}
              <div
                className="absolute left-[11px] top-0 bottom-0 w-px"
                style={{ background: "var(--border-default)" }}
              />

              {displayed.map((enc, i) => {
                const facilityColor =
                  FACILITY_COLORS[enc.facility] || "var(--text-muted)";
                const shortName =
                  FACILITY_SHORT_NAMES[enc.facility] || enc.facility;
                const isEmergency = enc.encounter_type === "emergency";
                const date = new Date(enc.encounter_date);
                const formatted = date.toLocaleDateString("en-CA", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });

                return (
                  <div
                    key={enc.encounter_id || i}
                    className="relative pb-6 last:pb-0 animate-fade-in-up"
                    style={{
                      animationDelay: `${Math.min(i * 40, 400)}ms`,
                    }}
                  >
                    {/* Facility dot */}
                    <div
                      className="facility-dot absolute left-[-21px] top-[6px]"
                      style={{
                        background: facilityColor,
                        boxShadow: isEmergency
                          ? `0 0 8px ${facilityColor}`
                          : "none",
                      }}
                    />

                    <div
                      className={`card p-4 ${isEmergency ? "glow-urgent" : ""}`}
                      style={{ borderLeft: `3px solid ${facilityColor}` }}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="text-xs font-mono"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {formatted}
                          </span>
                          <span
                            className="text-xs font-semibold px-2 py-0.5 rounded"
                            style={{
                              color: facilityColor,
                              background: `${facilityColor}15`,
                            }}
                          >
                            {shortName}
                          </span>
                          <span
                            className={`${encounterTypeBadge[enc.encounter_type] || "badge-info"} text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider`}
                          >
                            {enc.encounter_type}
                          </span>
                        </div>
                      </div>

                      {enc.chief_complaint && (
                        <p
                          className="text-sm font-medium mb-1"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {enc.chief_complaint}
                        </p>
                      )}

                      {enc.diagnosis_description && (
                        <p
                          className="text-xs"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {enc.diagnosis_description}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Fade overlay when not showing all */}
            {!showAll && hasMore && (
              <div
                className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(transparent, var(--bg-primary))",
                }}
              />
            )}
          </div>

          {hasMore && (
            <button
              onClick={() => setShowAll((prev) => !prev)}
              className="mt-4 w-full py-3 text-sm font-medium rounded-xl transition-colors cursor-pointer"
              style={{
                color: "var(--text-accent)",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              {showAll
                ? "Show fewer"
                : `Show all ${sorted.length} encounters`}
            </button>
          )}
        </>
      )}
    </section>
  );
```

- [ ] **Step 3: Commit**

```bash
git add frontend/components/HealthTimeline.tsx
git commit -m "feat: add collapsible behavior to HealthTimeline"
```

---

### Task 9: Verify Full Integration

**Files:** None (verification only)

- [ ] **Step 1: Start the backend**

Run: `cd /Users/markaxelus/Documents/_Code_Projects/portal && python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 &`

Verify: `curl -s http://localhost:8000/api/patients/PAT-001918/summary | python3 -m json.tool | head -20`
Expected: JSON with patient data, alerts array

- [ ] **Step 2: Verify the chat endpoint responds**

Run: `curl -s -X POST http://localhost:8000/api/patients/PAT-001918/chat -H "Content-Type: application/json" -d '{"message": "hello", "conversation_history": []}' | python3 -m json.tool`
Expected: JSON with `response` and `suggested_questions` fields (response may indicate API key not configured, that's OK)

- [ ] **Step 3: Start the frontend and verify it compiles**

Run: `cd /Users/markaxelus/Documents/_Code_Projects/portal/frontend && npm run build`
Expected: Build succeeds with no TypeScript errors

- [ ] **Step 4: Commit any fixes needed**

If there are build errors, fix them and commit:
```bash
git add -A
git commit -m "fix: resolve build errors in patient view integration"
```
