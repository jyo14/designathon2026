# Design system

## Tone
- Slightly self-aware, never corporate
- Honest, occasionally dryly funny
- Microcopy should sound like a thoughtful friend, not an enterprise SaaS

## Sample microcopy voice
- ✅ "Nothing here yet. Paste something and we'll figure out where it goes."
- ✅ "Today's brief — generated 3 minutes ago."
- ❌ "Welcome! Start by adding your first capture to your knowledge base."

## Color tokens (starter — designer will refine)
```css
--bg: #FAFAF7;         /* warm off-white background */
--surface: #FFFFFF;    /* card surfaces */
--surface-2: #F4F2EC;  /* subtle differentiation */
--text-primary: #1A1A1A;
--text-secondary: #6B6B6B;
--text-tertiary: #9A9A9A;
--accent: #2D5F4E;     /* deep green — placeholder, refine */
--accent-soft: #E8F0EC;
--border: #E5E5E0;
--divider: #EFEFEA;

/* Label chip colors — one per category */
--label-uipattern: #6366F1;
--label-casestudy: #EA580C;
--label-research: #0891B2;
--label-inspiration: #DB2777;
--label-decision: #7C2D12;
--label-todo: #B45309;
```

## Typography
- **Body / UI**: Inter, system-ui fallback
- **Display (Page 1 hero, brief headings)**: Inter Display or fallback to Inter at 600 weight
- **Mono (timestamps, source URLs, labels)**: JetBrains Mono, ui-monospace fallback

Type scale (px):
- Hero: 40 / Display: 32 / H1: 24 / H2: 20 / Body: 15 / Small: 13 / Mono: 12

## Spacing
4px base unit. Scale: 4, 8, 12, 16, 24, 32, 48, 64.

## Radii
Cards: 12px. Buttons: 8px. Chips: 999px (pill).

## Layout principles
- The daily brief is the home screen. Capture is one tap from there, not the landing page.
- Single-column on mobile, max-width 720px on desktop.
- Generous whitespace. The product should feel quiet, not dense.
- Empty states are first-class — they should have personality and direct the user.

## "AI structures. You write." — where this lives in the UI
- As a small tag below the app name in the header, OR
- As the empty state message on the portfolio mapping page, OR
- As a tooltip on the AI-generated section of the daily brief

Pick one. Make it visible. Don't bury it in a settings page.

## Accessibility
- All text meets WCAG AA (4.5:1 contrast minimum)
- Focus rings visible
- All interactive elements keyboard-navigable
- Color is never the only signal (labels also have icons or text)