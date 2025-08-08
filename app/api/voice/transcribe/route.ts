import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge"; // low-latency STT

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("audio");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }

  // Send to OpenAI Whisper (or Realtime STT HTTP)
  // Using OpenAI speech-to-text API (whisper-1 or newer):
  // As OpenAI Edge requires proper fetch construction without SDK in edge runtime.

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });

  const formOut = new FormData();
  formOut.append("file", file, file.name);
  formOut.append("model", "whisper-1");
  formOut.append("response_format", "json");

  const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formOut,
  });

  if (!resp.ok) {
    const t = await resp.text();
    return NextResponse.json({ error: t }, { status: 500 });
  }

  const data = await resp.json();
  return NextResponse.json({ text: data.text ?? "" });
}
