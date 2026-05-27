import type { Capture, DailyBrief, PortfolioGapResult } from './types';

const KEY = 'wick_captures';

function readAll(): Capture[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Capture[];
  } catch {
    return [];
  }
}

function writeAll(captures: Capture[]): void {
  localStorage.setItem(KEY, JSON.stringify(captures));
}

export function getCaptures(): Capture[] {
  return readAll().sort(
    (a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()
  );
}

export function getCaptureById(id: string): Capture | undefined {
  return readAll().find((c) => c.id === id);
}

export function addCapture(
  input: Omit<Capture, 'id' | 'captured_at' | 'is_opened'>
): Capture {
  const all = readAll();
  const capture: Capture = {
    ...input,
    id: crypto.randomUUID(),
    captured_at: new Date().toISOString(),
    is_opened: false,
  };
  writeAll([...all, capture]);
  return capture;
}

export function updateCapture(id: string, updates: Partial<Capture>): void {
  writeAll(readAll().map((c) => (c.id === id ? { ...c, ...updates } : c)));
}

export function deleteCapture(id: string): void {
  writeAll(readAll().filter((c) => c.id !== id));
}

const BRIEF_KEY = 'wick_daily_brief';

export function saveBrief(brief: DailyBrief): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(BRIEF_KEY, JSON.stringify(brief));
}

export function getLatestBrief(): DailyBrief | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(BRIEF_KEY);
    return raw ? (JSON.parse(raw) as DailyBrief) : null;
  } catch {
    return null;
  }
}

const PORTFOLIO_TITLES_KEY = 'wick_portfolio_titles';
const PORTFOLIO_GAP_KEY = 'wick_portfolio_gap';

export function savePortfolioTitles(titles: string[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PORTFOLIO_TITLES_KEY, JSON.stringify(titles));
}

export function getPortfolioTitles(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PORTFOLIO_TITLES_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function savePortfolioGap(result: PortfolioGapResult): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PORTFOLIO_GAP_KEY, JSON.stringify(result));
}

export function getPortfolioGap(): PortfolioGapResult | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PORTFOLIO_GAP_KEY);
    return raw ? (JSON.parse(raw) as PortfolioGapResult) : null;
  } catch {
    return null;
  }
}
