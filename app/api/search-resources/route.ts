import { getGroqClient } from '@/lib/llm';
import type { Capture, SearchResult } from '@/lib/types';

function stripFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

type TavilyResult = { title: string; url: string; content: string; score: number };

// ─── Mode: suggest a query from the user's captures ───────────────────────────

async function suggestQuery(captures: Capture[]): Promise<string> {
  const groq = getGroqClient();
  const sample = captures
    .filter((c) => c.label || c.summary)
    .slice(0, 20)
    .map((c) => [
      c.label ? `[${c.label}]` : '',
      c.summary ? c.summary.slice(0, 120) : (c.content ? c.content.slice(0, 120) : ''),
      c.themes?.length ? c.themes.join(', ') : '',
    ].filter(Boolean).join(' — '))
    .join('\n');

  const res = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    temperature: 0.4,
    messages: [
      {
        role: 'system',
        content: 'You generate specific web search queries for UX designers. Return ONLY the search query as plain text — no quotes, no explanation.',
      },
      {
        role: 'user',
        content: `Based on these saved captures, generate ONE specific search query that would find useful UX design resources for what this designer is currently working on:\n\n${sample}`,
      },
    ],
  });

  return res.choices[0]?.message?.content?.trim() ?? '';
}

// ─── Mode: search ─────────────────────────────────────────────────────────────

async function enhanceQuery(query: string): Promise<string> {
  const groq = getGroqClient();
  const res = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content: 'You are a search query optimizer for UX designers. Enhance the query to find high-quality design resources, case studies, and references. Return ONLY the enhanced search query as a plain string. Keep it under 15 words.',
      },
      {
        role: 'user',
        content: `Enhance for UX/product design search: "${query}"`,
      },
    ],
  });
  return res.choices[0]?.message?.content?.trim() ?? query;
}

async function enrichResults(results: TavilyResult[], originalQuery: string): Promise<string[]> {
  if (results.length === 0) return [];
  const groq = getGroqClient();
  const list = results
    .map((r, i) => `${i + 1}. "${r.title}" — ${r.content?.slice(0, 100) ?? ''}`)
    .join('\n');

  const res = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Return a JSON object: { "reasons": ["string", ...] } — exactly ${results.length} strings. Each: one sentence max 12 words explaining why the resource helps a UX designer.`,
      },
      {
        role: 'user',
        content: `Designer is researching: "${originalQuery}"\n\nResources:\n${list}\n\nReturn ${results.length} one-sentence reasons.`,
      },
    ],
  });

  try {
    const parsed = JSON.parse(stripFences(res.choices[0]?.message?.content ?? '{}')) as { reasons?: string[] };
    return parsed.reasons ?? results.map(() => '');
  } catch {
    return results.map(() => '');
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json() as
      | { mode: 'suggest'; captures: Capture[] }
      | { query: string };

    // Suggest query from captures
    if ('mode' in body && body.mode === 'suggest') {
      const suggestedQuery = await suggestQuery(body.captures ?? []);
      return Response.json({ suggestedQuery });
    }

    // Search mode
    const { query } = body as { query: string };
    if (!query?.trim()) return Response.json(null, { status: 400 });

    const tavilyKey = process.env.TAVILY_API_KEY;
    if (!tavilyKey) {
      return Response.json(
        { error: 'Search unavailable — TAVILY_API_KEY not configured' },
        { status: 503 }
      );
    }

    // Step 1: enhance query
    const enhancedQuery = await enhanceQuery(query);

    // Step 2: Tavily search
    const tavilyRes = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: tavilyKey,
        query: enhancedQuery,
        search_depth: 'basic',
        max_results: 8,
        include_domains: [
          'medium.com', 'nngroup.com', 'uxdesign.cc',
          'smashingmagazine.com', 'figma.com',
          'behance.net', 'dribbble.com', 'alistapart.com',
          'uxplanet.org', 'lawsofux.com', 'youtube.com',
          'interaction-design.org', 'usertesting.com',
        ],
      }),
    });

    if (!tavilyRes.ok) throw new Error(`Tavily ${tavilyRes.status}`);

    const tavilyData = await tavilyRes.json() as { results?: TavilyResult[] };
    const raw = tavilyData.results ?? [];

    // Step 3: enrich with Groq (single batched call)
    const reasons = await enrichResults(raw, query);

    const results: SearchResult[] = raw.map((r, i) => ({
      title: r.title,
      url: r.url,
      snippet: r.content ?? '',
      domain: extractDomain(r.url),
      why_relevant: reasons[i] ?? '',
      score: r.score ?? 0,
    }));

    return Response.json({ results, query, enhancedQuery });
  } catch (err) {
    console.error('[/api/search-resources]', err);
    return Response.json({ error: 'Search failed. Try again.' }, { status: 500 });
  }
}
