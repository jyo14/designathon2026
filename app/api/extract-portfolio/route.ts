import { getGroqClient } from '@/lib/llm';

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8000);
}

function stripFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
}

export async function POST(request: Request) {
  try {
    const { url } = await request.json() as { url: string };
    if (!url || !url.startsWith('http')) {
      return Response.json({ titles: [] });
    }

    const fetchRes = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Wick/1.0; portfolio-reader)' },
      signal: AbortSignal.timeout(10000),
    });
    if (!fetchRes.ok) throw new Error(`fetch ${fetchRes.status}`);

    const html = await fetchRes.text();
    const pageText = stripHtml(html);

    const groq = getGroqClient();
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'Extract all project or case study titles from the portfolio page text provided. Return ONLY a JSON object: {"titles": ["Title 1", "Title 2"]}. Include only the project names exactly as they appear — no descriptions, no URLs. If nothing found, return {"titles": []}.',
        },
        {
          role: 'user',
          content: `Portfolio page text:\n\n${pageText}`,
        },
      ],
    });

    const text = response.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(stripFences(text)) as { titles?: unknown };
    const titles = Array.isArray(parsed.titles)
      ? (parsed.titles as unknown[]).filter((t): t is string => typeof t === 'string')
      : [];

    return Response.json({ titles });
  } catch (err) {
    console.error('[/api/extract-portfolio]', err);
    return Response.json({ titles: [] });
  }
}
