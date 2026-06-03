import { getGroqClient } from '@/lib/llm';
import type { ResourceSuggestion } from '@/lib/types';

function stripFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
}

export async function POST(request: Request) {
  try {
    const { theme, suggested_title } = await request.json() as {
      theme: string;
      suggested_title: string;
    };

    const groq = getGroqClient();
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You suggest research resources for designers writing case studies. Return a JSON object with a "suggestions" array of exactly 3 items. Each item must have: type (one of: article, book, talk, framework), search_query (a specific, Googleable search query string), why_it_helps (one sentence). Be specific and practical — avoid generic advice.',
        },
        {
          role: 'user',
          content: `A designer is writing a case study titled "${suggested_title}" (theme: ${theme}). They have limited existing material. Suggest 3 specific resources to strengthen this case study.`,
        },
      ],
    });

    const text = response.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(stripFences(text)) as { suggestions?: unknown };
    const suggestions: ResourceSuggestion[] = Array.isArray(parsed.suggestions)
      ? (parsed.suggestions as ResourceSuggestion[]).slice(0, 3)
      : [];

    return Response.json({ suggestions });
  } catch (err) {
    console.error('[/api/find-references]', err);
    return Response.json({ suggestions: [] });
  }
}
