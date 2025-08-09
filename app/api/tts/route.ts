import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { text, lang } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Missing 'text' string" }, { status: 400 });
    }

    const language = lang === "ru" ? "ru" : "en";

    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = language === "ru"
      ? (process.env.ELEVENLABS_VOICE_ID_RU || process.env.ELEVEN_VOICE_ID_RU)
      : (process.env.ELEVENLABS_VOICE_ID_EN || process.env.ELEVEN_VOICE_ID_EN);

    if (!apiKey) {
      return NextResponse.json({ error: "Missing ELEVENLABS_API_KEY" }, { status: 500 });
    }
    if (!voiceId) {
      return NextResponse.json({ error: `Missing voice id for lang=${language} (ELEVENLABS_VOICE_ID_EN|ELEVEN_VOICE_ID_EN / ELEVENLABS_VOICE_ID_RU|ELEVEN_VOICE_ID_RU)` }, { status: 500 });
    }

    const elevenUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

    const payload = {
      text,
      model_id: "eleven_turbo_v2_5", // robust, recommended; good EN/RU
      output_format: "mp3_44100_128", // standard, widely supported
      // Optional: fine-tune delivery; tweak if needed in the future
      // voice_settings: {
      //   stability: 0.5,
      //   similarity_boost: 0.9,
      //   style: 0,
      //   use_speaker_boost: true,
      // },
    };

    const ttsResp = await fetch(elevenUrl, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify(payload),
    });

    if (!ttsResp.ok || !ttsResp.body) {
      const ct = ttsResp.headers.get("content-type") || "";
      let details: unknown = null;
      if (ct.includes("application/json")) {
        details = await ttsResp.json().catch(() => null);
      } else {
        const errText = await ttsResp.text().catch(() => "");
        details = errText || null;
      }
      return NextResponse.json(
        { error: "ElevenLabs TTS failed", status: ttsResp.status, details },
        { status: ttsResp.status || 500 }
      );
    }

    const ab = await ttsResp.arrayBuffer();
    return new NextResponse(ab, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
