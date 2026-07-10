# AI Investment Research Agent

A multi-agent "investment committee" — not a single prompt — that takes a company
name, does real research, and produces an invest / pass / watch call with
calibrated confidence and cited reasoning.

Built for the InsideIIM × Altuni AI Labs take-home assignment.

---

## 1. Overview

Give it a company name (e.g. "Tesla") and it:

1. Resolves it to a real ticker via a live lookup (not an LLM guess).
2. Runs **three specialist analyst agents in parallel**, each grounded in real,
   live data:
   - **Fundamentals analyst** — valuation, margins, growth, balance sheet (Yahoo Finance).
   - **Technical analyst** — moving averages, RSI, volatility, trend (computed
     from real price history, not hallucinated).
   - **Sentiment analyst** — recent real news, via live web search.
3. Feeds all three briefs to a **Bull researcher** and a **Bear researcher**,
   who build the strongest honest case for and against investing.
4. A **Risk manager** stress-tests both sides and gives a position-sizing view.
5. A **Portfolio manager** makes the final call: `Invest` / `Pass` / `Watch`,
   with a calibrated confidence score, key risks, and "what would change our
   mind."

Every agent's output streams to the UI live as it's produced, so you watch the
committee actually deliberate instead of staring at a spinner.

## 2. How to run it

**Requirements:** Node.js 18.18+, a Google Gemini API key (free), a Tavily API key (free tier).

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# then edit .env.local and add:
#   GOOGLE_API_KEY=AIza...      (https://aistudio.google.com)
#   TAVILY_API_KEY=tvly-...        (https://tavily.com — free tier is enough)

