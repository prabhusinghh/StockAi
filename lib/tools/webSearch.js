import { TavilySearch } from "@langchain/tavily";

/**
 * Fetches recent, real news about a company for the sentiment analyst to
 * ground its read on. Tavily is used because it's the standard LangChain.js
 * web-search tool integration and has a workable free tier for a 7-day project.
 *
 * Returns an array of { title, url, content, publishedDate } — pass this
 * straight into the LLM prompt so every sentiment claim can cite a real
 * article instead of an invented one.
 */
export async function searchCompanyNews(companyName, ticker) {
  if (!process.env.TAVILY_API_KEY) {
    console.warn("[webSearch] TAVILY_API_KEY not set — sentiment analyst will run without live news.");
    return [];
  }

  const tool = new TavilySearch({
    maxResults: 8,
    searchDepth: "advanced",
  });

  const query = `${companyName} (${ticker}) stock news recent earnings outlook risk`;

  try {
    const raw = await tool.invoke({ query });
    // The new TavilySearch returns an object with a results array
    const results = raw?.results ?? [];
    if (!Array.isArray(results) || results.length === 0) return [];
    return results.map((r) => ({
      title: r.title ?? "Untitled",
      url: r.url ?? "",
      content: (r.content ?? "").slice(0, 600),
    }));
  } catch (err) {
    console.error("[webSearch] Tavily search failed:", err.message);
    return [];
  }
}
