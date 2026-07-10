// Real, live market data via yahoo-finance2 library.
// The library handles Yahoo's crumb/cookie authentication internally.
// If Yahoo ever rate-limits or changes shape, everything here
// fails soft (returns null / empty) so the graph can still produce a report
// that's honest about the gap, instead of crashing.

import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const YF_CHART = "https://query1.finance.yahoo.com/v8/finance/chart";

const UA = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
};

async function safeFetchJson(url) {
  try {
    const res = await fetch(url, { headers: UA, cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error(`[marketData] fetch failed for ${url}:`, err.message);
    return null;
  }
}

/**
 * Resolves a free-text company name (or ticker) to a real, listed ticker
 * symbol using Yahoo's search endpoint. This grounds ticker resolution in
 * an actual lookup instead of letting the LLM guess/hallucinate a symbol.
 */
export async function resolveTicker(companyNameOrTicker) {
  const raw = companyNameOrTicker.toUpperCase().trim();

  try {
    const results = await yf.search(companyNameOrTicker, { quotesCount: 5, newsCount: 0 });
    const quotes = results?.quotes?.filter(
      (q) => q.symbol && (q.quoteType === "EQUITY" || q.isYahooFinance)
    ) ?? [];

    if (quotes.length > 0) {
      const best = quotes[0];
      return {
        ticker: best.symbol,
        longName: best.longname || best.shortname || best.symbol,
        matched: true,
        candidates: quotes.map((q) => ({ symbol: q.symbol, name: q.longname || q.shortname })),
      };
    }
  } catch (err) {
    console.error("[marketData] search failed:", err.message);
  }

  // Fallback: Yahoo search returned nothing useful (common for Indian, some
  // Asian, and smaller-exchange stocks). Try the raw input and common exchange
  // suffixes directly via quoteSummary, which often works even when search
  // doesn't index the ticker.
  const suffixes = ["", ".NS", ".BO", ".L", ".TO", ".AX", ".HK", ".SI", ".KS"];
  for (const suffix of suffixes) {
    const candidate = raw + suffix;
    try {
      const summary = await yf.quoteSummary(candidate, { modules: ["price"] });
      const price = summary?.price;
      if (price && (price.regularMarketPrice ?? price.regularMarketPreviousClose)) {
        console.log(`[marketData] fallback matched: ${candidate}`);
        return {
          ticker: candidate,
          longName: price.longName || price.shortName || candidate,
          matched: true,
          candidates: [{ symbol: candidate, name: price.longName || price.shortName }],
        };
      }
    } catch {
      // Candidate didn't work, try next suffix
    }
  }

  // Nothing worked — return the raw input as a best-effort literal ticker
  return {
    ticker: raw,
    longName: companyNameOrTicker,
    matched: false,
    candidates: [],
  };
}

/**
 * Lightweight quote snapshot — fetches current price, day change, market cap,
 * and exchange info. Fast enough to call during ticker resolution so the UI
 * can render a company header immediately.
 */
export async function getQuickQuote(ticker) {
  try {
    const result = await yf.quoteSummary(ticker, { modules: ["price"] });
    const p = result?.price;
    if (!p) return null;

    const price = p.regularMarketPrice ?? null;
    const prevClose = p.regularMarketPreviousClose ?? null;
    const change = p.regularMarketChange ?? (price && prevClose ? price - prevClose : null);
    const changePct = p.regularMarketChangePercent ??
      (price && prevClose ? (price - prevClose) / prevClose : null);

    return {
      price,
      previousClose: prevClose,
      change: change != null ? Number(change.toFixed(2)) : null,
      changePercent: changePct != null ? Number((changePct * 100).toFixed(2)) : null,
      currency: p.currency ?? null,
      marketCap: p.marketCap ?? null,
      exchange: p.exchangeName ?? p.exchange ?? null,
      quoteType: p.quoteType ?? null,
    };
  } catch (err) {
    console.error("[marketData] getQuickQuote failed:", err.message);
    return null;
  }
}

/**
 * Pulls key fundamentals for a ticker: valuation, profitability, leverage,
 * and cash flow metrics. Returns raw numbers so the LLM analyzes real data
 * instead of inventing plausible-sounding figures.
 */
export async function getFundamentals(ticker) {
  try {
    const result = await yf.quoteSummary(ticker, {
      modules: ["financialData", "defaultKeyStatistics", "summaryDetail", "price"],
    });

    const fd = result.financialData || {};
    const ks = result.defaultKeyStatistics || {};
    const sd = result.summaryDetail || {};
    const price = result.price || {};

    return {
      currency: price.currency ?? null,
      currentPrice: fd.currentPrice ?? price.regularMarketPrice ?? null,
      marketCap: price.marketCap ?? null,
      trailingPE: sd.trailingPE ?? null,
      forwardPE: sd.forwardPE ?? null,
      pegRatio: ks.pegRatio ?? null,
      priceToBook: ks.priceToBook ?? null,
      profitMargins: ks.profitMargins ?? null,
      operatingMargins: fd.operatingMargins ?? null,
      returnOnEquity: fd.returnOnEquity ?? null,
      revenueGrowth: fd.revenueGrowth ?? null,
      earningsGrowth: fd.earningsGrowth ?? null,
      debtToEquity: fd.debtToEquity ?? null,
      currentRatio: fd.currentRatio ?? null,
      freeCashflow: fd.freeCashflow ?? null,
      totalCash: fd.totalCash ?? null,
      totalDebt: fd.totalDebt ?? null,
      recommendationKey: fd.recommendationKey ?? null,
      targetMeanPrice: fd.targetMeanPrice ?? null,
      fiftyTwoWeekHigh: sd.fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: sd.fiftyTwoWeekLow ?? null,
      dividendYield: sd.dividendYield ?? null,
    };
  } catch (err) {
    console.error("[marketData] getFundamentals failed:", err.message);
    return null;
  }
}

/**
 * Pulls ~6 months of daily closes and computes real technical indicators
 * (SMA20/50, RSI14, momentum, 52-week range position, volatility) in JS —
 * these are actual calculations off real price data, not LLM guesses.
 */
export async function getTechnicals(ticker) {
  // The chart endpoint still works without auth
  const url = `${YF_CHART}/${encodeURIComponent(ticker)}?range=6mo&interval=1d`;
  const data = await safeFetchJson(url);
  const result = data?.chart?.result?.[0];
  if (!result) return null;

  const closes = (result.indicators?.quote?.[0]?.close ?? []).filter((c) => c != null);
  if (closes.length < 20) return null;

  const sma = (arr, period) => {
    const slice = arr.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  };

  const rsi = (arr, period = 14) => {
    const slice = arr.slice(-(period + 1));
    if (slice.length < period + 1) return null;
    let gains = 0;
    let losses = 0;
    for (let i = 1; i < slice.length; i++) {
      const diff = slice[i] - slice[i - 1];
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  };

  const stdDevPct = (arr) => {
    const returns = [];
    for (let i = 1; i < arr.length; i++) returns.push((arr[i] - arr[i - 1]) / arr[i - 1]);
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
    return Math.sqrt(variance) * Math.sqrt(252) * 100; // annualized %
  };

  const latest = closes[closes.length - 1];
  const sixMonthAgo = closes[0];
  const high52 = Math.max(...closes);
  const low52 = Math.min(...closes);

  return {
    latestClose: Number(latest.toFixed(2)),
    sma20: Number(sma(closes, 20).toFixed(2)),
    sma50: closes.length >= 50 ? Number(sma(closes, 50).toFixed(2)) : null,
    rsi14: rsi(closes) != null ? Number(rsi(closes).toFixed(1)) : null,
    sixMonthReturnPct: Number((((latest - sixMonthAgo) / sixMonthAgo) * 100).toFixed(2)),
    positionInRangePct: Number((((latest - low52) / (high52 - low52)) * 100).toFixed(1)),
    annualizedVolatilityPct: Number(stdDevPct(closes).toFixed(1)),
    high6mo: Number(high52.toFixed(2)),
    low6mo: Number(low52.toFixed(2)),
    trend: latest > sma(closes, 20) && sma(closes, 20) > (closes.length >= 50 ? sma(closes, 50) : 0)
      ? "uptrend"
      : latest < sma(closes, 20)
      ? "downtrend"
      : "sideways",
  };
}
