"use client";

import { useState, useRef, useEffect } from "react";
import { sendChatMessage } from "@/lib/api";
import type { ChatMessage } from "@/lib/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import mockClinicalData from "@/lib/mock_clinical_context.json";

type LocalChatMessage = ChatMessage & {
  bubbles?: { label: string; type: string; url?: string }[];
  metricsToHighlight?: string[];
};
interface ChatWidgetProps {
  patientId: string;
  patientName: string;
  onMetricsUpdate?: (metrics: string[]) => void;
}

export default function ChatWidget({ patientId, patientName, onMetricsUpdate }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<LocalChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([
    "What do my latest lab results mean?",
    "Am I due for any tests?",
    "Tell me about my medications",
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  async function handleSend(text?: string) {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    const userMessage: ChatMessage = { role: "user", content: messageText };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    try {
      const response = await sendChatMessage(patientId, messageText, messages);
      let bubbles = undefined;
      let mockMetrics = undefined;

      // Check mock context for keyword match
      for (const entry of mockClinicalData) {
        if (entry.keywords.some((kw) => messageText.toLowerCase().includes(kw))) {
          bubbles = entry.bubbles;
          mockMetrics = entry.metricsToHighlight;
          break;
        }
      }

      const assistantMessage: LocalChatMessage = { 
        role: "assistant", 
        content: response.response,
        bubbles,
        metricsToHighlight: mockMetrics
      };
      setMessages([...updatedMessages, assistantMessage]);

      if (response.suggested_questions && response.suggested_questions.length > 0) {
        setSuggestedQuestions(response.suggested_questions);
      }

      if (mockMetrics && mockMetrics.length > 0 && onMetricsUpdate) {
        onMetricsUpdate(mockMetrics);
      } else if (response.relevant_metrics && response.relevant_metrics.length > 0 && onMetricsUpdate) {
        onMetricsUpdate(response.relevant_metrics);
      }
    } catch {
      const errorMessage: ChatMessage = {
        role: "assistant",
        content: "I'm sorry, I'm having trouble connecting right now. Please try again in a moment.",
      };
      setMessages([...updatedMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (!isOpen) {
    return (
      <button className="chat-fab" onClick={() => setIsOpen(true)}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path
            d="M3 3.5C3 2.67 3.67 2 4.5 2H13.5C14.33 2 15 2.67 15 3.5V10.5C15 11.33 14.33 12 13.5 12H6L3 15V3.5Z"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          <path d="M6.5 6.5H11.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M6.5 9H9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Ask</span>
      </button>
    );
  }

  return (
    <div className="chat-panel">
      {/* Header */}
      <div className="chat-panel-header">
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            Health Assistant
          </h3>
          <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: 0, marginTop: 2 }}>
            {patientName}
          </p>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            padding: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 8,
            transition: "color 0.15s ease",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"; }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 && !isLoading && (
          <div
            className="chat-bubble chat-bubble-assistant"
            style={{ fontSize: 13, lineHeight: 1.5 }}
          >
            Hi! I&apos;m your Health Assistant. Ask me about your lab results, medications, or upcoming health checks.
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className="mb-4">
            <div
              className={`chat-bubble ${msg.role === "user" ? "chat-bubble-user" : "chat-bubble-assistant"} chat-markdown`}
              style={{ fontSize: 13, lineHeight: 1.5 }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
            </div>
            
            {msg.bubbles && msg.bubbles.length > 0 && (
              <div className="flex flex-col gap-2 mt-2 ml-2 animate-fade-in-up">
                {msg.bubbles.map((b, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                    style={{
                      background: b.type === "trial" ? "rgba(16, 185, 129, 0.1)" : "rgba(110, 207, 255, 0.1)",
                      color: b.type === "trial" ? "var(--color-healthy)" : "var(--text-accent)",
                      border: b.type === "trial" ? "1px solid rgba(16, 185, 129, 0.2)" : "1px solid rgba(110, 207, 255, 0.2)",
                      alignSelf: "flex-start",
                      transition: "transform 0.15s ease"
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
                    onClick={() => {
                        if (msg.metricsToHighlight && onMetricsUpdate) {
                            onMetricsUpdate(msg.metricsToHighlight);
                        }
                        if (b.url) {
                            window.open(b.url, "_blank");
                        }
                    }}
                  >
                    {b.type === "trial" ? (
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                         <path d="M8 15A7 7 0 108 1a7 7 0 000 14z" stroke="currentColor" strokeWidth="1.5"/>
                         <path d="M7.5 4v4l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                         <path d="M14 4L6 12L2 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                    <span className="flex-1 truncate">{b.label}</span>
                    {b.url && (
                        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 ml-1 opacity-60">
                            <path d="M12.5 8v4.5A1.5 1.5 0 0111 14H3.5a1.5 1.5 0 01-1.5-1.5v-7.5A1.5 1.5 0 013.5 3.5H8M10 2h4v4M14 2L7 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div
            className="chat-bubble chat-bubble-assistant"
            style={{ display: "flex", gap: 4, padding: "12px 16px" }}
          >
            <span className="chat-typing-dot" />
            <span className="chat-typing-dot" style={{ animationDelay: "0.15s" }} />
            <span className="chat-typing-dot" style={{ animationDelay: "0.3s" }} />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested questions */}
      {suggestedQuestions.length > 0 && !isLoading && (
        <div className="chat-suggestions">
          {suggestedQuestions.map((q, i) => (
            <button
              key={i}
              className="chat-suggestion-btn"
              onClick={() => handleSend(q)}
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
          className="chat-input"
          placeholder="Ask about your health..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
        />
        <button
          className="chat-send-btn"
          onClick={() => handleSend()}
          disabled={isLoading || !input.trim()}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M2.5 8H13.5M13.5 8L9 3.5M13.5 8L9 12.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
