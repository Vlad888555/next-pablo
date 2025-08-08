import { NextRequest, NextResponse } from "next/server";
import { mastra } from "@/mastra";
import { requireAuth } from "../_authGuard";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { text } = await req.json();
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "No text" }, { status: 400 });
    }
    const agent = mastra.getAgent("simpleAgent");
    const res = await agent.generate(text);
    return NextResponse.json({ reply: res.text });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "error" }, { status: 500 });
  }
}
