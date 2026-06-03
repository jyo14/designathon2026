'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import type { Capture, MissingCaseStudy, PortfolioGapResult, ResourceSuggestion } from '@/lib/types';
import {
  getCaptures,
  getPortfolioTitles,
  savePortfolioTitles,
  getPortfolioGap,
  savePortfolioGap,
} from '@/lib/storage';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Effort pill ──────────────────────────────────────────────────────────────

function EffortPill({ estimate }: { estimate: 'Low' | 'Medium' | 'High' }) {
  const styles: Record<string, { bg: string; color: string }> = {
    Low:    { bg: '#D1FAE5', color: '#065F46' },
    Medium: { bg: '#FEF3C7', color: '#92400E' },
    High:   { bg: '#FEE2E2', color: '#991B1B' },
  };
  const s = styles[estimate] ?? styles.Medium;
  return (
    <span
      className="text-xs px-2.5 py-0.5 rounded-full font-medium flex-shrink-0"
      style={{ background: s.bg, color: s.color, fontSize: '11px' }}
    >
      {estimate} effort
    </span>
  );
}

// ─── Non-interactive capture reference chip ───────────────────────────────────

function CaptureRefChip({
  captureId,
  capturesById,
}: {
  captureId: string;
  capturesById: Map<string, Capture>;
}) {
  const capture = capturesById.get(captureId);
  if (!capture) return null;
  const raw = capture.summary || capture.content || '';
  const preview = raw.length > 55 ? raw.slice(0, 55) + '…' : raw;
  return (
    <span
      className="text-xs px-2.5 py-1 rounded-[6px] bg-surface-2 text-text-secondary
                 max-w-[220px] truncate inline-block"
      title={capture.summary ?? capture.content ?? ''}
    >
      {preview || '(image capture)'}
    </span>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar() {
  return (
    <aside className="w-[220px] flex-shrink-0 bg-surface border-r border-border flex flex-col h-screen">
      {/* Logo */}
      <div className="px-5 pt-6 pb-5">
        <p className="font-semibold text-text-primary" style={{ fontSize: '18px' }}>Wick</p>
        <p className="font-mono text-text-tertiary mt-1" style={{ fontSize: '11px' }}>From consumption to connection</p>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 px-3 flex-1">
        <Link
          href="/"
          className="flex items-center gap-2.5 px-3 py-2 rounded-[8px] text-sm font-normal
                     text-text-secondary hover:bg-surface-2 hover:text-text-primary
                     transition-colors duration-150"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M9.5 1.5L3 9h5l-1.5 5.5L14 7H8.5L9.5 1.5z" fill="currentColor" />
          </svg>
          Brief
        </Link>
        <Link
          href="/"
          className="flex items-center gap-2.5 px-3 py-2 rounded-[8px] text-sm font-normal
                     text-text-secondary hover:bg-surface-2 hover:text-text-primary
                     transition-colors duration-150"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" />
            <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" />
            <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" />
            <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" />
          </svg>
          Captures
        </Link>
        <button
          className="flex items-center gap-2.5 px-3 py-2 rounded-[8px] text-sm font-medium text-left
                     transition-colors duration-150"
          style={{ background: '#E3EDE9', color: '#1B4D3E' }}
          disabled
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M2 6l6-3.5L14 6l-6 3.5L2 6z" fill="currentColor" />
            <path d="M2 9.5l6 3.5 6-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M2 12l6 3.5 6-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
          Portfolio
        </button>
      </nav>

      {/* Footer */}
      <div className="px-5 py-4">
        <p className="font-mono text-text-tertiary" style={{ fontSize: '10px' }}>v0.1 · designathon</p>
      </div>
    </aside>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [portfolioTitles, setPortfolioTitles] = useState<string[]>([]);
  const [titleInput, setTitleInput] = useState('');
  const [gap, setGap] = useState<PortfolioGapResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // URL extraction
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState(false);

  // References per missing case study index
  const [references, setReferences] = useState<Record<number, ResourceSuggestion[]>>({});
  const [fetchingRefs, setFetchingRefs] = useState<Set<number>>(new Set());

  useEffect(() => {
    const caps = getCaptures();
    const titles = getPortfolioTitles();
    const savedGap = getPortfolioGap();
    setCaptures(caps);
    setPortfolioTitles(titles);
    setTitleInput(titles.join('\n'));
    setGap(savedGap ? normalizeGap(savedGap) : null);
    setHydrated(true);
  }, []);

  const capturesById = useMemo(
    () => new Map(captures.map((c) => [c.id, c])),
    [captures]
  );

  function handleSaveTitles() {
    const lines = titleInput
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    savePortfolioTitles(lines);
    setPortfolioTitles(lines);
  }

  function removeTitle(idx: number) {
    const next = portfolioTitles.filter((_, i) => i !== idx);
    setPortfolioTitles(next);
    setTitleInput(next.join('\n'));
    savePortfolioTitles(next);
  }

  function normalizeGap(raw: PortfolioGapResult): PortfolioGapResult {
    return {
      ...raw,
      missing_case_studies: raw.missing_case_studies ?? [],
      stale_case_studies: raw.stale_case_studies ?? [],
    };
  }

  async function extractFromUrl() {
    if (!portfolioUrl.trim()) return;
    setExtracting(true);
    setExtractError(false);
    try {
      const res = await fetch('/api/extract-portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: portfolioUrl.trim() }),
      });
      const data = (await res.json()) as { titles: string[] };
      if (!data.titles || data.titles.length === 0) {
        setExtractError(true);
        return;
      }
      setTitleInput(data.titles.join('\n'));
      savePortfolioTitles(data.titles);
      setPortfolioTitles(data.titles);
    } catch {
      setExtractError(true);
    } finally {
      setExtracting(false);
    }
  }

  async function fetchReferencesForIndex(mc: MissingCaseStudy, idx: number) {
    setFetchingRefs((prev) => new Set(prev).add(idx));
    try {
      const res = await fetch('/api/find-references', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: mc.theme, suggested_title: mc.suggested_title }),
      });
      const data = (await res.json()) as { suggestions: ResourceSuggestion[] };
      setReferences((prev) => ({ ...prev, [idx]: data.suggestions ?? [] }));
    } catch {
      // fail silently — references are a best-effort enhancement
    } finally {
      setFetchingRefs((prev) => {
        const next = new Set(prev);
        next.delete(idx);
        return next;
      });
    }
  }

  const hasEnough = captures.length >= 10;
  const canAnalyze = portfolioTitles.length > 0 && hasEnough;

  async function analyze() {
    if (!canAnalyze) return;
    setAnalyzing(true);
    setAnalysisError(false);
    setReferences({});
    setFetchingRefs(new Set());
    try {
      const payload = captures.map((c) => ({
        id: c.id,
        type: c.type,
        content: c.content,
        source_url: c.source_url,
        captured_at: c.captured_at,
        label: c.label,
        themes: c.themes,
        summary: c.summary,
        project_link: c.project_link,
        is_opened: c.is_opened,
      }));
      const res = await fetch('/api/portfolio-gap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portfolio_titles: portfolioTitles, captures: payload }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as PortfolioGapResult | null;
      if (!data) throw new Error('null response');
      savePortfolioGap(data);
      const normalized = normalizeGap(data);
      setGap(normalized);

      // Kick off reference fetches for sparse cards
      normalized.missing_case_studies.forEach((mc, i) => {
        if ((mc.relevant_capture_ids ?? []).length < 3) {
          void fetchReferencesForIndex(mc, i);
        }
      });
    } catch {
      setAnalysisError(true);
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      <Sidebar />

      <main className="flex-1 overflow-y-auto h-screen">
        <div className="max-w-[760px] mx-auto px-10 py-8">

          {/* Section 1: Portfolio Input */}
          <section className="mb-8">
            <p className="font-mono uppercase text-text-tertiary mb-2" style={{ fontSize: '11px', letterSpacing: '0.1em' }}>
              Your Portfolio
            </p>
            <h2 className="font-semibold text-text-primary mb-1" style={{ fontSize: '32px', lineHeight: 1.15 }}>
              What have you built?
            </h2>
            <p className="text-sm text-text-secondary mb-5 leading-relaxed">
              List your existing case studies — one per line. Wick will find what&apos;s missing.
            </p>

            {/* URL extraction */}
            <div className="flex gap-2 mb-3">
              <input
                type="url"
                value={portfolioUrl}
                onChange={(e) => { setPortfolioUrl(e.target.value); setExtractError(false); }}
                onKeyDown={(e) => { if (e.key === 'Enter') void extractFromUrl(); }}
                placeholder="Paste your portfolio URL to auto-extract case studies"
                className="flex-1 text-[13px] font-mono text-text-primary placeholder:text-text-tertiary
                           bg-surface border border-border rounded-[8px] px-3 py-2 outline-none
                           focus:border-accent transition-colors duration-150"
              />
              <button
                onClick={() => void extractFromUrl()}
                disabled={!portfolioUrl.trim() || extracting}
                className="text-sm px-4 py-2 rounded-[8px] bg-surface-2 text-text-secondary font-medium
                           hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed
                           transition-colors duration-150 flex-shrink-0 whitespace-nowrap"
              >
                {extracting ? 'Reading…' : 'Extract case studies'}
              </button>
            </div>
            {extractError && (
              <p className="text-xs mb-3 leading-relaxed" style={{ color: '#b45309' }}>
                Couldn&apos;t read that URL — add titles manually below.
              </p>
            )}

            <textarea
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              placeholder={
                'JARVIS — Voice assistant for task reading\nE-Scoot — Fleet management UX for e-scooter platform\nFAB Learning — SaaS platform redesign\nFeature Exploration — Independent design concepts'
              }
              rows={4}
              className="w-full text-[15px] text-text-primary placeholder:text-text-tertiary
                         bg-surface border border-border rounded-[16px] p-4 resize-none
                         outline-none leading-relaxed focus:border-accent transition-colors duration-150"
            />

            <div className="flex justify-end mt-3">
              <button
                onClick={handleSaveTitles}
                className="text-sm px-5 py-2 rounded-[8px] bg-accent text-white font-semibold
                           hover:bg-accent-hover transition-colors duration-150"
              >
                Save
              </button>
            </div>

            {hydrated && (
              portfolioTitles.length > 0 ? (
                <div className="mt-4">
                  <div className="flex flex-wrap gap-2">
                    {portfolioTitles.map((title, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5
                                   rounded-full bg-surface border border-border text-text-primary"
                      >
                        <span className="max-w-[280px] truncate">{title}</span>
                        <button
                          onClick={() => removeTitle(i)}
                          className="text-text-tertiary hover:text-red-500 transition-colors
                                     flex-shrink-0 leading-none"
                          aria-label={`Remove ${title}`}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                  {portfolioTitles.length < 3 && (
                    <p className="text-xs text-text-tertiary mt-3">
                      Tip: Include all your case studies for the most accurate analysis.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-text-tertiary mt-4">
                  Add your case studies above to get started.
                </p>
              )
            )}
          </section>

          {/* Divider */}
          <div className="h-px bg-divider mb-8" />

          {/* Section 2: Analyze */}
          <section className="mb-8">
            <div className="flex items-center gap-4 flex-wrap">
              <button
                onClick={() => void analyze()}
                disabled={!canAnalyze || analyzing}
                className="text-sm px-5 py-2 rounded-[8px] bg-accent text-white font-semibold
                           hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed
                           transition-colors duration-150"
              >
                {analyzing ? 'Analyzing…' : gap ? 'Re-analyze' : 'Analyze gap'}
              </button>
              {gap && !analyzing && (
                <span className="font-mono text-text-tertiary" style={{ fontSize: '12px' }}>
                  analyzed {formatTimestamp(gap.generated_at)}
                </span>
              )}
            </div>

            {!analyzing && (
              <p className="text-xs text-text-tertiary mt-3 leading-relaxed">
                Wick compares what you&apos;ve saved against what&apos;s in your portfolio — and shows you what&apos;s missing.
              </p>
            )}

            {hydrated && !hasEnough && (
              <p className="text-xs text-text-tertiary mt-2">
                Save more captures before analyzing — the more context Wick has, the sharper the gap analysis.{' '}
                <span className="font-mono">({captures.length} of 10 needed)</span>
              </p>
            )}
            {hydrated && hasEnough && portfolioTitles.length === 0 && (
              <p className="text-xs text-text-tertiary mt-2">
                Save your portfolio titles above first.
              </p>
            )}
          </section>

          {/* Results */}
          {analyzing ? (
            <div className="py-16 text-center rounded-[12px] border border-border bg-surface">
              <div className="inline-flex items-center gap-2 text-sm text-text-tertiary animate-pulse">
                <span className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                Analyzing your portfolio…
              </div>
            </div>
          ) : analysisError ? (
            <div className="py-8 text-center rounded-[12px] border border-border bg-surface">
              <p className="text-sm text-text-secondary mb-3">
                Couldn&apos;t analyze the portfolio.
              </p>
              <button
                onClick={() => void analyze()}
                className="text-xs px-3 py-1.5 rounded-[8px] border border-border
                           text-text-secondary hover:border-accent hover:text-accent transition-colors"
              >
                Try again
              </button>
            </div>
          ) : gap ? (
            <div className="flex flex-col gap-10">

              {/* Missing case studies */}
              {(gap.missing_case_studies ?? []).length > 0 && (
                <section>
                  <p className="font-mono uppercase text-text-tertiary mb-4" style={{ fontSize: '11px', letterSpacing: '0.1em' }}>
                    What&apos;s missing from your portfolio
                  </p>
                  <div className="flex flex-col gap-6">
                    {(gap.missing_case_studies ?? []).map((mc, i) => (
                      <div
                        key={i}
                        className="rounded-[12px] border border-border bg-surface p-5 flex flex-col gap-4"
                      >
                        {/* Header: title + effort pill */}
                        <div>
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <h3 className="font-semibold text-text-primary leading-snug" style={{ fontSize: '18px' }}>
                              {mc.suggested_title}
                            </h3>
                            {mc.effort_estimate && <EffortPill estimate={mc.effort_estimate} />}
                          </div>
                          <p className="text-[13px] text-text-secondary leading-relaxed">
                            {mc.evidence}
                          </p>
                          {mc.why_now && (
                            <p className="text-[13px] text-text-secondary leading-relaxed mt-1.5 italic">
                              {mc.why_now}
                            </p>
                          )}
                          {mc.skill_signal && (
                            <div className="mt-2.5">
                              <span
                                className="text-xs px-2 py-0.5 rounded-[4px] font-medium"
                                style={{ background: '#E3EDE9', color: '#1B4D3E', fontSize: '11px' }}
                              >
                                Shows: {mc.skill_signal}
                              </span>
                            </div>
                          )}
                        </div>

                        {(mc.relevant_capture_ids ?? []).length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {(mc.relevant_capture_ids ?? []).map((id) => (
                              <CaptureRefChip key={id} captureId={id} capturesById={capturesById} />
                            ))}
                          </div>
                        )}

                        {/* Skeleton */}
                        <div className="flex flex-col gap-2">
                          <p
                            className="font-mono uppercase text-text-tertiary mb-1"
                            style={{ fontSize: '10px', letterSpacing: '0.1em' }}
                          >
                            Structure
                          </p>
                          {(mc.skeleton?.sections ?? []).map((section, si) => (
                            <div
                              key={si}
                              className={`rounded-[8px] px-4 py-3 flex flex-col gap-2 ${
                                (section.mapped_captures ?? []).length > 0
                                  ? 'bg-surface border border-border'
                                  : 'bg-surface-2'
                              }`}
                            >
                              <p
                                className="font-mono uppercase text-text-tertiary"
                                style={{ fontSize: '10px', letterSpacing: '0.1em' }}
                              >
                                {section.name}
                              </p>
                              {(section.mapped_captures ?? []).length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {(section.mapped_captures ?? []).map((id) => (
                                    <CaptureRefChip key={id} captureId={id} capturesById={capturesById} />
                                  ))}
                                </div>
                              ) : section.gap_suggestion ? (
                                <p className="text-xs text-text-secondary italic leading-relaxed">
                                  {section.gap_suggestion}
                                </p>
                              ) : null}
                            </div>
                          ))}
                        </div>

                        {/* References — shown for sparse cards */}
                        {(mc.relevant_capture_ids ?? []).length < 3 && (
                          <div className="border-t border-border pt-4 flex flex-col gap-2.5">
                            <p
                              className="font-mono uppercase text-text-tertiary"
                              style={{ fontSize: '10px', letterSpacing: '0.1em' }}
                            >
                              Where to start looking
                            </p>
                            {fetchingRefs.has(i) ? (
                              <div className="flex items-center gap-2 text-xs text-text-tertiary">
                                <span className="inline-block w-3 h-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                                Finding resources…
                              </div>
                            ) : references[i] && references[i].length > 0 ? (
                              <>
                                <div className="flex flex-wrap gap-2">
                                  {references[i].map((ref, ri) => (
                                    <a
                                      key={ri}
                                      href={`https://www.google.com/search?q=${encodeURIComponent(ref.search_query)}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title={ref.why_it_helps}
                                      className="flex items-start gap-1.5 text-xs px-3 py-2 rounded-[8px]
                                                 bg-surface-2 border border-border text-text-secondary
                                                 hover:border-accent hover:text-accent transition-colors"
                                    >
                                      <span
                                        className="font-mono uppercase flex-shrink-0 mt-0.5"
                                        style={{ fontSize: '9px', color: '#9C9B95' }}
                                      >
                                        {ref.type}
                                      </span>
                                      <span className="leading-snug">{ref.search_query}</span>
                                    </a>
                                  ))}
                                </div>
                                <p className="text-xs text-text-tertiary italic">
                                  Suggested starting points — Wick can&apos;t browse yet, but these searches will.
                                </p>
                              </>
                            ) : null}
                          </div>
                        )}

                        <p className="font-mono text-accent" style={{ fontSize: '11px' }}>
                          AI structures. You write.
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Stale case studies */}
              {(gap.stale_case_studies ?? []).length > 0 && (
                <section>
                  <p className="font-mono uppercase text-text-tertiary mb-4" style={{ fontSize: '11px', letterSpacing: '0.1em' }}>
                    Worth updating
                  </p>
                  <div className="flex flex-col gap-3">
                    {(gap.stale_case_studies ?? []).map((sc, i) => (
                      <div
                        key={i}
                        className="rounded-[12px] border border-border bg-surface p-4 flex flex-col gap-3"
                      >
                        <div>
                          <p className="text-sm font-medium text-text-primary">{sc.portfolio_title}</p>
                          <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                            {sc.staleness_reason}
                          </p>
                        </div>
                        {(sc.relevant_capture_ids ?? []).length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {(sc.relevant_capture_ids ?? []).map((id) => (
                              <CaptureRefChip key={id} captureId={id} capturesById={capturesById} />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Empty result */}
              {(gap.missing_case_studies ?? []).length === 0 && (gap.stale_case_studies ?? []).length === 0 && (
                <div className="py-10 text-center rounded-[12px] border border-dashed border-border">
                  <p className="text-sm text-text-secondary">
                    Your portfolio looks well-covered by your recent captures.
                  </p>
                  <p className="text-xs text-text-tertiary mt-2">
                    The more you save to Wick, the sharper this analysis gets.
                  </p>
                </div>
              )}

            </div>
          ) : null}

        </div>
      </main>
    </div>
  );
}
