import OpenAI from "openai";

let client: OpenAI | null = null;

/** Server-only singleton — never import this from a "use client" component. */
export function getOpenAIClient(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}
