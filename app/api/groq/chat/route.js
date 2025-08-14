import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req) {
    // const models = await groq.models.list();
    // console.log(models);
  try {
    const { message, lang } = await req.json();

    if (!message || !lang) {
      return new Response(JSON.stringify({ error: 'Missing message or lang' }), { status: 400 });
    }

    const language = lang.startsWith('ru') ? 'Russian' : 'English';

    const availableModel = 'llama-3.3-70b-versatile';
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: `You are a helpful assistant. Always reply in ${language}.` },
        { role: 'user', content: message },
      ],
      model: availableModel,
    });

    const response = completion.choices[0]?.message?.content || '';

    return new Response(JSON.stringify({ response }), { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: 'Failed to get response from Groq' }), { status: 500 });
  }
}
