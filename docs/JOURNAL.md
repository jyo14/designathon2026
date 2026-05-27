# Build journal

One entry per day. Optional in-day entries for moments worth capturing. Raw material for the final PDF, especially Pages 4 (where AI helped) and 5 (where I overruled AI).

---

## Day 1 — Mon May 26

**What I built today:**
-Technically, today moved way faster than expected.

I scaffolded the entire stack:

Next.js
TypeScript
Tailwind
Gemini integration
/docs system
localStorage persistence

By the end of the day, Wick could:

capture links/text/images
auto-categorize them with designer-specific labels
organize them into semantic boards
generate a daily brief with patterns + connections + nudges

**Where Claude Code helped:**
-I have used claude to quickly run a competitor search. 
And a kickstart on building the folder structure in vs code

**Where I overruled Claude / had to push back:**
- 

**Prompt iterations:**
-

**Decisions made:**
-"AI surfaced a UX gap I'd missed (intermittent failures), then designed and shipped the fix.
Tested with a judge's mindset: if they click Retry twice and it fails, they leave. Added auto-retry to both API endpoints. Then realized the principle was bigger — went looking for every other moment where the demo could feel fragile (empty states, pre-generated briefs, error paths). This was AI helping me think like an engineer; the override was insisting AI didn't surface this gap on its own — I had to imagine the judge's experience and walk back to the implementation."
**Tomorrow's top priority:**
-

---

## Day 2 — Tue May 27
"Portfolio gap analysis v1 had a fundamental logic bug: AI treated external UI references (other apps I screenshotted) as my own projects and suggested case studies for them. The root cause: prompt didn't distinguish 'I built this' vs 'I saved this as reference.' Fixed by adding CRITICAL DISTINCTION section to prompt. Classic example of AI being too literal — it saw Figma files and screenshots and assumed they were all my work."

---

## Day 3 — Wed May 28

[Repeat structure]

---

## Day 4 — Thu May 29

[Repeat structure]

---

## Day 5 — Fri May 30 (submission)

[Repeat structure]