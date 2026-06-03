'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import type { Capture, SearchResult } from '@/lib/types';
import { getCaptures, addCapture, updateCapture } from '@/lib/storage';

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar() {
  return (
    <aside className="w-[220px] flex-shrink-0 bg-surface border-r border-border flex flex-col h-screen">
      <div className="px-5 pt-6 pb-5">
        <p className="font-semibold text-text-primary" style={{ fontSize: '18px' }}>Wick</p>
        <p className="font-mono text-text-tertiary mt-1" style={{ fontSize: '11px' }}>From consumption to connection</p>
      </div>

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
          className="flex items-center gap-2.5 px-3 py-2 rounded-[8px] text-sm font-medium text-left"
          style={{ background: '#E3EDE9', color: '#1B4D3E' }}
          disabled
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <circle cx="6.5" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10 10l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Resources
        </button>
      </nav>

      <div className="px-5 py-4">
        <p className="font-mono text-text-tertiary" style={{ fontSize: '10px' }}>v0.1 · designathon</p>
      </div>
    </aside>
  );
}

// ─── Resource card ────────────────────────────────────────────────────────────

function ResourceCard({
  result,
  saved,
  saving,
  onSave,
}: {
  result: SearchResult;
  saved: boolean;
  saving: boolean;
  onSave: (result: SearchResult) => void;
}) {
  return (
    <div className="bg-surface border border-border rounded-[12px] p-4 flex flex-col gap-2.5
                    hover:shadow-sm transition-all duration-150">
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-text-tertiary" style={{ fontSize: '11px' }}>
          {result.domain}
        </span>
        {result.score > 0 && (
          <span className="font-mono text-text-tertiary flex-shrink-0" style={{ fontSize: '10px' }}>
            {Math.round(result.score * 100)}%
          </span>
        )}
      </div>

      <a
        href={result.url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-text-primary leading-snug hover:text-accent transition-colors"
        style={{ fontSize: '15px' }}
      >
        {result.title}
      </a>

      {result.snippet && (
        <p className="text-text-secondary leading-relaxed line-clamp-3" style={{ fontSize: '13px' }}>
          {result.snippet}
        </p>
      )}

      {result.why_relevant && (
        <p className="text-xs italic" style={{ color: '#1B4D3E' }}>
          {result.why_relevant}
        </p>
      )}

      <div className="mt-auto pt-1">
        <button
          onClick={() => onSave(result)}
          disabled={saved || saving}
          className="text-xs px-3 py-1.5 rounded-[6px] font-medium transition-colors
                     disabled:cursor-not-allowed"
          style={
            saved
              ? { background: '#E3EDE9', color: '#1B4D3E' }
              : { background: '#1B4D3E', color: '#FFFFFF' }
          }
        >
          {saved ? '✓ Saved to Wick' : saving ? 'Saving…' : 'Save to Wick'}
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResourcesPage() {
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchedQuery, setSearchedQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [generatingQuery, setGeneratingQuery] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [savedUrls, setSavedUrls] = useState<Set<string>>(new Set());
  const [savingUrls, setSavingUrls] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCaptures(getCaptures());
  }, []);

  async function handleSearch(queryOverride?: string) {
    const query = (queryOverride ?? searchInput).trim();
    if (!query) return;

    setSearching(true);
    setSearchError(null);
    setResults([]);
    setSearchedQuery(query);

    try {
      const res = await fetch('/api/search-resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await res.json() as
        | { results: SearchResult[]; query: string }
        | { error: string };

      if ('error' in data) {
        setSearchError(data.error);
        return;
      }
      setResults(data.results ?? []);
    } catch {
      setSearchError('Search failed. Check your connection and try again.');
    } finally {
      setSearching(false);
    }
  }

  async function handleGenerateQuery() {
    if (captures.length === 0) return;
    setGeneratingQuery(true);
    try {
      const res = await fetch('/api/search-resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'suggest', captures: captures.slice(0, 20) }),
      });
      const data = await res.json() as { suggestedQuery?: string };
      if (data.suggestedQuery) {
        setSearchInput(data.suggestedQuery);
        inputRef.current?.focus();
      }
    } catch {
      // fail silently — user can type manually
    } finally {
      setGeneratingQuery(false);
    }
  }

  async function handleSave(result: SearchResult) {
    setSavingUrls((prev) => new Set(prev).add(result.url));
    try {
      const saved = addCapture({
        type: 'url',
        content: result.title + (result.snippet ? `\n\n${result.snippet}` : ''),
        source_url: result.url,
      });
      setSavedUrls((prev) => new Set(prev).add(result.url));

      // Fire-and-forget categorization
      fetch('/api/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: saved.content, source_url: saved.source_url }),
      })
        .then(async (r) => {
          if (!r.ok) return;
          const data = await r.json() as {
            label?: string; summary?: string; themes?: string[];
          } | null;
          if (data?.label) {
            updateCapture(saved.id, {
              label: data.label as Capture['label'],
              summary: data.summary,
              themes: data.themes,
            });
          }
        })
        .catch(() => {});
    } catch {
      // fail silently
    } finally {
      setSavingUrls((prev) => {
        const next = new Set(prev);
        next.delete(result.url);
        return next;
      });
    }
  }

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      <Sidebar />

      <main className="flex-1 overflow-y-auto h-screen">
        <div className="max-w-[820px] mx-auto px-10 py-8">

          {/* Header */}
          <div className="mb-8">
            <p className="font-mono uppercase text-text-tertiary mb-2" style={{ fontSize: '11px', letterSpacing: '0.1em' }}>
              Resources
            </p>
            <h1 className="font-semibold text-text-primary" style={{ fontSize: '32px', lineHeight: 1.15 }}>
              Find Resources
            </h1>
            <p className="text-text-secondary mt-1 text-sm leading-relaxed">
              Search for references, case studies, and inspiration for your design work.
            </p>
          </div>

          {/* Search input */}
          <div className="mb-4">
            <div className="flex gap-3">
              <input
                ref={inputRef}
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleSearch(); }}
                placeholder="What are you working on? e.g. voice UI design, onboarding patterns, ethical AI"
                className="flex-1 text-text-primary placeholder:text-text-tertiary bg-surface
                           border border-border rounded-[12px] px-4 py-3 outline-none
                           focus:border-accent transition-colors duration-150"
                style={{ fontSize: '16px' }}
              />
              <button
                onClick={() => void handleSearch()}
                disabled={!searchInput.trim() || searching}
                className="text-sm px-6 py-3 rounded-[12px] bg-accent text-white font-semibold
                           hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed
                           transition-colors duration-150 flex-shrink-0"
              >
                {searching ? 'Searching…' : 'Search'}
              </button>
            </div>

            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs text-text-tertiary">or</span>
              <button
                onClick={() => void handleGenerateQuery()}
                disabled={generatingQuery || captures.length === 0}
                className="text-xs text-accent hover:underline disabled:opacity-40 disabled:cursor-not-allowed
                           transition-opacity"
              >
                {generatingQuery ? 'Generating query…' : 'Search from my captures'}
              </button>
            </div>
          </div>

          {/* Error state */}
          {searchError && (
            <div className="py-6 text-center rounded-[12px] border border-border bg-surface mb-6">
              {searchError.includes('TAVILY_API_KEY') ? (
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-text-primary">Search is not configured.</p>
                  <p className="text-xs text-text-tertiary">Add TAVILY_API_KEY to your environment to enable web search.</p>
                </div>
              ) : (
                <p className="text-sm text-text-secondary">{searchError}</p>
              )}
            </div>
          )}

          {/* Loading state */}
          {searching && (
            <div className="py-12 text-center rounded-[12px] border border-border bg-surface">
              <div className="inline-flex items-center gap-2 text-sm text-text-tertiary animate-pulse">
                <span className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                Searching the web for &ldquo;{searchedQuery}&rdquo;…
              </div>
            </div>
          )}

          {/* Results */}
          {!searching && results.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-5">
                <p className="font-semibold text-text-primary" style={{ fontSize: '16px' }}>
                  Resources for &ldquo;{searchedQuery}&rdquo;
                </p>
                <span className="font-mono text-text-tertiary" style={{ fontSize: '12px' }}>
                  {results.length} found
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {results.map((r) => (
                  <ResourceCard
                    key={r.url}
                    result={r}
                    saved={savedUrls.has(r.url)}
                    saving={savingUrls.has(r.url)}
                    onSave={handleSave}
                  />
                ))}
              </div>
            </div>
          )}

          {/* No results */}
          {!searching && searchedQuery && results.length === 0 && !searchError && (
            <div className="py-12 text-center rounded-[12px] border border-dashed border-border">
              <p className="text-sm text-text-secondary">
                Nothing found for that query. Try different keywords.
              </p>
            </div>
          )}

          {/* Empty state — no search yet */}
          {!searching && !searchedQuery && !searchError && (
            <div className="py-12 text-center">
              <p className="text-sm text-text-tertiary leading-relaxed">
                Search across design publications, case study archives, and inspiration sources.
              </p>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
