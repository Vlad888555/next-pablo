import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { text } = await req.json();
  if (!text || typeof text !== "string") {
    return new Response("Bad request", { status: 400 });
  }

  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return new Response("Missing ELEVENLABS_API_KEY", { status: 500 });

  // Simple ElevenLabs TTS REST call
  // Default voice id can be configured; here we use the "Rachel" voice as example via name
  // For production, resolve a voice ID and reuse it.
  const body = {
    text,
    model_id: "eleven_monolingual_v1",
    voice_settings: { stability: 0.5, similarity_boost: 0.5 },
  };

  const resp = await fetch("https://api.elevenlabs.io/v1/text-to-speech/Rachel", {
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
