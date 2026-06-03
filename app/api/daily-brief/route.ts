import { getGroqClient } from '@/lib/llm';
import { withRetry } from '@/lib/retry';
import type { Capture, DailyBrief } from '@/lib/types';

const MS_7_DAYS = 7 * 24 * 60 * 60 * 1000;
const MS_5_DAYS = 5 * 24 * 60 * 60 * 1000;

function formatCapture(c: Capture): string {
  return [
    `ID: ${c.id}`,
    `Label: ${c.label ?? 'uncategorized'}`,
    c.summary ? `Summary: ${c.summary}` : (c.content ? `Content: ${c.content.slice(0, 200)}` : ''),
    c.themes?.length ? `Themes: ${c.themes.join(', ')}` : '',
    c.project_link ? `Project: ${c.project_link}` : '',
    `Saved: ${c.captured_at}`,
    `Opened: ${c.is_opened ? 'yes' : 'no'}`,
  ].filter(Boolean).join(' | ');
}

// Prompt 2 — logged in /docs/PROMPTS.md
const SYSTEM_PROMPT = `You are the daily brief engine for Wick, a designer's personal knowledge capture system.

Your job is to surface what matters most from the designer's saved material — not from calendars, not from inboxes. Only from their captures.

--- INSTRUCTIONS ---
Produce a daily brief with exactly three parts:

1. top_3 — exactly 3 items to focus on today:
   - title: Short, specific action or focus (e.g. "Revisit the slot-filling pattern you saved Tuesday")
   - reasoning: 1–2 sentences explaining why this matters today. Reference actual content, not categories.
   - capture_ids: IDs of the specific captures this item is about

   Prioritize: captures relevant to active projects, stalled captures connected to ongoing work, research threads that illuminate a current problem.

2. connections — non-obvious connections between captures:
Find patterns NOT already visible from the boards.

REJECT (do not return as connections):
- "Both captures are in the same category" (boards already show this)
- "Both captures are about [theme]" (themes already show this)
- Restating what each capture says

SEEK (these are real connections):
- Cross-category: a UI Pattern + Study Material that together suggest a project direction
- Latent pattern: multiple captures revealing an emerging interest the user hasn't named
- Project-specific: captures from different categories that all relate to one active project
- Tension or contradiction: a saved opinion that contradicts a saved decision
- Gap recognition: saved material that suggests a missing case study or research thread

For each connection return:
- "description": the insight in ONE sentence naming what the connection REVEALS (not what the captures are about)
- "capture_ids": array of 2–3 IDs being connected

If you cannot find a non-obvious connection, return an empty array. Quality > quantity.

3. nudge — exactly 1 sentence:
   Something quiet and pointed, not motivational. Reference actual content.
   Good: "You saved 4 articles on voice UX this week and opened none of them."
   Bad: "Keep up the great work!" or "You're making progress!"

4. context_line — one sentence summarizing what the designer has been focused on this week.
   Use "you" and "your". Be specific — name actual themes or projects.
   Example: "You've been deep in AI design thinking this week."

VOICE — apply to all text fields:
Write as if speaking directly to the designer. Use "you" and "your" throughout. Reference specific project names, specific capture titles, and specific dates where possible. Do not be generic. If you cannot be specific, do not include the item. The brief should feel like a message from a thoughtful colleague who has read everything you've saved — not a system notification.

Rules:
- Only reference capture IDs that appear in the data above. Never invent IDs.
- Be specific — name actual themes, content, or projects from the data
- If data is sparse, work with what exists — still return exactly 3 top_3 items and a nudge
- The brief surfaces structure only. Do not write case study content.

Return valid JSON only, with this exact shape:
{
  "top_3": [{ "title": "...", "reasoning": "...", "capture_ids": ["id"] }],
  "connections": [{ "description": "...", "capture_ids": ["id1", "id2"] }],
  "nudge": "...",
  "context_line": "..."
}
No markdown fences, no prose outside the JSON.`;

function buildUserMessage(
  recentCaptures: Capture[],
  activeProjects: string[],
  stalledCaptures: Capture[]
): string {
  return [
    '--- CAPTURED MATERIAL (LAST 7 DAYS) ---',
    recentCaptures.length > 0 ? recentCaptures.map(formatCapture).join('\n') : '(none in the last 7 days)',
    '',
    '--- ACTIVE PROJECTS ---',
    activeProjects.length > 0 ? activeProjects.join(', ') : '(no linked projects yet)',
    '',
    '--- STALLED CAPTURES (SAVED OVER 5 DAYS AGO, NEVER OPENED) ---',
    stalledCaptures.length > 0 ? stalledCaptures.map(formatCapture).join('\n') : '(none)',
  ].join('\n');
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { captures: Capture[] };
    const { captures } = body;

    if (!captures || captures.length === 0) {
      return Response.json(null, { status: 400 });
    }

    const now = Date.now();
    const recentCaptures = captures.filter(
      (c) => new Date(c.captured_at).getTime() >= now - MS_7_DAYS
    );
    const activeProjects = [
      ...new Set(captures.map((c) => c.project_link).filter((p): p is string => !!p)),
    ];
    const stalledCaptures = captures.filter(
      (c) => !c.is_opened && new Date(c.captured_at).getTime() <= now - MS_5_DAYS
    );

    const groq = getGroqClient();

    const result = await withRetry(async () => {
      const response = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserMessage(recentCaptures, activeProjects, stalledCaptures) },
        ],
      });

      const text = response.choices[0]?.message?.content;
      if (!text) throw new Error('empty Groq response');

      return JSON.parse(text) as Omit<DailyBrief, 'generated_at'>;
    });

    const brief: DailyBrief = { ...result, generated_at: new Date().toISOString() };

    return Response.json(brief);
  } catch (err) {
    console.error('[/api/daily-brief]', err);
    return Response.json(null, { status: 500 });
  }
}
