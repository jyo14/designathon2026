'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import type { Capture, PortfolioGapResult } from '@/lib/types';
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
      className="text-xs px-2.5 py-1 rounded-full border border-border bg-surface
                 text-text-secondary max-w-[220px] truncate inline-block"
      title={capture.summary ?? capture.content ?? ''}
    >
      {preview || '(image capture)'}
    </span>
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

  const hasEnough = captures.length >= 10;
  const canAnalyze = portfolioTitles.length > 0 && hasEnough;

  async function analyze() {
    if (!canAnalyze) return;
    setAnalyzing(true);
    setAnalysisError(false);
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
      setGap(normalizeGap(data));
    } catch {
      setAnalysisError(true);
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-[720px] mx-auto px-6 py-10">

        {/* Header */}
        <header className="mb-10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-baseline gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Wick</h1>
              <span className="text-xs font-mono text-text-tertiary px-2 py-0.5 rounded-full border border-border">
                AI structures. You write.
              </span>
            </div>
            <nav className="flex items-center gap-1">
              <Link
                href="/"
                className="text-xs font-mono px-3 py-1.5 rounded-[8px] text-text-secondary
                           hover:text-text-primary transition-colors"
              >
                Brief
              </Link>
              <Link
                href="/portfolio"
                className="text-xs font-mono px-3 py-1.5 rounded-[8px] bg-accent-soft
                           text-accent font-medium"
              >
                Portfolio
              </Link>
            </nav>
          </div>
        </header>

        {/* Section 1: Portfolio Input */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold tracking-tight text-text-primary mb-1">
            Your Portfolio
          </h2>
          <p className="text-sm text-text-secondary mb-1">
            List your existing case studies. Wick will find what&apos;s missing.
          </p>
          <p className="text-xs text-text-tertiary mb-4">
            List the projects you&apos;ve already documented. One per line. Don&apos;t worry about formatting — just the names you know them by.
          </p>

          <textarea
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            placeholder={
              'JARVIS — Voice assistant for task reading\nE-Scoot — Fleet management UX for e-scooter platform\nFAB Learning — SaaS platform redesign\nFeature Exploration — Independent design concepts'
            }
            rows={4}
            className="w-full text-sm text-text-primary placeholder:text-text-tertiary
                       bg-surface border border-border rounded-[12px] p-4 resize-none
                       outline-none leading-relaxed focus:border-accent transition-colors"
          />

          <div className="flex justify-end mt-2">
            <button
              onClick={handleSaveTitles}
              className="text-xs px-4 py-1.5 rounded-[8px] bg-accent text-white font-medium
                         hover:opacity-90 transition-opacity"
            >
              Save portfolio
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
                    Tip: Include all your case studies for the most accurate analysis — missing titles can skew the results.
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

        {/* Section 2: Analyze */}
        <section className="mb-10">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => void analyze()}
              disabled={!canAnalyze || analyzing}
              className="text-sm px-5 py-2 rounded-[8px] bg-accent text-white font-medium
                         hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed
                         transition-opacity"
            >
              {analyzing ? 'Analyzing…' : gap ? 'Re-analyze' : 'Analyze gap'}
            </button>
            {gap && !analyzing && (
              <span className="text-xs font-mono text-text-tertiary">
                analyzed {formatTimestamp(gap.generated_at)}
              </span>
            )}
          </div>
          {!analyzing && (
            <p className="text-xs text-text-tertiary mt-2">
              Wick will compare what you&apos;ve saved against what&apos;s in your portfolio — and show you what&apos;s missing.
            </p>
          )}

          {hydrated && !hasEnough && (
            <p className="text-xs text-text-tertiary mt-2">
              Save more captures to Wick before analyzing — the more context Wick has, the more accurate the gap analysis.{' '}
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
            <div className="inline-flex items-center gap-2 text-sm text-text-tertiary">
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
                <p className="text-xs font-mono text-text-tertiary uppercase tracking-widest mb-4">
                  What&apos;s missing from your portfolio
                </p>
                <div className="flex flex-col gap-6">
                  {(gap.missing_case_studies ?? []).map((mc, i) => (
                    <div
                      key={i}
                      className="rounded-[12px] border border-border bg-surface p-5 flex flex-col gap-4"
                    >
                      {/* Title + evidence */}
                      <div>
                        <h3 className="text-lg font-semibold text-text-primary leading-snug">
                          {mc.suggested_title}
                        </h3>
                        <p className="text-sm text-text-secondary mt-1 leading-relaxed">
                          {mc.evidence}
                        </p>
                      </div>

                      {/* Relevant captures */}
                      {(mc.relevant_capture_ids ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {(mc.relevant_capture_ids ?? []).map((id) => (
                            <CaptureRefChip key={id} captureId={id} capturesById={capturesById} />
                          ))}
                        </div>
                      )}

                      {/* Skeleton */}
                      <div className="flex flex-col gap-2">
                        <p className="text-xs font-mono text-text-tertiary uppercase tracking-widest mb-1">
                          Structure
                        </p>
                        {(mc.skeleton?.sections ?? []).map((section, si) => (
                          <div
                            key={si}
                            className={`rounded-[8px] p-3 flex flex-col gap-2 ${
                              (section.mapped_captures ?? []).length > 0
                                ? 'bg-surface border border-border'
                                : 'bg-surface-2'
                            }`}
                          >
                            <p className="text-xs font-mono uppercase tracking-wide text-text-tertiary">
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

                      <p className="text-xs font-mono text-accent">AI structures. You write.</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Stale case studies */}
            {(gap.stale_case_studies ?? []).length > 0 && (
              <section>
                <p className="text-xs font-mono text-text-tertiary uppercase tracking-widest mb-4">
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
    </div>
  );
}
