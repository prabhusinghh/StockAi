"use client";

function ConfidenceGauge({ value = 0 }) {
  const clamped = Math.max(0, Math.min(100, value));

  // Gauge geometry: semi-circle from 180° (left) to 0° (right)
  const cx = 100, cy = 95, r = 72, strokeW = 14;
  const startAngle = 180;
  const totalSweep = 180;

  // Helper to get point on arc
  const polarToCartesian = (angle) => {
    const rad = (angle * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
  };

  // Build arc path
  const arcPath = (from, to) => {
    const s = polarToCartesian(from);
    const e = polarToCartesian(to);
    const sweep = from - to;
    const largeArc = sweep > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`;
  };

  // Color stops: red (0%) → amber (50%) → green (100%)
  const getColor = (pct) => {
    if (pct <= 50) {
      const t = pct / 50;
      // red → amber
      const rr = Math.round(239 + (240 - 239) * t);
      const g = Math.round(91 + (180 - 91) * t);
      const b = Math.round(91 + (41 - 91) * t);
      return `rgb(${rr},${g},${b})`;
    } else {
      const t = (pct - 50) / 50;
      // amber → green
      const rr = Math.round(240 + (62 - 240) * t);
      const g = Math.round(180 + (207 - 180) * t);
      const b = Math.round(41 + (142 - 41) * t);
      return `rgb(${rr},${g},${b})`;
    }
  };

  // Filled arc angle
  const filledAngle = startAngle - (clamped / 100) * totalSweep;

  // Needle angle (in CSS-rotation degrees: 0° = up)
  const needleRotation = -90 + (clamped / 100) * 180;

  // Build gradient segments for the filled portion
  const segmentCount = 30;
  const filledSweep = (clamped / 100) * totalSweep;
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
      <svg viewBox="0 0 200 110" className="gauge-svg">
        {/* Background track */}
        <path
          d={arcPath(startAngle, 0)}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeW}
          strokeLinecap="round"
        />
        {/* Colored filled segments */}
        {segments}
        {/* Needle */}
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
        {/* Center label */}
        <text
          x={cx} y={cy + 2}
          textAnchor="middle"
          dominantBaseline="hanging"
          className="gauge-value"
          fill={gaugeColor}
        >
          {clamped}%
        </text>
        {/* Min/Max labels */}
        <text x={cx - r - 2} y={cy + 14} textAnchor="middle" className="gauge-tick-label" fill="var(--text-dim)">0</text>
        <text x={cx + r + 2} y={cy + 14} textAnchor="middle" className="gauge-tick-label" fill="var(--text-dim)">100</text>
      </svg>
      <span className="gauge-caption">Confidence</span>
    </div>
  );
}

export default function VerdictCard({ decision, sources }) {
  if (!decision) return null;
  const verdictClass = (decision.verdict || "").toLowerCase();

  return (
    <div className="verdict-card">
      <div className="verdict-top">
        <span className={`verdict-badge ${verdictClass}`}>{decision.verdict}</span>
        <ConfidenceGauge value={decision.confidence} />
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

      <p className="disclaimer">
        This is an AI-generated research output for a portfolio/demo project, not financial advice.
        Confidence reflects agreement across the committee's data, not a guarantee of outcome —
        real investing decisions should involve a licensed financial advisor and your own due diligence.
      </p>
    </div>
  );
}
