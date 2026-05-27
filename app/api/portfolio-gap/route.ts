import { getGeminiClient } from '@/lib/gemini';
import { withRetry } from '@/lib/retry';
import type { Capture, MissingCaseStudy, PortfolioGapResult, StaleCaseStudy } from '@/lib/types';

const PROMPT_TEMPLATE = `You are a portfolio gap analyst for a designer's personal knowledge system. You do NOT write any portfolio prose. Ever.

--- CRITICAL DISTINCTION — Read carefully before analyzing ---
- Captures with label "Portfolio Notes" or "Design Decisions" are about the USER'S OWN work. These are the strongest signals for missing portfolio pieces.
- Captures that have a Project field name a real project the user worked on. These are strong candidates for missing case studies.
- Captures with label "UI Pattern", "Study Material", or "Design Inspiration" from external sources (other apps, articles, Pinterest, Behance) are REFERENCE MATERIAL — the user saved them to learn from, not because they built them. Do NOT suggest case studies based on external references alone.
- Only suggest a missing case study when: (a) multiple captures share a project name that isn't in the portfolio, OR (b) multiple Portfolio Notes or Design Decisions cluster around a theme not in the portfolio, OR (c) Study Material captures cluster around a theme the user's existing portfolio work touches but doesn't fully address.
- NEVER say "make a case study about this app you screenshotted." The user didn't build that app.

Given:
- The user's current portfolio (list of case study titles)
- All their captures (with IDs, labels, themes, summaries)

Identify and return:
1. Missing case studies: themes the user has captured heavily but has no portfolio piece for
2. Stale case studies: existing portfolio pieces that new captures could strengthen

Rules:
- Return at most 3 missing case studies (most compelling first)
- Return at most 2 stale case studies
- suggested_title must be specific: "Designing voice UX for low-literacy users" NOT "Voice UX case study"
- gap_suggestion describes a TYPE of content to document — never words to write. Set to null if mapped_captures is non-empty for that section.
- staleness_reason is one sentence max
- If fewer than 10 captures exist, return empty arrays for both
- skeleton must always have exactly 5 sections in this order: "Problem", "Discovery & Research", "Process", "Solution", "Outcome & Reflection"
- Only reference capture IDs that appear in the data. Never invent IDs.
- You are a librarian and analyst. Structure only. No prose generation.

Evidence threshold — apply strictly:
- Only suggest a missing case study if there are AT LEAST 3 captures pointing at the same theme or project.
- A single capture with a project_hint is NOT enough evidence on its own — ignore it.
- Captures labeled "Portfolio Notes" or "Study Material" about generic productivity/documentation topics (e.g. "add live links to portfolio", "document your work", "update case study") are reminders, not projects. NEVER treat them as evidence of a missing case study.
- If you cannot find strong evidence (3+ captures, same theme or project), return empty arrays. An empty honest result is better than a confusing fabricated one.
- When in doubt, return nothing.

Portfolio title matching:
- Matching must be EXACT or near-exact. "FUD-V4.0" and "FAB Learning" / "Family and Business Learning" are completely different projects — do NOT match them.
- If a capture's project_hint does not clearly correspond to a portfolio title (same name or obvious abbreviation of the same name), treat that capture as belonging to an UNLISTED project, not an existing portfolio item.
- When in doubt, treat them as different projects.

Portfolio titles:
{PORTFOLIO_TITLES}

Captures:
{CAPTURES}

Return ONLY a valid JSON object with this exact shape:
{
  "missing_case_studies": [...],
  "stale_case_studies": [...]
}
No markdown fences, no prose outside the JSON.`;

function formatCapture(c: Capture): string {
  return [
    `ID: ${c.id}`,
    `Label: ${c.label ?? 'uncategorized'}`,
    c.summary ? `Summary: ${c.summary}` : (c.content ? `Content: ${c.content.slice(0, 200)}` : ''),
    c.themes?.length ? `Themes: ${c.themes.join(', ')}` : '',
    c.project_link ? `Project: ${c.project_link}` : '',
    `Saved: ${c.captured_at}`,
  ].filter(Boolean).join(' | ');
}

function stripFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
}

function validateResult(raw: unknown): Omit<PortfolioGapResult, 'generated_at'> {
  const obj = (raw ?? {}) as Record<string, unknown>;
  return {
    missing_case_studies: Array.isArray(obj.missing_case_studies)
      ? (obj.missing_case_studies as MissingCaseStudy[])
      : [],
    stale_case_studies: Array.isArray(obj.stale_case_studies)
      ? (obj.stale_case_studies as StaleCaseStudy[])
      : [],
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      portfolio_titles: string[];
      captures: Capture[];
    };
    const { portfolio_titles, captures } = body;

    if (!captures || captures.length === 0) {
      return Response.json(null, { status: 400 });
    }

    const prompt = PROMPT_TEMPLATE
      .replace('{PORTFOLIO_TITLES}', portfolio_titles.length > 0
        ? portfolio_titles.map((t, i) => `${i + 1}. ${t}`).join('\n')
        : '(none — identify what the user should document based on their own work captures)')
      .replace('{CAPTURES}', captures.map(formatCapture).join('\n'));

    const ai = getGeminiClient();

    let attemptNum = 0;

    const result = await withRetry(async () => {
      attemptNum++;
      console.log(`[/api/portfolio-gap] Attempt ${attemptNum}`);

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          temperature: 0.3,
        },
      });

      const text = response.text;
      if (!text) throw new Error('empty Gemini response');

      const parsed = JSON.parse(stripFences(text)) as unknown;
      return validateResult(parsed);
    }, { maxAttempts: 4, baseDelayMs: 2000 });

    const gapResult: PortfolioGapResult = { ...result, generated_at: new Date().toISOString() };

    return Response.json(gapResult);
  } catch (err) {
    console.error('[/api/portfolio-gap]', err);
    return Response.json(null, { status: 500 });
  }
}
