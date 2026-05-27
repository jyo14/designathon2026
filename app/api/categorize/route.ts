import { Type } from '@google/genai';
import { getGeminiClient } from '@/lib/gemini';
import { withRetry } from '@/lib/retry';
import type { CaptureLabel } from '@/lib/types';

const VALID_LABELS: CaptureLabel[] = [
  'UI Pattern',
  'Portfolio Notes',
  'Study Material',
  'Design Inspiration',
  'Design Decisions',
  'Interview Prep',
];

// Prompt 1 — logged in /docs/PROMPTS.md
const PROMPT_TEMPLATE = `You are a categorization assistant for Wick, a designer's personal knowledge capture system.

A designer has saved the following content. Classify it with a label, a short summary, and 2–4 theme tags.

--- CONTENT ---
{CONTENT}
{SOURCE_LINE}

--- LABEL DEFINITIONS (pick exactly one) ---
- UI Pattern: A complete UI design, component, interaction pattern, screen, or flow worth referencing for how something is built or designed. Includes Figma links, Behance/Dribbble designs, component libraries, full app screen references.
- Portfolio Notes: Notes, observations, reflections, and process documentation from the user's OWN design projects. Also covers action items and reminders about updating their design portfolio. If it's about work they've done or want to document, it goes here.
- Study Material: Any content the user is consuming to get smarter — articles, YouTube videos, podcasts, design talks, tutorials, blog posts, tool guides. If you're watching or reading it to learn, it goes here.
- Design Inspiration: Element-level visual references used to define mood and direction before designing — color palettes, typography pairings, layout grids, moodboard images, aesthetic references. Sites like Coolors, Google Fonts, Awwwards, Palettable. NOT complete UI designs — those are UI Pattern.
- Design Decisions: A specific design judgement, rationale, trade-off, constraint, or chosen direction. The reasoning behind a design choice, big or small.
- Interview Prep: Interview questions, job preparation notes, STAR format answers, company research, questions to ask interviewers, career conversation guides.

--- INSTRUCTIONS ---
1. label: Choose the single best label from the list above
2. summary: 1–2 specific sentences about what this is and why a designer would care. Be concrete — mention specifics from the content.
3. themes: 2–4 short, lowercase, hyphenated theme tags from UX/product design vocabulary. Examples: conversation-design, error-states, visual-hierarchy, mobile-patterns, accessibility, information-architecture, design-systems, user-research, onboarding, navigation
4. project_hint: If the content explicitly names a specific project by name, return that project name as a string. Otherwise omit this field.
5. If the user has added a short annotation like "save this as [category name]" or "file this under [topic]", treat it as a strong hint about how to classify — use it to inform the label and themes. If the suggested category doesn't match any label exactly, use the closest label and include the user's suggested category as a theme tag.
6. If content contains interview questions, job prep notes, or the user's annotation mentions 'interview prep' or 'interview questions', label it as 'Interview Prep'.

Return valid JSON only. No markdown fences, no prose outside the JSON object.`;

function buildPrompt(content: string, sourceUrl?: string): string {
  const sourceLine = sourceUrl ? `--- SOURCE URL ---\n${sourceUrl}` : '';
  return PROMPT_TEMPLATE
    .replace('{CONTENT}', content || '(no text content — classify based on image if provided)')
    .replace('{SOURCE_LINE}', sourceLine);
}

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      content?: string;
      source_url?: string;
      image_data_url?: string;
    };

    const { content = '', source_url, image_data_url } = body;

    const ai = getGeminiClient();

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
      { text: buildPrompt(content, source_url) },
    ];

    if (image_data_url) {
      const parsed = parseDataUrl(image_data_url);
      if (parsed) parts.push({ inlineData: parsed });
    }

    const result = await withRetry(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts }],
        config: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              label: {
                type: Type.STRING,
                enum: VALID_LABELS,
                description: 'One of the 6 valid designer-aware labels',
              },
              summary: {
                type: Type.STRING,
                description: '1–2 specific sentences about what this is and why a designer cares',
              },
              themes: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '2–4 short hyphenated UX/design theme tags',
              },
              project_hint: {
                type: Type.STRING,
                description: 'Project name if explicitly mentioned in content; omit otherwise',
              },
            },
            required: ['label', 'summary', 'themes'],
          },
        },
      });

      const text = response.text;
      if (!text) throw new Error('empty Gemini response');

      return JSON.parse(text) as {
        label: string;
        summary: string;
        themes: string[];
        project_hint?: string;
      };
    });

    if (!VALID_LABELS.includes(result.label as CaptureLabel)) {
      result.label = 'Study Material';
    }

    return Response.json(result);
  } catch (err) {
    console.error('[/api/categorize]', err);
    return Response.json(null, { status: 500 });
  }
}
