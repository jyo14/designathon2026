# Design system

## Tone
- Premium creative studio energy — think Mem meets Linear
- Honest, occasionally dryly funny
- Microcopy sounds like a thoughtful friend, not enterprise SaaS
- Clean and spacious for young designers — energetic but never cluttered

## Sample microcopy voice
- ✅ "Nothing here yet. Paste something and we'll figure out where it goes."
- ✅ "Today's brief — generated 3 minutes ago."
- ✅ "Ready to surface what matters today."
- ❌ "Welcome! Start by adding your first capture to your knowledge base."
- ❌ "Great job! You're making progress!"

## Color tokens

```css
/* Backgrounds */
--bg: #F8F7F4;              /* warm off-white — body background */
--surface: #FFFFFF;         /* card surfaces */
--surface-2: #F2F1ED;       /* subtle differentiation, chip backgrounds */
--surface-hover: #ECEAE5;   /* hover state for surface-2 elements */

/* Text */
--text-primary: #141413;
--text-secondary: #5C5B55;
--text-tertiary: #9C9B95;

/* Accent (deep forest green) */
--accent: #1B4D3E;
--accent-hover: #163D31;
--accent-soft: #E3EDE9;     /* badge backgrounds, focus rings */
--accent-foreground: #FFFFFF;

/* Structure */
--border: #E8E7E3;
--divider: #F0EFE9;

/* Shadows */
--shadow-sm: 0 1px 3px rgba(20,20,19,0.06), 0 1px 2px rgba(20,20,19,0.04);
--shadow-md: 0 4px 12px rgba(20,20,19,0.08), 0 2px 4px rgba(20,20,19,0.04);

/* Label chip colors — muted, premium */
--label-uipattern-bg: #EEF2FF;
--label-uipattern-text: #3730A3;
--label-portfolionotes-bg: #FEF3C7;
--label-portfolionotes-text: #92400E;
--label-studymaterial-bg: #EFF6FF;
--label-studymaterial-text: #1D4ED8;
--label-designinspiration-bg: #FDF2F8;
--label-designinspiration-text: #9D174D;
--label-designdecisions-bg: #F5F3FF;
--label-designdecisions-text: #5B21B6;
--label-interviewprep-bg: #F0FDFA;
--label-interviewprep-text: #115E59;
```

## Typography

- **Body / UI**: Plus Jakarta Sans, system-ui fallback (weights: 400, 500, 600)
- **Mono (timestamps, source URLs, labels, section headers)**: JetBrains Mono, ui-monospace fallback (weights: 400, 500)

Next.js font variables: `--font-pjs` (sans), `--font-jetbrains` (mono)

Type scale (px):
- Display / date hero: 28 (600 weight)
- H1 / page title: 24 (600)
- H2 / section: 18 (600)
- Body: 15 (400)
- UI / card body: 14 (400–500)
- Small / card secondary: 13 (400)
- Chip / meta: 11–12 (500 mono)
- Section label: 11 mono, uppercase, letter-spacing 0.1em

## Spacing

4px base unit. Scale: 4, 8, 12, 16, 24, 32, 48, 64.

Major section gaps: 32px (mb-8).
Content max-width: 720px, centered. Page padding: 24px horizontal.

## Radii

Cards: 12px. Form expanded: 16px. Buttons: 8px. Chips: 999px (pill). Dropdown rows: 10px. Section rows: 8px.

## Shadows

- `shadow-sm` on card hover, expanded form container
- `shadow-md` on dropdowns and modals

## Header

Sticky at top, full-width. Height: 56px (h-14). Background: white. Bottom border: 1px var(--border).

Left: "Wick" wordmark (18px, 600 weight) + "AI structures. You write." badge pill (11px mono, accent-soft bg, accent text).

Right: tab navigation — "Brief" and "Portfolio". Active tab: accent color text + 2px bottom border underline, 600 weight. Inactive: text-secondary, hover text-primary.

## Button system

Primary: bg-accent, text-white, font-semibold (600), 8px radius, px-5 py-2. Hover: bg-accent-hover.
Secondary: bg-surface-2, text-text-secondary. Hover: bg-surface-hover.
Ghost / text: text-text-secondary. Hover: text-text-primary.
Danger: bg-red-50, text-red-600. Hover: bg-red-100.

All buttons: transition-colors duration-150.

## Capture form

Collapsed: full-width dashed border row (12px radius), centered "+" + text, 14px, text-tertiary. Hover: accent border + text.

Expanded: white card, 16px radius, shadow-sm, 16px padding. Textarea: no border, 15px, placeholder text-tertiary. Source URL: 13px mono below a divider. Actions row: image button (surface-2) left, [⌘↵ hint + Cancel + Save] right. Save = primary button.

## Board headers

Per-label, collapsible. Left: 8px color dot + label name (13px, 600, UPPERCASE, tracking-wider, text-secondary) + count (13px mono, text-tertiary). Right: collapse chevron (text-tertiary, transitions).

## Capture cards

bg-surface, border border-border, 12px radius, px-4 py-3.5. Hover: shadow-sm. Transition: 150ms.

Top row: timestamp (12px mono text-tertiary) + label chip (11px pill, label colors) + ✎ edit on group-hover.
Summary: 14px text-primary, 1.6 line-height, 3-line clamp collapsed.
Themes: 11px mono pill, surface-2 bg, text-secondary.
Source URL: 13px accent color, underline on hover, truncated.
Delete: appears on group-hover, top-right.

## Daily brief

Section label "TODAY'S BRIEF": 11px mono, uppercase, letter-spacing 0.1em, text-tertiary.
Date: 28px, 600 weight, text-primary (e.g. "Thursday, May 28").
Generated time: 12px text-tertiary, right-aligned.

Top 3 cards: 3-column grid (sm+), 1-col mobile. Each: white surface, border, 12px radius, 16px padding. Number: 32px 700 weight text-tertiary. Title: 15px 600 text-primary mt-2. Reasoning: 13px text-secondary.

Connection cards: full width, same card style. Text: 14px 500 text-primary. Chips: surface-2 bg, 6px radius.

Nudge: 3px solid accent-soft left border, 12px/16px padding, 14px italic text-secondary.

## Portfolio page

Same header, sticky. Section label + large date-style heading pattern. Textarea: 15px, 16px radius, white bg. Save button: primary style.

Portfolio title chips: pill, border, surface bg, text-primary.

Gap results: white card, 12px radius, 20px padding. Case study title: 18px 600. Evidence: 13px text-secondary. Structure header: 10px mono uppercase. Section rows: surface-2 bg, 8px radius, 12px/16px padding.

## "AI structures. You write." — placement

Header badge (primary location): 11px mono pill, accent-soft bg, accent text. Always visible.
Also appears: at bottom of each missing case study card in portfolio gap results.

## Accessibility

- All text meets WCAG AA (4.5:1 contrast minimum)
- Focus rings: 2px solid accent-soft, 2px offset (set globally via :focus-visible)
- All interactive elements keyboard-navigable
- Color is never the only signal (labels have text + dot)
- Transitions: 150ms ease on all interactive elements

## Scrollbar

Thin (6px). Track: surface-2. Thumb: text-tertiary, 3px radius.
