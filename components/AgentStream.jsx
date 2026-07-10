"use client";

import { useState } from "react";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Extract a concise 1-line summary from a report string. */
function summarise(text) {
  if (!text) return "Processing…";
  const firstLine = text.split("\n").find((l) => l.trim().length > 0) ?? "";
  // Trim to ~120 chars so collapsed cards stay compact
  return firstLine.length > 120
    ? firstLine.slice(0, 117).trimEnd() + "…"
    : firstLine;
}

/** Get the report text and raw data object for each node. */
function getReportAndData(node, output) {
  switch (node) {
    case "fundamentals":
      return { report: output.fundamentalsReport, rawData: output.fundamentalsData, dataLabel: "Fundamentals data" };
    case "technical":
      return { report: output.technicalReport, rawData: output.technicalsData, dataLabel: "Technicals data" };
    case "sentiment":
      return { report: output.sentimentReport, rawData: output.newsData, dataLabel: "News articles" };
    case "bull":
      return { report: output.bullCase, rawData: null, dataLabel: null };
    case "bear":
      return { report: output.bearCase, rawData: null, dataLabel: null };
    case "riskManager":
      return { report: output.riskAssessment, rawData: null, dataLabel: null };
    case "portfolioManager":
      return { report: "Final decision compiled — see verdict below.", rawData: null, dataLabel: null };
    default:
      return { report: null, rawData: null, dataLabel: null };
  }
}

/* ------------------------------------------------------------------ */
/*  Raw-data table renderers                                           */
/* ------------------------------------------------------------------ */

/** Render a flat key/value object as a 2-column table. */
function KeyValueTable({ data }) {
  if (!data || typeof data !== "object") return null;
  const entries = Object.entries(data);
  if (entries.length === 0) return <p className="raw-empty">No data available.</p>;

  return (
    <div className="raw-table-wrap">
      <table className="raw-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, value]) => (
            <tr key={key}>
              <td className="raw-key">{formatKey(key)}</td>
              <td className="raw-value">{formatValue(value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Render an array of objects (like newsData) as a multi-column table. */
function ArrayTable({ data }) {
  if (!Array.isArray(data) || data.length === 0) {
    return <p className="raw-empty">No data available.</p>;
  }

  // For news articles, pick the most useful columns
  const allKeys = Array.from(
    data.reduce((set, item) => {
      Object.keys(item).forEach((k) => set.add(k));
      return set;
    }, new Set())
  );

  // Prioritise title/url/content, filter out very long keys
  const priorityKeys = ["title", "url", "content", "score"];
  const sortedKeys = [
    ...priorityKeys.filter((k) => allKeys.includes(k)),
    ...allKeys.filter((k) => !priorityKeys.includes(k)),
  ];

  return (
    <div className="raw-table-wrap">
      <table className="raw-table">
        <thead>
          <tr>
            {sortedKeys.map((k) => (
              <th key={k}>{formatKey(k)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              {sortedKeys.map((k) => (
                <td key={k} className="raw-value">
                  {k === "url" && row[k] ? (
                    <a href={row[k]} target="_blank" rel="noopener noreferrer">{truncate(row[k], 60)}</a>
                  ) : (
                    truncate(formatValue(row[k]), 200)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Render raw data based on its type. */
function RawDataView({ rawData }) {
  if (rawData === null || rawData === undefined) return null;
  if (Array.isArray(rawData)) return <ArrayTable data={rawData} />;
  if (typeof rawData === "object") return <KeyValueTable data={rawData} />;
  return <pre className="raw-pre">{String(rawData)}</pre>;
}

/** camelCase → Title Case */
function formatKey(key) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

/** Render a value smartly: numbers get formatting, objects get JSON. */
function formatValue(val) {
  if (val === null || val === undefined) return "—";
  if (typeof val === "number") {
    if (Number.isInteger(val) && Math.abs(val) > 1_000_000) {
      return val.toLocaleString();
    }
    return typeof val === "number" && !Number.isInteger(val)
      ? val.toFixed(4)
      : val.toLocaleString();
  }
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (typeof val === "object") return JSON.stringify(val, null, 2);
  return String(val);
}

function truncate(str, max) {
  if (typeof str !== "string") return str;
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

/* ------------------------------------------------------------------ */
/*  Agent Card (individual, collapsible)                               */
/* ------------------------------------------------------------------ */

function AgentCard({ node, label, output }) {
  const [expanded, setExpanded] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  // resolveTicker is always shown inline (no expand/collapse)
  if (node === "resolveTicker") {
    return (
      <div className="agent-card">
        <div className="agent-card-header">
          <span className="agent-dot" />
          <h3>{label}</h3>
        </div>
        <p className="agent-card-meta">
          {output.companyLongName} ({output.ticker}){" "}
          {output.tickerMatched
            ? "— matched via live lookup"
            : "— no exact match found, used as literal ticker"}
        </p>
      </div>
    );
  }

  const { report, rawData, dataLabel } = getReportAndData(node, output);
  const summary = summarise(report);

  return (
    <div className={`agent-card ${expanded ? "agent-card--expanded" : ""}`}>
      {/* Clickable header to toggle expand/collapse */}
      <button
        className="agent-card-header agent-card-toggle"
        onClick={() => {
          setExpanded((prev) => !prev);
          if (expanded) setShowRaw(false); // collapse raw when collapsing card
        }}
        aria-expanded={expanded}
      >
        <span className="agent-dot" />
        <h3>{label}</h3>
        <span className="agent-chevron" aria-hidden="true">
          {expanded ? "▾" : "▸"}
        </span>
      </button>

      {/* Collapsed summary */}
      {!expanded && (
        <p className="agent-card-summary">{summary}</p>
      )}

      {/* Expanded body */}
      {expanded && (
        <div className="agent-card-expanded-body">
          <div className="agent-card-body">{report}</div>

          {rawData && (
            <div className="raw-data-section">
              <button
                className="raw-toggle-btn"
                onClick={() => setShowRaw((prev) => !prev)}
              >
                <span className="raw-toggle-icon">{showRaw ? "▾" : "▸"}</span>
                {showRaw ? "Hide" : "View"} raw data
                {dataLabel && <span className="raw-toggle-label"> — {dataLabel}</span>}
              </button>

              {showRaw && (
                <div className="raw-data-content">
                  <RawDataView rawData={rawData} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main export                                                        */
/* ------------------------------------------------------------------ */

export default function AgentStream({ updates }) {
  return (
    <div>
      {updates.map((u, i) => (
        <AgentCard
          key={`${u.node}-${i}`}
          node={u.node}
          label={u.label}
          output={u.output}
        />
      ))}
    </div>
  );
}
