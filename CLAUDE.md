# Wick — Project instructions for AI coding assistants

## Project overview
Wick is a 4.5-day designathon prototype: a personal capture-and-structure system for designers. Submission deadline: Friday May 30, 2026 by 12 PM IST.

## Read these before any meaningful change
- /docs/PRODUCT.md — vision, problem, stance
- /docs/FEATURES.md — three features being built
- /docs/DESIGN.md — design tokens, voice, accessibility
- /docs/PROMPTS.md — all AI prompts in production
- /docs/JOURNAL.md — daily build log (user maintains)

## The non-negotiable stance
**"AI structures. You write."**
- AI helps the user organize, surface, and structure their saved material
- AI does NOT write the user's case studies, posts, or output content
- This must remain visible inside the product (currently in the header pill)

## Tech stack
- Next.js 14+ (App Router, TypeScript)
- Tailwind CSS v4
- localStorage for all persistence (single-user prototype)
- Google Gemini API (gemini-2.0-flash) via @google/genai SDK
- Environment variable: `GEMINI_API_KEY` in .env.local
- Vercel for deployment (when ready)

## Build philosophy
- Lean toward shipping over engineering — 4.5 days is the hard constraint
- Don't add dependencies unless they meaningfully simplify the build
- localStorage only — no real backend, no auth, no database
- When in doubt, ship the simpler version

## Out of scope (don't suggest building these)
- User accounts / authentication
- Real push notifications
- Search or chat over captures
- Multiple portfolio templates
- Browser extension or mobile app
- Notion / Drive / Figma API integrations

## After every meaningful change
- Note significant prompt iterations in /docs/PROMPTS.md
- Do NOT update /docs/JOURNAL.md yourself — the user maintains that for personal reflection

## Day-by-day scope
- Day 1 (Mon): Capture form + localStorage + AI categorization + board UI
- Day 2 (Tue): Daily brief generation
- Day 3 (Wed): Portfolio gap analysis
- Day 4 (Thu): Polish + case study deck
- Day 5 (Fri AM): Submission

## When stopping work
Always report:
1. What works
2. What's incomplete or buggy
3. Any decisions you need user input on