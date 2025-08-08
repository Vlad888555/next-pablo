import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });

  // Create a short-lived Realtime session token
  const resp = await fetch("https://api.openai.com/v1/realtime/sessions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-realtime-preview",
      // default voice; client may change it later via session.update over datachannel
      voice: "verse",
      modalities: ["text", "audio"],
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    return NextResponse.json({ error: t }, { status: 500 });
  }

  const data = await resp.json();
  return NextResponse.json(data);
}
