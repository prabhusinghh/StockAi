"use client";

import { useState, useRef } from "react";
import CompanyForm from "../components/CompanyForm";
import AgentStream from "../components/AgentStream";
import VerdictCard from "../components/VerdictCard";

export default function HomePage() {
  const [company, setCompany] = useState("");
  const [running, setRunning] = useState(false);
  const [updates, setUpdates] = useState([]);
  const [decision, setDecision] = useState(null);
  const [sources, setSources] = useState([]);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  async function runResearch() {
    setRunning(true);
    setUpdates([]);
    setDecision(null);
    setSources([]);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed with status ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? ""; // keep the last, possibly-incomplete chunk

        for (const chunk of chunks) {
          const line = chunk.trim();
          if (!line.startsWith("data:")) continue;
          const jsonStr = line.slice(5).trim();
          if (!jsonStr) continue;

          let payload;
          try {
            payload = JSON.parse(jsonStr);
          } catch {
            continue;
          }

          if (payload.type === "node_update") {
            setUpdates((prev) => [...prev, payload]);
          } else if (payload.type === "complete") {
            setDecision(payload.decision);
            setSources(payload.sources ?? []);
          } else if (payload.type === "error") {
            setError(payload.message);
          }
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") setError(err.message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="container">
      <div className="header">
        <h1>AI Investment Research Agent</h1>
        <p>
          A committee of specialist agents — fundamentals, technical, and sentiment analysts, a bull
          researcher, a bear researcher, and a risk manager — debate a company before a portfolio
          manager makes a calibrated invest / pass / watch call.
        </p>
      </div>

      <CompanyForm value={company} onChange={setCompany} onSubmit={runResearch} running={running} />

      {error && <div className="error-banner">{error}</div>}

      <AgentStream updates={updates} />

      {running && updates.length < 8 && (
        <div className="agent-card">
          <div className="agent-card-header">
            <span className="spinner" />
            <h3 style={{ color: "var(--text-dim)" }}>Committee is working…</h3>
          </div>
        </div>
      )}

      <VerdictCard decision={decision} sources={sources} />
    </main>
  );
}
