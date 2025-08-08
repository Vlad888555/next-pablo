"use server";

import { mastra } from "../../mastra";

export async function askAgent(formData: FormData) {
  const q = formData.get("q")?.toString() ?? "";
  const agent = mastra.getAgent("simpleAgent");
  const res = await agent.generate(q);
  return res.text;
}
