# StockAI - AI Investment Research Agent

A multi-agent "investment committee" — not a single prompt — that takes a company name, performs live research, and produces an invest / pass / watch call with calibrated confidence, a TradingView-style interactive chart, and cited reasoning.

---

## 1. Overview

Give it a company name (e.g. "Tesla") and it:

1. Resolves it to a real ticker via a live lookup (not an LLM guess).
2. Runs **three specialist analyst agents in parallel**, each grounded in real, live data:
   - **Fundamentals analyst** — valuation, margins, growth, balance sheet (Yahoo Finance).
   - **Technical analyst** — moving averages, RSI, volatility, trend (computed from real price history). Renders an **interactive candlestick chart** with volume & SMA overlays.
   - **Sentiment analyst** — recent real news, via live web search.
3. Feeds all three briefs to a **Bull researcher** and a **Bear researcher**, who build the strongest honest case for and against investing.
4. A **Risk manager** stress-tests both sides and gives a position-sizing view.
5. A **Portfolio manager** makes the final call: `Invest` / `Pass` / `Watch`, with a color-coded confidence gauge, key risks, and "what would change our mind."

Every agent's output streams to the UI live as it's produced. You can also **Download a PDF report** of the entire committee's findings once complete.

## 2. How to run it

**Requirements:** Node.js 18.18+, a Groq API key (free), a Tavily API key (free tier).

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# then edit .env.local and add:
#   GROQ_API_KEY=gsk_...           (https://console.groq.com)
#   TAVILY_API_KEY=tvly-...        (https://tavily.com)

# 3. Run it
npm run dev
# open http://localhost:3000 (or port 3001 if 3000 is in use)
```

**Deploying for Free:**
Push your repository to GitHub, go to [Vercel](https://vercel.com/), and import the project. Add `GROQ_API_KEY` and `TAVILY_API_KEY` as Environment Variables in Vercel before deploying. No other config needed — it's a standard Next.js app.

## 3. How it works (architecture)

```
START
  → resolveTicker                         (live ticker lookup)
  → [fundamentals, technical, sentiment]   (run in parallel — LangGraph fan-out)
  → [bull, bear]                           (fan-in from all 3 analysts, run in parallel)
  → riskManager                            (fan-in from bull + bear)
  → portfolioManager                       (final structured decision)
  → END
```

This is built as a **LangGraph.js `StateGraph`**. LangGraph's execution model runs every node scheduled for the same "superstep" concurrently, so the three analysts genuinely run as parallel API + LLM calls.

**Stack:**
- **Next.js (App Router)** for both frontend and backend (`app/api/research/route.js`)
- **LangGraph.js** for the agent graph orchestration
- **Groq (`llama-3.3-70b-versatile`)** as the LLM — lightning fast and highly capable.
- **Yahoo Finance** public endpoints for fundamentals + historical price data (used to build the OHLCV chart arrays).
- **lightweight-charts** for the TradingView-style interactive candlestick chart on the frontend.
- **Tavily** for live news search.
- **Server-Sent Events (SSE)** to stream each agent's output to the browser as it's produced.

**Key files:**
| File | Purpose |
|---|---|
| `lib/agents/state.js` | LangGraph state schema (shared "memory" across nodes) |
| `lib/agents/nodes.js` | Each agent's actual logic (fetch data → prompt LLM) |
| `lib/agents/graph.js` | Wires the nodes into the fan-out/fan-in graph |
| `lib/tools/marketData.js` | Live fundamentals + technical indicator calculations |
| `components/StockChart.jsx`| Renders the interactive technical analysis chart |
| `components/VerdictCard.jsx`| The final decision card with gauge UI and PDF export |
| `lib/prompts.js` | Every agent's role prompt, incl. strict confidence-calibration rules |
| `app/api/research/route.js` | Runs the graph, streams updates via SSE |

## 4. Key decisions & UX features

- **Strict Confidence Calibration:** No system can honestly claim ~90% accuracy predicting a stock. The Portfolio Manager outputs a **calibrated confidence score** governed by strict rules (`lib/prompts.js`). A genuinely mixed picture scores 40-60%. 85%+ requires fundamentals, technicals, *and* sentiment to all agree with no material contradicting risk.
- **Clear UI Badging:** The final verdict is color-coded with plain-English explanations so users know exactly what an *Invest*, *Pass*, or *Watch* rating implies.
- **Interactive Technical Chart:** Instead of just text, the technical analyst node streams full OHLCV (Open-High-Low-Close-Volume) arrays to the frontend. The `StockChart` component renders this into a beautiful, interactive candlestick chart with SMA20/SMA50 overlays and reference lines.
- **Print-ready PDF Export:** The Verdict card includes a "Download report (PDF)" button that builds a beautifully styled HTML document on the fly and opens the browser's print dialog.

## 5. What I would improve with more time

- **Full agentic tool use**: let the sentiment/fundamentals analysts decide *what* to search for and re-query if the first pass is thin, instead of one fixed fetch per node.
- **Backtesting mode**: run the committee against a company's data from N months ago and compare its call to what actually happened.
- **Persistent history**: store past runs (e.g. in Vercel Postgres/SQLite) so recommendations can be tracked over time.
- **Interactive follow-up**: let the user ask "why are you worried about margins?" and re-enter the relevant LangGraph node with that question.

## 6. Note on AI usage

This project was built with AI assistance throughout, as the assignment mandates. Chat transcripts/logs from the build session are included per the bonus submission instructions.
