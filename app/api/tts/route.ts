export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text) {
      return new Response(JSON.stringify({ error: "Missing text" }), { status: 400 });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voiceIdEn = process.env.ELEVENLABS_VOICE_ID_EN; // голос для английского
    const voiceIdRu = process.env.ELEVENLABS_VOICE_ID_RU; // голос для русского

    if (!apiKey || !voiceIdEn || !voiceIdRu) {
      console.error("Missing ElevenLabs API key or voice IDs");
      return new Response(JSON.stringify({ error: "Server config missing" }), { status: 500 });
    }

    // Определяем язык по наличию кириллицы
    const isRussian = /[а-яА-ЯёЁ]/.test(text);
    const selectedVoiceId = isRussian ? voiceIdRu : voiceIdEn;

    const elevenRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}`,
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
