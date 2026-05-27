# Wick

## One-sentence problem
People like me — designers, learners, serial tab-hoarders, and lifelong bookmarkers — struggle to use anything we've ever saved, because every tool we trust waits for us to do the remembering.

## The stance
**AI structures. You write.**
Structure is the labor everyone underestimates. Words are where voice lives.

## The user
Designers, researchers, students, and indie creators whose work is *making sense of what they've consumed*. They read articles, save Figma references, screenshot UI patterns, write project notes, and produce case studies, portfolio pieces, posts, and applications. Their value compounds when their saved material is reusable. Today it doesn't.

## What this is (and isn't)

**This is:**
- A capture-and-structure system for designer-shaped material
- A daily brief about your saved work and active projects
- A case study structural assistant that suggests placement, not prose

**This is NOT:**
- A generic note-taking app
- An inbox/calendar briefer (that's Gemini Daily Brief's territory)
- A content generator (Mem, UXfolio, Notion AI all do this — we deliberately don't)
- A search index over your notes

## Why we deliberately don't generate output
Every major competitor (Mem, Saner.AI, Notion AI, UXfolio) drafts the user's output for them. We refuse to. When a designer writes a case study, the voice IS the work. We give structure, citations, source material — and stop there.

This is the contrarian position the product is built around. It must be visible in the UI (a label, a tooltip, an empty state — somewhere a user encounters the words "AI structures. You write.").

## Success criteria for the prototype
1. Capture flow takes <5 seconds from intent to saved.
2. Auto-categorization labels are designer-aware, not generic.
3. The daily brief output is concrete and project-aware (not "you saved 5 things").
4. The portfolio mapping produces a real, useful structure for a real case study.
5. The contrarian stance ("AI structures. You write.") is visible inside the product.

## Tech stack
- Next.js 14+ (App Router, TypeScript)
- Tailwind CSS
- localStorage for persistence (single-user prototype)
- Groq API (llama-3.3-70b-versatile)
- Vercel for deployment

## Out of scope for the 4.5-day prototype
- User accounts / authentication
- Real push notifications (the daily brief is an in-app screen)
- Multiple portfolio templates (one template only — the case study)
- Search / chat over captures
- Browser extension / mobile app
- Notion / Drive / Figma API integrations (URLs are stored as strings, not parsed)
