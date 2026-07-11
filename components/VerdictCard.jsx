"use client";

/* ------------------------------------------------------------------ */
/*  Confidence gauge (unchanged)                                        */
/* ------------------------------------------------------------------ */

function ConfidenceGauge({ value = 0 }) {
  const clamped = Math.max(0, Math.min(100, value));

  const cx = 100, cy = 95, r = 72, strokeW = 14;
  const startAngle = 180;
  const totalSweep = 180;

  const polarToCartesian = (angle) => {
    const rad = (angle * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
  };

  const arcPath = (from, to) => {
    const s = polarToCartesian(from);
    const e = polarToCartesian(to);
    const sweep = from - to;
    const largeArc = sweep > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`;
  };

  const getColor = (pct) => {
    if (pct <= 50) {
      const t = pct / 50;
      const rr = Math.round(239 + (240 - 239) * t);
      const g = Math.round(91 + (180 - 91) * t);
      const b = Math.round(91 + (41 - 91) * t);
      return `rgb(${rr},${g},${b})`;
    } else {
      const t = (pct - 50) / 50;
      const rr = Math.round(240 + (62 - 240) * t);
      const g = Math.round(180 + (207 - 180) * t);
      const b = Math.round(41 + (142 - 41) * t);
      return `rgb(${rr},${g},${b})`;
    }
  };

  const filledAngle = startAngle - (clamped / 100) * totalSweep;
  const needleRotation = -90 + (clamped / 100) * 180;
  const segmentCount = 30;
  const segments = [];
  const segsToRender = Math.max(1, Math.round((clamped / 100) * segmentCount));

  for (let i = 0; i < segsToRender; i++) {
    const segStart = startAngle - (i / segmentCount) * totalSweep;
    const segEnd = startAngle - ((i + 1) / segmentCount) * totalSweep;
    const pct = ((i + 0.5) / segmentCount) * 100;
    segments.push(
      <path
        key={i}
        d={arcPath(segStart, Math.max(segEnd, filledAngle))}
        fill="none"
        stroke={getColor(pct)}
        strokeWidth={strokeW}
        strokeLinecap="butt"
      />
    );
  }

  const gaugeColor = getColor(clamped);

  return (
    <div className="confidence-gauge">
      <svg viewBox="0 0 200 132" className="gauge-svg">
        <path
          d={arcPath(startAngle, 0)}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeW}
          strokeLinecap="round"
        />
        {segments}
        <g transform={`rotate(${needleRotation}, ${cx}, ${cy})`}>
          <line
            x1={cx} y1={cy} x2={cx} y2={cy - r + strokeW + 2}
            stroke={gaugeColor}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx={cx} cy={cy} r="5" fill={gaugeColor} />
          <circle cx={cx} cy={cy} r="2.5" fill="var(--surface-2)" />
        </g>
        {/* % label sits BELOW the needle pivot so it never overlaps */}
        <text
          x={cx} y={cy + 22}
          textAnchor="middle"
          dominantBaseline="hanging"
          className="gauge-value"
          fill={gaugeColor}
        >
          {clamped}%
        </text>
        <text x={cx - r - 2} y={cy + 26} textAnchor="middle" className="gauge-tick-label" fill="var(--text-dim)">0</text>
        <text x={cx + r + 2} y={cy + 26} textAnchor="middle" className="gauge-tick-label" fill="var(--text-dim)">100</text>
      </svg>
      {/* caption removed — VerdictCard renders confidence-band + confidence-hint instead */}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Report builder                                                      */
/* ------------------------------------------------------------------ */

/** Maps node names to their report key and section title. */
const NODE_REPORT_MAP = [
  { node: "fundamentals", key: "fundamentalsReport",  title: "Fundamentals Analysis" },
  { node: "technical",    key: "technicalReport",     title: "Technical Analysis" },
  { node: "sentiment",    key: "sentimentReport",     title: "Sentiment Analysis" },
  { node: "bull",         key: "bullCase",            title: "Bull Case" },
  { node: "bear",         key: "bearCase",            title: "Bear Case" },
  { node: "riskManager",  key: "riskAssessment",      title: "Risk Assessment" },
];

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildPdfHtml({ companyInfo, updates, decision, sources }) {
  const date = new Date().toLocaleDateString("en-GB", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const companyName = companyInfo?.companyName ?? "Unknown Company";
  const ticker      = companyInfo?.ticker ?? "";
  const price       = companyInfo?.quoteData?.price;
  const change      = companyInfo?.quoteData?.change;
  const changePct   = companyInfo?.quoteData?.changePercent;
  const currency    = companyInfo?.quoteData?.currency ?? "USD";
  const sym         = currency === "INR" ? "₹" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : "$";

  const priceStr = price != null
    ? `${sym}${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "N/A";
  const changeColor = change == null ? "#666" : change >= 0 ? "#3ecf8e" : "#ef5b5b";
  const changeStr = change != null
    ? `<span style="color:${changeColor};font-weight:600">${change >= 0 ? "+" : ""}${change.toFixed(2)} (${changePct != null ? `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%` : ""})</span>`
    : "";

  // Collect report texts from update stream
  const reportMap = {};
  for (const u of updates ?? []) {
    for (const { node, key } of NODE_REPORT_MAP) {
      if (u.node === node && u.output?.[key]) {
        reportMap[node] = u.output[key];
      }
    }
  }

  const verdictColor =
    decision?.verdict?.toLowerCase() === "invest" ? "#3ecf8e" :
    decision?.verdict?.toLowerCase() === "pass"   ? "#ef5b5b" : "#f0b429";

  // Agent section blocks
  const agentSections = NODE_REPORT_MAP
    .filter(({ node }) => reportMap[node])
    .map(({ node, title }) => `
      <section class="section">
        <h2>${esc(title)}</h2>
        <div class="body-text">${esc(reportMap[node]).replace(/\n/g, "<br/>")}</div>
      </section>`)
    .join("");

  // Sources
  const sourcesHtml = Array.isArray(sources) && sources.length > 0
    ? `<section class="section">
        <h2>Sources</h2>
        <ul class="sources">${sources.map(s =>
          `<li><a href="${esc(s.url)}">${esc(s.label)}</a></li>`
        ).join("")}</ul>
      </section>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Research Report — ${esc(companyName)} (${esc(ticker)})</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
      line-height: 1.65;
      color: #1a1a2e;
      background: #fff;
      padding: 0;
    }
    .page { max-width: 760px; margin: 0 auto; padding: 48px 48px 64px; }
    .report-header {
      border-bottom: 3px solid #5b8cff;
      padding-bottom: 20px;
      margin-bottom: 28px;
    }
    .report-header h1 {
      font-size: 22px;
      font-weight: 700;
      color: #0f0f1a;
      letter-spacing: -0.02em;
      margin-bottom: 6px;
    }
    .meta { font-size: 12px; color: #666; display: flex; gap: 20px; flex-wrap: wrap; margin-top: 8px; }
    .meta span { display: flex; align-items: center; gap: 4px; }
    .price-big { font-size: 26px; font-weight: 700; color: #0f0f1a; margin-top: 4px; }
    .verdict-box {
      background: #f8f9ff;
      border: 1px solid #e0e4f0;
      border-left: 4px solid ${verdictColor};
      border-radius: 8px;
      padding: 18px 20px;
      margin-bottom: 28px;
    }
    .verdict-row { display: flex; align-items: center; gap: 16px; margin-bottom: 12px; }
    .verdict-badge {
      font-size: 16px;
      font-weight: 700;
      color: ${verdictColor};
      border: 2px solid ${verdictColor};
      padding: 4px 14px;
      border-radius: 6px;
      letter-spacing: 0.04em;
    }
    .confidence { font-size: 13px; color: #555; }
    .confidence strong { color: #0f0f1a; }
    .section { margin-bottom: 28px; page-break-inside: avoid; }
    .section h2 {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: #5b8cff;
      border-bottom: 1px solid #e8ecf8;
      padding-bottom: 6px;
      margin-bottom: 10px;
    }
    .section h3 {
      font-size: 12px;
      font-weight: 600;
      color: #333;
      margin: 12px 0 4px;
    }
    .body-text { color: #2a2a3e; font-size: 13px; line-height: 1.7; white-space: pre-wrap; }
    .risk-list { padding-left: 18px; color: #2a2a3e; }
    .risk-list li { margin-bottom: 4px; }
    .sources { padding-left: 18px; }
    .sources li { margin-bottom: 4px; }
    .sources a { color: #5b8cff; text-decoration: none; font-size: 12px; }
    .disclaimer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #e0e4f0;
      font-size: 11px;
      color: #999;
      line-height: 1.6;
    }
    @media print {
      body { font-size: 12px; }
      .page { padding: 0; max-width: 100%; }
      .report-header { page-break-after: avoid; }
      .section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="report-header">
      <h1>Investment Research Report</h1>
      <div class="price-big">${esc(companyName)} <span style="font-size:15px;font-weight:600;color:#5b8cff">${esc(ticker)}</span></div>
      <div class="meta">
        <span>📅 ${esc(date)}</span>
        <span>💰 ${esc(priceStr)} ${changeStr}</span>
      </div>
    </div>

    ${decision ? `
    <div class="verdict-box">
      <div class="verdict-row">
        <span class="verdict-badge">${esc(decision.verdict)}</span>
        <span class="confidence">Confidence: <strong>${decision.confidence}%</strong></span>
      </div>
      ${decision.reasoning ? `<h3>Reasoning</h3><p class="body-text">${esc(decision.reasoning)}</p>` : ""}
      ${Array.isArray(decision.keyRisks) && decision.keyRisks.length > 0 ? `
        <h3>Key Risks</h3>
        <ul class="risk-list">${decision.keyRisks.map(r => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}
      ${decision.whatWouldChangeOurMind ? `
        <h3>What Would Change Our Mind</h3>
        <p class="body-text">${esc(decision.whatWouldChangeOurMind)}</p>` : ""}
    </div>` : ""}

    ${agentSections}
    ${sourcesHtml}

    <p class="disclaimer">This is an AI-generated research output for a portfolio/demo project, not financial advice. Real investing decisions should involve a licensed financial advisor and your own due diligence.</p>
  </div>
  <script>window.onload = () => window.print();<\/script>
</body>
</html>`;
}

function openPdf(html) {
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

/* ------------------------------------------------------------------ */
/*  Verdict explanation helper                                           */
/* ------------------------------------------------------------------ */

const VERDICT_META = {
  invest: {
    icon: "▲",
    label: "Invest",
    meaning: "The committee sees a positive risk/reward at current levels — evidence tilts in favour of entering a position.",
    color: "var(--green)",
    bg: "rgba(62,207,142,0.08)",
    border: "rgba(62,207,142,0.25)",
  },
  watch: {
    icon: "◆",
    label: "Watch",
    meaning: "Evidence is too mixed or thin to commit. Add to your watchlist and wait for a clearer signal before acting.",
    color: "var(--amber)",
    bg: "rgba(240,180,41,0.08)",
    border: "rgba(240,180,41,0.25)",
  },
  pass: {
    icon: "▼",
    label: "Pass",
    meaning: "The committee sees unfavourable risk/reward — fundamental, technical, or sentiment concerns outweigh the upside.",
    color: "var(--red)",
    bg: "rgba(239,91,91,0.08)",
    border: "rgba(239,91,91,0.25)",
  },
};

function confidenceBand(pct) {
  if (pct >= 85) return { label: "Very high conviction", color: "var(--green)" };
  if (pct >= 70) return { label: "High conviction",      color: "var(--green)" };
  if (pct >= 55) return { label: "Moderate conviction",  color: "var(--amber)" };
  if (pct >= 40) return { label: "Low conviction",       color: "var(--amber)" };
  return              { label: "Very low conviction",    color: "var(--red)"   };
}

/* ------------------------------------------------------------------ */
/*  Main export                                                         */
/* ------------------------------------------------------------------ */

export default function VerdictCard({ decision, sources, updates, companyInfo }) {
  if (!decision) return null;
  const verdictKey = (decision.verdict || "watch").toLowerCase();
  const meta = VERDICT_META[verdictKey] ?? VERDICT_META.watch;
  const band = confidenceBand(decision.confidence ?? 0);

  const ticker = companyInfo?.ticker ?? "report";

  function handleDownload() {
    const html = buildPdfHtml({ companyInfo, updates, decision, sources });
    openPdf(html);
  }

  return (
    <div className="verdict-card">

      {/* ── Top row: badge + gauge ── */}
      <div className="verdict-top">
        <div className="verdict-badge-wrap">
          <span className={`verdict-badge ${verdictKey}`}>
            <span className="verdict-badge-icon">{meta.icon}</span>
            {meta.label}
          </span>
          {/* Plain-English explanation of the verdict */}
          <p className="verdict-meaning">{meta.meaning}</p>
        </div>

        <div className="verdict-gauge-col">
          <ConfidenceGauge value={decision.confidence} />
          <span className="confidence-band" style={{ color: band.color }}>
            {band.label}
          </span>
          <span className="confidence-hint">
            How strongly the 5-agent committee agreed
          </span>
        </div>
      </div>

      {/* ── Confidence scale legend ── */}
      <div className="confidence-scale">
        <span className="cs-label">Confidence scale</span>
        <div className="cs-bars">
          {[
            { range: "0–39%",   label: "Contradictory / thin data", color: "var(--red)"   },
            { range: "40–54%",  label: "Mixed signals",             color: "var(--red)"   },
            { range: "55–69%",  label: "Leaning one way",           color: "var(--amber)" },
            { range: "70–84%",  label: "Clear alignment",           color: "var(--amber)" },
            { range: "85–100%", label: "Near-unanimous",            color: "var(--green)" },
          ].map((b) => (
            <div key={b.range} className="cs-bar-item">
              <span className="cs-dot" style={{ background: b.color }} />
              <span className="cs-range">{b.range}</span>
              <span className="cs-desc">{b.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="verdict-section">
        <h4>Reasoning</h4>
        <p>{decision.reasoning}</p>
      </div>

      {Array.isArray(decision.keyRisks) && decision.keyRisks.length > 0 && (
        <div className="verdict-section">
          <h4>Key risks</h4>
          <ul className="risk-list">
            {decision.keyRisks.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {decision.whatWouldChangeOurMind && (
        <div className="verdict-section">
          <h4>What would change our mind</h4>
          <p>{decision.whatWouldChangeOurMind}</p>
        </div>
      )}

      {Array.isArray(sources) && sources.length > 0 && (
        <div className="verdict-section">
          <h4>Sources ({sources.length})</h4>
          <div className="sources-list">
            {sources.map((s, i) => (
              <a key={i} href={s.url} target="_blank" rel="noreferrer">
                {s.label}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Download report */}
      <button
        id="download-report-btn"
        className="download-btn"
        onClick={handleDownload}
        title="Open a print-ready PDF of the full committee report"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 1v9M4 7l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M2 12h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
        Download report (PDF)
      </button>

      <p className="disclaimer">
        This is an AI-generated research output for a portfolio/demo project, not financial advice.
        Confidence reflects agreement across the committee&apos;s data, not a guarantee of outcome —
        real investing decisions should involve a licensed financial advisor and your own due diligence.
      </p>
    </div>
  );
}
