import { StateGraph, START, END } from "@langchain/langgraph";
import { ResearchState } from "./state.js";
import {
  resolveTickerNode,
  fundamentalsAnalystNode,
  technicalAnalystNode,
  sentimentAnalystNode,
  bullResearcherNode,
  bearResearcherNode,
  riskManagerNode,
  portfolioManagerNode,
} from "./nodes.js";

/**
 * The committee, as a graph:
 *
 *   START -> resolveTicker
 *   resolveTicker -> fundamentals, technical, sentiment   (fan-out, run in parallel)
 *   fundamentals, technical, sentiment -> bull, bear      (fan-in then fan-out)
 *   bull, bear -> riskManager                             (fan-in)
 *   riskManager -> portfolioManager
 *   portfolioManager -> END
 *
 * LangGraph's Pregel execution model runs all nodes scheduled for the same
 * "superstep" together, so fundamentals/technical/sentiment genuinely execute
 * concurrently (three live API calls + three LLM calls in parallel), and
 * bull/bear each fire exactly once, only after all three analysts finish.
 */
export function buildResearchGraph() {
  const graph = new StateGraph(ResearchState)
    .addNode("resolveTicker", resolveTickerNode)
    .addNode("fundamentals", fundamentalsAnalystNode)
    .addNode("technical", technicalAnalystNode)
    .addNode("sentiment", sentimentAnalystNode)
    .addNode("bull", bullResearcherNode)
    .addNode("bear", bearResearcherNode)
    .addNode("riskManager", riskManagerNode)
    .addNode("portfolioManager", portfolioManagerNode)

    .addEdge(START, "resolveTicker")

    .addEdge("resolveTicker", "fundamentals")
    .addEdge("resolveTicker", "technical")
    .addEdge("resolveTicker", "sentiment")

    .addEdge("fundamentals", "bull")
    .addEdge("technical", "bull")
    .addEdge("sentiment", "bull")

    .addEdge("fundamentals", "bear")
    .addEdge("technical", "bear")
    .addEdge("sentiment", "bear")

    .addEdge("bull", "riskManager")
    .addEdge("bear", "riskManager")

    .addEdge("riskManager", "portfolioManager")
    .addEdge("portfolioManager", END);

  return graph.compile();
}

// Human-readable labels for the SSE stream / UI — keeps the API route and
// frontend decoupled from raw node keys.
export const NODE_LABELS = {
  resolveTicker: "Resolving company & ticker",
  fundamentals: "Fundamentals analyst",
  technical: "Technical analyst",
  sentiment: "Sentiment analyst",
  bull: "Bull researcher",
  bear: "Bear researcher",
  riskManager: "Risk manager",
  portfolioManager: "Portfolio manager (final call)",
};
