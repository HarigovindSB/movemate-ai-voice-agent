"use client";
import { useEffect, useRef, useState } from "react";
import type { BookingState } from "@/lib/booking/schema";
import { emptyBooking } from "@/lib/booking/schema";
import { BookingSummary } from "./BookingSummary";

type Msg = { role: "user" | "assistant"; content: string };

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: any) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: any) => void) | null;
  start: () => void;
  stop: () => void;
};

type WindowWithSpeech = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

/**
 * Markdown is useful on screen but should not be spoken literally.
 * In particular, browser speech synthesis may say "asterisk" for `*`.
 */
function cleanForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/[*_~`]/g, "")
    .replace(/[✓✔✕✗•●◦]/g, "")
    .replace(/&/g, " and ")
    .replace(/\s+/g, " ")
    .trim();
}

export default function VoiceAgent() {
  const [state, setState] = useState<BookingState>(emptyBooking());
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Hi — I can help arrange your move. Tell me what you need moved and where it should go. You can give me the details in any order."
    }
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [status, setStatus] = useState("Ready");
  const recognition = useRef<SpeechRecognitionLike | null>(null);

  const stopSpeaking = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setStatus(recording ? "Listening…" : busy ? "Thinking…" : "Ready");
  };

  const speak = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const cleanText = cleanForSpeech(text);
    if (!cleanText) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 0.98;
    utterance.pitch = 1;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const send = async (text = input) => {
    const utterance = text.trim();
    if (!utterance || busy) return;

    stopSpeaking();
    setInput("");
    setBusy(true);
    setStatus("Thinking…");
    const nextMessages = [...messages, { role: "user" as const, content: utterance }];
    setMessages(nextMessages);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state,
          history: messages.slice(-8),
          utterance
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Agent failed");

      setState(data.state);
      setMessages([...nextMessages, { role: "assistant", content: data.reply }]);
      setBusy(false);
      setStatus(data.state.confirmed ? "Confirmed" : "Listening");
      speak(data.reply);
    } catch (e) {
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: "I couldn't process that just now. Please repeat the last part."
        }
      ]);
      setStatus("Error — retry");
      setBusy(false);
    }
  };

  const toggleSpeech = () => {
    if (recording) {
      recognition.current?.stop();
      setRecording(false);
      setStatus("Ready");
      return;
    }

    const w = window as WindowWithSpeech;
    const C = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!C) {
      setStatus("Browser speech recognition unavailable — type below.");
      return;
    }

    stopSpeaking();
    const r = new C();
    recognition.current = r;
    r.lang = "en-IN";
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (e: any) => {
      const text = e.results?.[0]?.[0]?.transcript || "";
      setInput(text);
      setRecording(false);
      if (text) void send(text);
    };
    r.onerror = () => {
      setRecording(false);
      setStatus("Could not hear that — try again.");
    };
    r.onend = () => setRecording(false);
    r.start();
    setRecording(true);
    setStatus("Listening…");
  };

  useEffect(() => {
    return () => {
      recognition.current?.stop();
      window.speechSynthesis?.cancel();
    };
  }, []);

  return (
    <div className="shell">
      <header className="header">
        <div>
          <div className="eyebrow">MoveMate · AI Voice Assessment</div>
          <h1>Conversational booking agent</h1>
          <p className="subtitle">
            Speak naturally. Give information in any order. The agent tracks corrections,
            ambiguity, validation, and final confirmation.
          </p>
        </div>
      </header>

      <main className="grid">
        <section className="card">
          <div className="card-head">
            <h2>Conversation</h2>
            <span className="label">{status}</span>
          </div>

          <div className="transcript">
            {messages.map((m, i) => (
              <div className={`message ${m.role}`} key={i}>
                <div className="avatar">{m.role === "user" ? "👤" : "AI"}</div>
                <div className="bubble">
                  <div className="role">{m.role === "user" ? "You" : "MoveMate"}</div>
                  {m.content}
                </div>
              </div>
            ))}
          </div>

          <div className="controls">
            <button
              className={`mic ${recording ? "recording" : ""}`}
              onClick={toggleSpeech}
              disabled={busy}
              aria-label={recording ? "Stop listening" : "Start speaking"}
              title={recording ? "Stop listening" : "Start speaking"}
            >
              {recording ? "■" : "🎙"}
            </button>

            <div className="textbox">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void send();
                }}
                placeholder="Or type your answer…"
                disabled={busy}
              />
              <button onClick={() => void send()} disabled={busy || !input.trim()}>
                Send
              </button>
            </div>

            <button
              className="stop-voice"
              onClick={stopSpeaking}
              disabled={!speaking}
              aria-label="Stop MoveMate from speaking"
              title="Stop MoveMate from speaking"
            >
              ■ Stop voice
            </button>
          </div>
        </section>

        <aside className="card">
          <div className="card-head">
            <h2>Live requirements</h2>
            <button
              className="secondary"
              onClick={() => {
                stopSpeaking();
                setState(emptyBooking());
                setMessages([{ role: "assistant", content: "New booking. What are you moving?" }]);
                setStatus("Ready");
              }}
            >
              Reset
            </button>
          </div>
          <BookingSummary state={state} />
        </aside>
      </main>
    </div>
  );
}
