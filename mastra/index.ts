import { Mastra } from "@mastra/core/mastra";
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { Memory } from "@mastra/memory";
import { PostgresStore } from "@mastra/pg";

let storage: PostgresStore | undefined;
if (process.env.DATABASE_URL) {
  storage = new PostgresStore({ connectionString: process.env.DATABASE_URL });
}

// Attach memory (uses Mastra storage by default if provided)
const memory = new Memory({});

export const simpleAgent = new Agent({
  name: "simple-agent",
  instructions: "You are a concise assistant.",
  model: openai("gpt-4.1-mini"),
  memory,
});

export const mastra = new Mastra({
  agents: { simpleAgent },
  ...(storage ? { storage } : {}),
});
