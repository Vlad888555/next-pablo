export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text) {
      return new Response(JSON.stringify({ error: "Missing text" }), { status: 400 });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY; // без NEXT_PUBLIC_
    const voiceId = process.env.ELEVENLABS_VOICE_ID;

    if (!apiKey || !voiceId) {
      console.error("Missing ElevenLabs API key or voice ID");
      return new Response(JSON.stringify({ error: "Server config missing" }), { status: 500 });
    }

    const elevenRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );

    if (!elevenRes.ok) {
      const errText = await elevenRes.text();
      console.error("ElevenLabs error:", errText);
      return new Response(JSON.stringify({ error: "TTS failed", details: errText }), { status: 500 });
    }

    const audioBuffer = await elevenRes.arrayBuffer();

    return new Response(audioBuffer, {
      headers: { "Content-Type": "audio/mpeg" },
    });

  } catch (err) {
    console.error("TTS route error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}
