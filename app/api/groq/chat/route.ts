// /app/api/groq/chat/route.ts
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: Request) {
  try {
    const { message, lang } = await req.json();

    if (!message || !lang) {
      return new Response(JSON.stringify({ error: "Missing message or lang" }), { status: 400 });
    }

    // Определяем язык ответа
    const language = lang.startsWith("ru") ? "Russian" : "English";
    const availableModel = "llama-3.3-70b-versatile";

    // Запрос без стриминга
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system",
  content: `You are a helpful bilingual assistant who understands both Russian and English.
You must reply in the same mix of languages as the user used in their message.
If the user speaks only Russian — answer fully in Russian using **Cyrillic script**.
If the user speaks only English — answer fully in English using the Latin alphabet.
If the user mixes Russian and English — answer in a natural code-switching style, preserving the same language mix and always using the correct alphabet for each word.`
},


        { role: "user", content: message },
      ],
      model: availableModel,
      temperature: 0.7,
    });

    const text = completion.choices[0]?.message?.content || "";

    return new Response(JSON.stringify({ reply: text }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: "Failed to get response from Groq" }), { status: 500 });
  }
}