# 3. Run it
npm run dev
# open http://localhost:3000
```

To deploy (e.g. Vercel): push to a GitHub repo, import it in Vercel, and add
`GOOGLE_API_KEY` and `TAVILY_API_KEY` as environment variables in the
project settings. No other config needed — it's a standard Next.js app.

**No Tavily key?** The sentiment analyst will run and clearly report "no live
news was available" instead of crashing or inventing news — the rest of the
pipeline (fundamentals, technicals, debate, decision) still works.

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

This is built as an actual **LangGraph.js `StateGraph`**, not a linear chain of
LangChain calls — see `lib/agents/graph.js`. LangGraph's execution model runs
every node scheduled for the same "superstep" concurrently, so the three
analysts genuinely run as parallel API + LLM calls, and the bull/bear nodes
each fire exactly once, only after all three analysts complete.

The multi-agent, debate-driven structure (specialist analysts → bull/bear
researchers → risk manager → portfolio manager) is inspired by recent
published research on multi-agent LLM trading frameworks (e.g. *TradingAgents*,
arXiv:2412.20138), scoped down to something buildable and explainable in a
week rather than a full backtested trading system.

**Stack:**
- Next.js (App Router) for both frontend and backend (`app/api/research/route.js`)
- LangGraph.js for the agent graph, LangChain.js message types for LLM calls
- Google Gemini (`gemini-2.5-flash` by default, configurable) as the LLM — chosen because
  Google AI Studio's free tier needs no credit card, unlike most alternatives
- Yahoo Finance's public endpoints for fundamentals + price history (no key needed)
- Tavily for live news search (the standard LangChain.js web-search tool integration)
- Server-Sent Events (SSE) to stream each agent's output to the browser as
  it's produced — no polling, no websockets needed

**Key files:**
| File | Purpose |
|---|---|
| `lib/agents/state.js` | LangGraph state schema (shared "memory" across nodes) |
| `lib/agents/nodes.js` | Each agent's actual logic (fetch data → prompt LLM) |
| `lib/agents/graph.js` | Wires the nodes into the fan-out/fan-in graph |
| `lib/tools/marketData.js` | Live fundamentals + technical indicator calculations |
| `lib/tools/webSearch.js` | Live news search via Tavily |
| `lib/prompts.js` | Every agent's role prompt, incl. confidence-calibration rules |
| `app/api/research/route.js` | Runs the graph, streams updates via SSE |
| `app/page.jsx` + `components/` | Frontend: form, live agent stream, verdict card |

## 4. Key decisions & trade-offs

- **Deliberately did not claim high accuracy.** No system — human or AI — can
  honestly claim ~90% accuracy predicting whether a stock investment succeeds.
  Instead, the Portfolio Manager outputs a **calibrated confidence score**
  with explicit rules against overconfidence (see `PORTFOLIO_MANAGER_PROMPT`):
  a genuinely mixed picture must score 40-60%, and 90%+ requires fundamentals,
  technicals, *and* sentiment to all agree with no material contradicting risk.
  I think this is more defensible and more useful than a false precision claim.
- **Real data over agentic tool-calling loops.** Each analyst node directly
  calls a data-fetching function (Yahoo Finance / Tavily) rather than giving
  the LLM a tool-calling loop to decide what to fetch. This trades away some
  flexibility for reliability and speed within a 7-day window — see "what I'd
  improve" below for how I'd extend this.
- **Yahoo Finance's unofficial public endpoints** were used instead of a paid
  data provider, since they need no API key and are commonly used for exactly
  this purpose. Trade-off: it's an undocumented API that could change shape or
  rate-limit without notice — every call fails soft (returns `null`, and the
  agent explicitly says data was unavailable) rather than crashing the whole run.
- **Structured JSON output for the final decision** (not free text) so the
  frontend can render a real UI (confidence bar, risk list, citations) instead
  of just dumping markdown. If the LLM's JSON fails to parse, there's a
  fallback "Watch, low confidence" response rather than a hard crash.
- **SSE over WebSockets** for streaming, since it's simpler, works over plain
  HTTP, and Next.js API routes support it natively without an extra server.
- **Left out:** persistent storage/history of past runs, authentication, and a
  backtesting mode — all noted as improvements below rather than cut silently.

## 5. Example runs

> Run the app with your own API keys and paste 2-3 real outputs here before
> submitting — this section is intentionally left as a template since the
> actual output depends on live market data and news at the time you run it.
> Good picks for variety: one large well-covered company (e.g. a Nifty 50 or
> S&P 500 name), one smaller/less-covered one, and one currently in the news
> for something negative (e.g. a controversy or earnings miss) to show the
> Bear/Risk agents actually engaging.

**Example: `<company you ran>`**
- Verdict: `<Invest / Pass / Watch>`, Confidence: `<n>`%
- Reasoning: `<paste the reasoning field>`
- Key risks: `<paste>`

(repeat for 2 more companies)

## 6. What I would improve with more time

- **Full agentic tool use**: let the sentiment/fundamentals analysts decide
  *what* to search for and re-query if the first pass is thin, instead of one
  fixed fetch per node — the current version is intentionally simpler and more
  predictable for a 7-day scope.
- **Backtesting mode**: run the committee against a company's data from N
  months ago and compare its call to what actually happened, to give real
  evidence for (or against) the pipeline's usefulness instead of a one-shot demo.
- **Persistent history**: store past runs (e.g. in Postgres/SQLite) so
  recommendations can be tracked over time instead of being ephemeral per session.
- **Interactive follow-up**: let the user ask "why are you worried about
  margins?" and re-enter the relevant LangGraph node with that question,
  showing LangGraph's cyclical/stateful capabilities beyond a single linear pass.
- **Cost/latency panel**: surface tokens used and time per report in the UI —
  small, but demonstrates engineering awareness beyond "it works."
- **A real financial data provider** (e.g. Alpha Vantage, Financial Modeling
  Prep) as a fallback if Yahoo's unofficial endpoints ever break.

## 7. Note on AI usage

This project was built with AI assistance throughout, as the assignment
mandates. Chat transcripts/logs from the build session are included per the
bonus submission instructions — see `/transcripts` (or wherever you've placed
your exported logs) if you're including them in your submission zip.
