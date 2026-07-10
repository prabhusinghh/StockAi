import { Annotation } from "@langchain/langgraph";

// Each key is a "channel" LangGraph tracks across the graph run. Plain keys
// get overwritten by whichever node writes them last (fine here, since each
// key is only ever written by one node). `sources` uses a reducer so every
// node that finds a citation-worthy source can append to the same running
// list instead of clobbering it.
export const ResearchState = Annotation.Root({
  // ---- input ----
  companyInput: Annotation(),

  // ---- resolved identity ----
  ticker: Annotation(),
  companyLongName: Annotation(),
  tickerMatched: Annotation(),
  quoteData: Annotation(),

  // ---- analyst outputs (raw data + LLM read) ----
  fundamentalsData: Annotation(),
  fundamentalsReport: Annotation(),

  technicalsData: Annotation(),
  technicalReport: Annotation(),

  newsData: Annotation(),
  sentimentReport: Annotation(),

  // ---- debate ----
  bullCase: Annotation(),
  bearCase: Annotation(),

  // ---- risk + final decision ----
  riskAssessment: Annotation(),
  decision: Annotation(),

  sources: Annotation({
    reducer: (existing = [], incoming = []) => existing.concat(incoming),
    default: () => [],
  }),
});
