import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Auth on node runtime by importing auth() would be ideal, but to keep consistent with others:
  const cookie = req.headers.get("cookie");
  if (!cookie || !cookie.includes("next-auth.session-token")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const { text } = await req.json();
  if (!text || typeof text !== "string") {
    return new Response("Bad request", { status: 400 });
  }

  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return new Response("Missing ELEVENLABS_API_KEY", { status: 500 });

  // Simple ElevenLabs TTS REST call
  // Default voice id can be configured; here we use the "Rachel" voice as example via name
  // For production, resolve a voice ID and reuse it.
  // Simple language detection: if contains Cyrillic - assume Russian
  const isRussian = /[\u0400-\u04FF]/.test(text);
  const voiceName = isRussian ? "Bella" : "Rachel"; // Example: choose different voices
  const modelId = isRussian ? "eleven_multilingual_v2" : "eleven_monolingual_v1";

  const body = {
    text,
    model_id: modelId,
    voice_settings: { stability: 0.5, similarity_boost: 0.5 },
  };

  const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": key,
      Accept: "audio/mpeg",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const t = await resp.text();
    return new Response(t, { status: 500 });
  }

  // Stream audio back to client
  const arr = await resp.arrayBuffer();
  return new Response(Buffer.from(arr), {
    status: 200,
    headers: { "Content-Type": "audio/mpeg" },
  });
}
