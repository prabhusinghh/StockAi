import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getLLM } from "../llm.js";
import { resolveTicker, getQuickQuote, getFundamentals, getTechnicals } from "../tools/marketData.js";
import { searchCompanyNews } from "../tools/webSearch.js";
import {
  FUNDAMENTALS_PROMPT,
  TECHNICAL_PROMPT,
  SENTIMENT_PROMPT,
  BULL_PROMPT,
  BEAR_PROMPT,
  RISK_MANAGER_PROMPT,
  PORTFOLIO_MANAGER_PROMPT,
} from "../prompts.js";

async function askLLM(systemPrompt, userContent, { temperature = 0.2 } = {}) {
  const llm = getLLM({ temperature });
  const response = await llm.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(userContent),
  ]);
  return typeof response.content === "string"
    ? response.content
    : response.content.map((c) => c.text ?? "").join("");
}

// ---------------------------------------------------------------------------
// Node 1: resolve the free-text input to a real ticker via Yahoo's search API.
// ---------------------------------------------------------------------------
export async function resolveTickerNode(state) {
  const { ticker, longName, matched } = await resolveTicker(state.companyInput);
  // Fetch a lightweight price quote so the UI can show a header immediately
  const quote = await getQuickQuote(ticker);
  return {
    ticker,
    companyLongName: longName,
    tickerMatched: matched,
    quoteData: quote,
    sources: matched
      ? [{ label: "Ticker resolution", url: `https://finance.yahoo.com/quote/${ticker}` }]
      : [],
  };
}

// ---------------------------------------------------------------------------
// Node 2a: fundamentals analyst — real balance sheet / valuation data.
// ---------------------------------------------------------------------------
export async function fundamentalsAnalystNode(state) {
  const data = await getFundamentals(state.ticker);
  if (!data) {
    return {
      fundamentalsData: null,
      fundamentalsReport:
        "No fundamentals data could be retrieved for this ticker from the market data provider. Treat this as a gap, not a positive or negative signal.",
    };
  }
  const report = await askLLM(
    FUNDAMENTALS_PROMPT,
    `Company: ${state.companyLongName} (${state.ticker})\nMetrics (JSON):\n${JSON.stringify(data, null, 2)}`
  );
  return {
    fundamentalsData: data,
    fundamentalsReport: report,
    sources: [{ label: "Fundamentals data (Yahoo Finance)", url: `https://finance.yahoo.com/quote/${state.ticker}/key-statistics` }],
  };
}

// ---------------------------------------------------------------------------
// Node 2b: technical analyst — real computed price indicators.
// ---------------------------------------------------------------------------
export async function technicalAnalystNode(state) {
  const data = await getTechnicals(state.ticker);
  if (!data) {
    return {
      technicalsData: null,
      technicalReport:
        "No sufficient price history could be retrieved for this ticker. Treat this as a gap, not a positive or negative signal.",
    };
  }
  const report = await askLLM(
    TECHNICAL_PROMPT,
    `Company: ${state.companyLongName} (${state.ticker})\nIndicators (JSON):\n${JSON.stringify(data, null, 2)}`
  );
  return {
    technicalsData: data,
    technicalReport: report,
    sources: [{ label: "Price history (Yahoo Finance)", url: `https://finance.yahoo.com/quote/${state.ticker}/chart` }],
  };
}

// ---------------------------------------------------------------------------
// Node 2c: sentiment analyst — real recent news via Tavily search.
// ---------------------------------------------------------------------------
export async function sentimentAnalystNode(state) {
  const articles = await searchCompanyNews(state.companyLongName, state.ticker);
  if (articles.length === 0) {
    return {
      newsData: [],
      sentimentReport:
        "No live news could be retrieved (TAVILY_API_KEY missing or search failed). Treat sentiment as unknown rather than neutral.",
    };
  }
  const articlesText = articles
    .map((a, i) => `${i + 1}. "${a.title}" (${a.url})\n${a.content}`)
    .join("\n\n");
  const report = await askLLM(
    SENTIMENT_PROMPT,
    `Company: ${state.companyLongName} (${state.ticker})\nRecent articles:\n${articlesText}`
  );
  return {
    newsData: articles,
    sentimentReport: report,
    sources: articles.map((a) => ({ label: a.title, url: a.url })),
  };
}

// ---------------------------------------------------------------------------
// Node 3a/3b: bull and bear researchers debate off the three analyst briefs.
// ---------------------------------------------------------------------------
function briefsBundle(state) {
  return `FUNDAMENTALS BRIEF:\n${state.fundamentalsReport}\n\nTECHNICAL BRIEF:\n${state.technicalReport}\n\nSENTIMENT BRIEF:\n${state.sentimentReport}`;
}

export async function bullResearcherNode(state) {
  const bullCase = await askLLM(BULL_PROMPT, briefsBundle(state), { temperature: 0.4 });
  return { bullCase };
}

export async function bearResearcherNode(state) {
  const bearCase = await askLLM(BEAR_PROMPT, briefsBundle(state), { temperature: 0.4 });
  return { bearCase };
}

// ---------------------------------------------------------------------------
// Node 4: risk manager stress-tests both sides.
// ---------------------------------------------------------------------------
export async function riskManagerNode(state) {
  const riskAssessment = await askLLM(
    RISK_MANAGER_PROMPT,
    `BULL CASE:\n${state.bullCase}\n\nBEAR CASE:\n${state.bearCase}`
  );
  return { riskAssessment };
}

// ---------------------------------------------------------------------------
// Node 5: portfolio manager makes the final, calibrated call.
// ---------------------------------------------------------------------------
export async function portfolioManagerNode(state) {
  const raw = await askLLM(
    PORTFOLIO_MANAGER_PROMPT,
    `FUNDAMENTALS BRIEF:\n${state.fundamentalsReport}\n\nTECHNICAL BRIEF:\n${state.technicalReport}\n\nSENTIMENT BRIEF:\n${state.sentimentReport}\n\nBULL CASE:\n${state.bullCase}\n\nBEAR CASE:\n${state.bearCase}\n\nRISK ASSESSMENT:\n${state.riskAssessment}`,
    { temperature: 0.1 }
  );

  let decision;
  try {
    // 1. Remove markdown fences (case-insensitive)
    let cleaned = raw.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
    
    const startIdx = cleaned.indexOf('{');
    if (startIdx === -1) throw new Error("No JSON object found in response");
    
    let jsonStr = cleaned.substring(startIdx);
    let lastBraceIdx = jsonStr.lastIndexOf('}');
    let parsed = false;
    
    // Iteratively try to parse by shrinking from the last '}'
    while (lastBraceIdx !== -1) {
      try {
        const attempt = jsonStr.substring(0, lastBraceIdx + 1);
        // Clean up common JSON errors like trailing commas
        const sanitized = attempt.replace(/,\s*([\]}])/g, '$1');
        decision = JSON.parse(sanitized);
        parsed = true;
        break;
      } catch (e) {
        lastBraceIdx = jsonStr.lastIndexOf('}', lastBraceIdx - 1);
      }
    }
    
    if (!parsed) throw new Error("Could not parse JSON object");
  } catch (err) {
    decision = {
      verdict: "Watch",
      confidence: 30,
      reasoning:
        "The portfolio manager's output could not be parsed as structured JSON, so this is a safe-default fallback. See raw model output for the actual synthesis.",
      keyRisks: ["Model output parsing failed"],
      whatWouldChangeOurMind: "A successfully parsed, structured decision on a re-run.",
      rawOutput: raw,
    };
  }

  return { decision };
}
