import { ChatGroq } from "@langchain/groq";

/**
 * One factory for every agent node so the whole graph shares model choice,
 * retry policy, and API-key wiring in one place.
 *
 * Using Groq API here.
 *
 * temperature is exposed per-call because we want the analyst nodes (reading
 * numbers, summarizing) to be low-temperature/deterministic, while the
 * bull/bear debate nodes benefit from slightly higher temperature to produce
 * genuinely distinct, forceful arguments.
 */
export function getLLM({ temperature = 0.2 } = {}) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error(
      "GROQ_API_KEY is not set. Add your Groq API key to your .env / .env.local file."
    );
  }
  return new ChatGroq({
    model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    temperature,
    maxTokens: 1024,
    apiKey: process.env.GROQ_API_KEY,
  });
}
