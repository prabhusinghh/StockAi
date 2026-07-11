import { buildResearchGraph, NODE_LABELS } from "../../../lib/agents/graph.js";

export const runtime = "nodejs"; // LangChain/Anthropic SDKs need the Node runtime, not Edge.
export const maxDuration = 60; // Prevent Vercel Hobby tier from timing out (default is 15s)

function sseEvent(payload) {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

// Which state keys are worth pushing to the UI for a given node, and how to
// label them. Keeps the route from dumping raw internal data (like full
// price history arrays) into the stream.
const NODE_OUTPUT_KEYS = {
  resolveTicker: ["ticker", "companyLongName", "tickerMatched", "quoteData"],
  fundamentals: ["fundamentalsReport", "fundamentalsData"],
  technical: ["technicalReport", "technicalsData"],
  sentiment: ["sentimentReport", "newsData"],
  bull: ["bullCase"],
  bear: ["bearCase"],
  riskManager: ["riskAssessment"],
  portfolioManager: ["decision"],
};

export async function POST(req) {
  let companyInput;
  try {
    const body = await req.json();
    companyInput = (body?.company ?? "").trim();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
  }

  if (!companyInput) {
    return new Response(JSON.stringify({ error: "Missing 'company' in request body" }), {
      status: 400,
    });
  }

  const graph = buildResearchGraph();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const push = (payload) => controller.enqueue(encoder.encode(sseEvent(payload)));
      let finalState = {};
      let dedupedSources = [];

      try {
        push({ type: "started", company: companyInput });

        const graphStream = await graph.stream(
          { companyInput },
          { streamMode: "updates" }
        );

        for await (const chunk of graphStream) {
          // `chunk` looks like { [nodeName]: partialState }
          for (const [nodeName, partialState] of Object.entries(chunk)) {
            finalState = { ...finalState, ...partialState };
            if (partialState.sources) {
              dedupedSources = dedupedSources.concat(partialState.sources);
            }

            const keysToSend = NODE_OUTPUT_KEYS[nodeName] ?? [];
            const output = {};
            for (const key of keysToSend) {
              if (partialState[key] !== undefined) output[key] = partialState[key];
            }

            push({
              type: "node_update",
              node: nodeName,
              label: NODE_LABELS[nodeName] ?? nodeName,
              output,
            });
          }
        }

        // De-duplicate sources by URL for the final citation list.
        const seen = new Set();
        const uniqueSources = dedupedSources.filter((s) => {
          if (!s?.url || seen.has(s.url)) return false;
          seen.add(s.url);
          return true;
        });

        push({
          type: "complete",
          decision: finalState.decision,
          sources: uniqueSources,
        });
      } catch (err) {
        console.error("[api/research] graph run failed:", err);
        push({ type: "error", message: err.message || "Unknown error running the research graph." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
