'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import type { Capture, CaptureLabel, CaptureType, DailyBrief } from '@/lib/types';
import {
  getCaptures, addCapture, updateCapture, deleteCapture,
  saveBrief, getLatestBrief,
} from '@/lib/storage';

// ─── Label config ─────────────────────────────────────────────────────────────

const LABEL_STYLES: Record<CaptureLabel, { bg: string; color: string; dot: string }> = {
  'UI Pattern':         { bg: '#EEF2FF', color: '#3730A3', dot: '#6366F1' },
  'Portfolio Notes':    { bg: '#FEF3C7', color: '#92400E', dot: '#EA580C' },
  'Study Material':     { bg: '#EFF6FF', color: '#1D4ED8', dot: '#3B82F6' },
  'Design Inspiration': { bg: '#FDF2F8', color: '#9D174D', dot: '#DB2777' },
  'Design Decisions':   { bg: '#F5F3FF', color: '#5B21B6', dot: '#7C3AED' },
  'Interview Prep':     { bg: '#F0FDFA', color: '#115E59', dot: '#0D9488' },
};

const ALL_LABELS: CaptureLabel[] = [
  'UI Pattern',
  'Portfolio Notes',
  'Study Material',
  'Design Inspiration',
  'Design Decisions',
  'Interview Prep',
];

type CatState = 'pending' | 'error';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectType(content: string, url: string, hasImage: boolean): CaptureType {
  const hasContent = content.trim().length > 0;
  const hasUrl = url.trim().length > 0;
  if (hasImage && !hasContent && !hasUrl) return 'image';
  if (hasImage) return 'mixed';
  if (hasUrl && hasContent) return 'mixed';
  if (hasUrl) return 'url';
  return 'text';
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

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

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function extractUrl(text: string): { url: string; remaining: string } | null {
  const match = text.match(/https?:\/\/[^\s<>'"]+/);
  if (!match) return null;
  const url = match[0].replace(/[.,;!?)\]]+$/, '');
  const remaining = text.replace(match[0], '').trim();
  return { url, remaining };
}

// ─── Label chip ───────────────────────────────────────────────────────────────

function LabelChip({ label }: { label: CaptureLabel }) {
  const s = LABEL_STYLES[label];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium"
      style={{ background: s.bg, color: s.color, fontSize: '11px' }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.dot }} />
      {label}
    </span>
  );
}

// ─── Capture chip (brief → board linking) ────────────────────────────────────

function CaptureChip({
  captureId,
  capturesById,
  onClick,
  dark = false,
}: {
  captureId: string;
  capturesById: Map<string, Capture>;
  onClick: (id: string) => void;
  dark?: boolean;
}) {
  const capture = capturesById.get(captureId);
  if (!capture) return null;
  const raw = capture.summary || capture.content || '';
  const preview = raw.length > 55 ? raw.slice(0, 55) + '…' : raw;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(captureId); }}
      className={`text-xs px-2.5 py-1 rounded-[6px] max-w-[220px] truncate text-left transition-colors
                  ${dark
                    ? 'hover:opacity-100'
                    : 'bg-surface-2 text-text-secondary hover:text-accent'}`}
      style={dark ? { background: 'rgba(236,233,224,0.1)', color: 'rgba(236,233,224,0.7)' } : {}}
      title={capture.summary ?? capture.content ?? ''}
    >
      {preview || '(image capture)'}
    </button>
  );
}

// ─── Capture card ─────────────────────────────────────────────────────────────

function getTypeBadgeInfo(capture: Capture): { icon: string; label: string } {
  if (capture.type === 'image') return { icon: '🖼', label: 'IMAGE' };
  if (capture.type === 'text') return { icon: '📝', label: 'NOTE' };
  if (capture.source_url) {
    try {
      const hostname = new URL(
        capture.source_url.startsWith('http') ? capture.source_url : `https://${capture.source_url}`
      ).hostname.replace('www.', '');
      return { icon: '🔗', label: hostname };
    } catch {
      return { icon: '🔗', label: 'link' };
    }
  }
  return { icon: '📝', label: 'NOTE' };
}

function CaptureCard({
  capture,
  catState,
  highlighted,
  onRetry,
  onDelete,
  onMarkOpened,
  onLabelChange,
  onSaveContent,
  showLabel = false,
}: {
  capture: Capture;
  catState?: CatState;
  highlighted?: boolean;
  onRetry?: () => void;
  onDelete: (id: string) => void;
  onMarkOpened: (id: string) => void;
  onLabelChange?: (id: string, newLabel: CaptureLabel) => void;
  onSaveContent?: (id: string, content: string, recategorize: boolean) => void;
  showLabel?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [labelMenuOpen, setLabelMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [recategorize, setRecategorize] = useState(false);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) editTextareaRef.current?.focus();
  }, [editing]);

  function handleCardClick() {
    if (editing) return;
    setExpanded((e) => !e);
    if (!capture.is_opened) onMarkOpened(capture.id);
  }

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setEditContent(capture.content || '');
    setRecategorize(false);
    setEditing(true);
  }

  function handleEditSave(e?: React.MouseEvent) {
    e?.stopPropagation();
    onSaveContent?.(capture.id, editContent, recategorize);
    setEditing(false);
  }

  function handleEditCancel(e?: React.MouseEvent) {
    e?.stopPropagation();
    setEditing(false);
  }

  function handleEditKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); handleEditSave(); }
    if (e.key === 'Escape') { e.preventDefault(); handleEditCancel(); }
  }

  const isPending = catState === 'pending';
  const isError = catState === 'error';
  const typeBadge = getTypeBadgeInfo(capture);

  return (
    <article
      data-capture-id={capture.id}
      className={`bg-surface border border-border rounded-[12px] px-4 py-3.5 flex flex-col gap-2.5
                  cursor-pointer group transition-all duration-150
                  ${editing ? 'shadow-sm' : 'hover:shadow-sm'}
                  ${highlighted ? 'ring-2 ring-accent ring-offset-1' : ''}`}
      onClick={handleCardClick}
    >
      {/* Row 1: label chip (left) + controls (right) */}
      <div className="flex items-center justify-between gap-2">
        <div>
          {showLabel && capture.label && <LabelChip label={capture.label} />}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {/* Content edit button */}
          {onSaveContent && !editing && (
            <button
              onClick={startEdit}
              className="opacity-0 group-hover:opacity-100 transition-opacity
                         text-text-tertiary hover:text-text-primary"
              aria-label="Edit content"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                <path d="M8.5 1.5l2 2-7.5 7.5H1V9l7.5-7.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round"/>
              </svg>
            </button>
          )}
          {/* Label change button */}
          {onLabelChange && capture.label && !editing && (
            <div className="relative">
              <button
                onClick={() => setLabelMenuOpen((v) => !v)}
                className="opacity-0 group-hover:opacity-100 transition-opacity
                           text-text-tertiary hover:text-text-primary text-xs leading-none px-0.5"
                aria-label="Change label"
              >
                ✎
              </button>
              {labelMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setLabelMenuOpen(false)} />
                  <div className="absolute top-full right-0 mt-1 z-20 bg-surface border border-border
                                  rounded-[10px] shadow-md py-1 min-w-[200px]">
                    {ALL_LABELS.map((l) => (
                      <button
                        key={l}
                        onClick={() => {
                          onLabelChange!(capture.id, l);
                          setLabelMenuOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-surface-2
                                    flex items-center gap-2 transition-colors
                                    ${l === capture.label ? 'text-accent font-medium' : 'text-text-primary'}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: LABEL_STYLES[l].dot }} />
                        {l}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          <span
            className="font-mono flex-shrink-0"
            style={{ background: '#F2F1ED', color: '#5C5B55', fontSize: '10px', padding: '2px 6px', borderRadius: '4px' }}
          >
            {typeBadge.icon} {typeBadge.label}
          </span>
          {!editing && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {isError && onRetry && (
                <button
                  onClick={onRetry}
                  className="text-xs px-2 py-1 rounded-[6px] bg-amber-50 text-amber-700 hover:bg-amber-100 font-medium"
                >
                  Retry
                </button>
              )}
              <DeleteButton captureId={capture.id} onDelete={onDelete} />
            </div>
          )}
        </div>
      </div>

      {isPending && (
        <div className="flex items-center gap-2 text-xs text-text-tertiary">
          <span className="inline-block w-3 h-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          Categorizing…
        </div>
      )}

      {isError && (
        <p className="text-xs text-amber-600">
          Couldn&apos;t categorize — hit Retry or it&apos;ll be picked up on next backfill.
        </p>
      )}

      {capture.image_data_url && (
        <div className={`rounded-[8px] overflow-hidden border border-border bg-surface-2 ${expanded ? '' : 'max-h-36'}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={capture.image_data_url} alt="Captured" className="w-full object-cover"
            style={{ maxHeight: expanded ? 'none' : '9rem' }} />
        </div>
      )}

      {/* URL — unchanged during edit */}
      {capture.source_url && (
        <a
          href={capture.source_url.startsWith('http') ? capture.source_url : `https://${capture.source_url}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-[13px] underline transition-colors line-clamp-2"
          style={{ color: '#1a6ef5', cursor: 'pointer' }}
        >
          {capture.source_url}
        </a>
      )}

      {/* Summary — unchanged during edit */}
      {capture.summary && (
        <p className={`text-sm text-text-primary leading-relaxed ${expanded ? '' : 'line-clamp-3'}`}>
          {capture.summary}
        </p>
      )}

      {/* Content — inline editor when editing, plain text otherwise */}
      {editing ? (
        <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
          <textarea
            ref={editTextareaRef}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onKeyDown={handleEditKeyDown}
            rows={4}
            className="w-full text-sm text-text-primary leading-relaxed bg-surface
                       resize-none outline-none rounded-[6px] px-2.5 py-2"
            style={{ border: '1px solid var(--accent)' }}
          />
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-1.5 text-xs text-text-tertiary cursor-pointer select-none">
              <input
                type="checkbox"
                checked={recategorize}
                onChange={(e) => setRecategorize(e.target.checked)}
                className="accent-accent"
              />
              Re-categorise with AI
            </label>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleEditCancel}
                className="text-xs px-2.5 py-1 rounded-[6px] text-text-secondary
                           hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                className="text-xs px-3 py-1 rounded-[6px] bg-accent text-white font-medium
                           hover:bg-accent-hover transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : (
        capture.content && (!capture.summary || expanded) && (
          <p className={`text-sm text-text-secondary leading-relaxed ${expanded ? '' : 'line-clamp-3'}`}>
            {capture.content}
          </p>
        )
      )}

      {/* Themes — unchanged during edit */}
      {Array.isArray(capture.themes) && capture.themes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {capture.themes.map((t) => (
            <span key={t} className="font-mono px-2 py-0.5 rounded-full bg-surface-2 text-text-secondary"
              style={{ fontSize: '11px' }}>
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Timestamp at bottom */}
      <div className="flex items-center gap-1.5 mt-auto pt-0.5">
        <time className="text-[12px] font-mono text-text-tertiary" dateTime={capture.captured_at}>
          {formatTimestamp(capture.captured_at)}
        </time>
        {!capture.is_opened && (
          <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" title="New" />
        )}
      </div>
    </article>
  );
}

function DeleteButton({ captureId, onDelete }: { captureId: string; onDelete: (id: string) => void }) {
  const [confirming, setConfirming] = useState(false);
  return confirming ? (
    <>
      <button onClick={() => onDelete(captureId)}
        className="text-xs px-2 py-1 rounded-[6px] bg-red-50 text-red-600 hover:bg-red-100 font-medium">
        Delete
      </button>
      <button onClick={() => setConfirming(false)}
        className="text-xs px-2 py-1 rounded-[6px] text-text-secondary hover:bg-surface-2">
        No
      </button>
    </>
  ) : (
    <button onClick={() => setConfirming(true)}
      className="text-xs px-2 py-1 rounded-[6px] text-text-tertiary hover:text-red-500 hover:bg-red-50 transition-colors"
      aria-label="Delete">
      ✕
    </button>
  );
}

// ─── Label board ──────────────────────────────────────────────────────────────

function LabelBoard({
  label,
  captures,
  catStates,
  highlightedId,
  onRetry,
  onDelete,
  onMarkOpened,
  onLabelChange,
  onSaveContent,
}: {
  label: CaptureLabel;
  captures: Capture[];
  catStates: Record<string, CatState>;
  highlightedId: string | null;
  onRetry: (c: Capture) => void;
  onDelete: (id: string) => void;
  onMarkOpened: (id: string) => void;
  onLabelChange: (id: string, newLabel: CaptureLabel) => void;
  onSaveContent: (id: string, content: string, recategorize: boolean) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const s = LABEL_STYLES[label];

  useEffect(() => {
    if (highlightedId && captures.some((c) => c.id === highlightedId)) {
      setCollapsed(false);
    }
  }, [highlightedId, captures]);

  return (
    <section className="mb-6">
      <button
        className="w-full flex items-center justify-between px-1 mb-3 group"
        style={{ minHeight: '40px', padding: '12px 0' }}
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.dot }} />
          <span
            className="font-semibold uppercase tracking-wider text-text-secondary"
            style={{ fontSize: '14px', letterSpacing: '0.07em' }}
          >
            {label}
          </span>
          <span className="font-mono text-text-tertiary" style={{ fontSize: '13px' }}>
            {captures.length}
          </span>
        </div>
        <span
          className="flex items-center justify-center w-10 h-10 rounded-[8px] flex-shrink-0
                     text-text-tertiary group-hover:text-text-secondary group-hover:bg-surface-2
                     transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            {collapsed
              ? <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              : <path d="M5 12l5-5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            }
          </svg>
        </span>
      </button>

      {!collapsed && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {captures.map((c) => (
            <CaptureCard
              key={c.id}
              capture={c}
              catState={catStates[c.id]}
              highlighted={highlightedId === c.id}
              onRetry={() => onRetry(c)}
              onDelete={onDelete}
              onMarkOpened={onMarkOpened}
              onLabelChange={onLabelChange}
              onSaveContent={onSaveContent}
              showLabel={true}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Brief helpers ────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning, Jyo.';
  if (h < 17) return 'Good afternoon, Jyo.';
  return 'Good evening, Jyo.';
}

type ReasonTag = { icon: string; label: string; bg: string; color: string };

function detectReasonTag(reasoning: string): ReasonTag | null {
  const r = reasoning.toLowerCase();
  if (/\bactive project\b|\bworking on\b|\bongoing\b|\bcurrently working\b/.test(r))
    return { icon: '⚡', label: 'Active project', bg: '#ECFDF5', color: '#065F46' };
  if (/\bunopened\b|\bnot opened\b|\bhaven.?t opened\b|\bnever opened\b|\bsaved but\b/.test(r))
    return { icon: '📬', label: 'Unopened', bg: '#FEF3C7', color: '#92400E' };
  if (/\bmomentum\b|\bcontinue\b|\bcontinuing\b|\bbuild(ing)? on\b|\bpick up\b/.test(r))
    return { icon: '🔥', label: 'Momentum', bg: '#FDF2F8', color: '#9D174D' };
  if (/\bdeadline\b|\burgent\b|\btime.sensitive\b|\bsoon\b|\btomorrow\b|\bdue\b/.test(r))
    return { icon: '⏰', label: 'Time-sensitive', bg: '#FEE2E2', color: '#991B1B' };
  if (/\bconnect(ion|s|ed)?\b|\blink(s|ed)?\b|\brelationship\b|\bboth\b|\bbridge\b/.test(r))
    return { icon: '💡', label: 'New connection', bg: '#EEF2FF', color: '#3730A3' };
  return null;
}

// ─── Daily brief section ──────────────────────────────────────────────────────

function DailyBriefSection({
  captures,
  onCaptureLinkClick,
}: {
  captures: Capture[];
  onCaptureLinkClick: (id: string) => void;
}) {
  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState(false);

  useEffect(() => {
    setBrief(getLatestBrief());
  }, []);

  const capturesById = useMemo(
    () => new Map(captures.map((c) => [c.id, c])),
    [captures]
  );

  const hasEnough = captures.length >= 5;

  async function generate() {
    if (!hasEnough) return;
    setGenerating(true);
    setGenError(false);
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
      const res = await fetch('/api/daily-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ captures: payload }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as DailyBrief | null;
      if (!data) throw new Error('null response');
      saveBrief(data);
      setBrief(data);
    } catch {
      setGenError(true);
    } finally {
      setGenerating(false);
    }
  }

  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <section className="mb-8">
      {/* Header — Fix 3: greeting + context line */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <p className="font-mono text-text-tertiary" style={{ fontSize: '11px', letterSpacing: '0.05em' }}>
            {todayLabel}
          </p>
          <h2 className="font-semibold text-text-primary mt-1" style={{ fontSize: '32px', lineHeight: 1.15 }}>
            {getGreeting()}
          </h2>
          {brief?.context_line && (
            <p className="text-text-secondary mt-1 leading-relaxed" style={{ fontSize: '15px' }}>
              {brief.context_line}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0 mt-1">
          {brief && !generating && (
            <p className="text-xs text-text-tertiary">
              generated {formatTimestamp(brief.generated_at)}
            </p>
          )}
          {hasEnough && (
            <button
              onClick={() => void generate()}
              disabled={generating}
              className="text-sm px-5 py-2 rounded-[8px] bg-accent text-white font-semibold
                         hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed
                         transition-colors duration-150"
            >
              {generating ? 'Generating…' : brief ? 'Regenerate' : 'Generate brief'}
            </button>
          )}
        </div>
      </div>

      {!hasEnough ? (
        <div className="py-10 text-center rounded-[12px] border border-dashed border-border bg-surface">
          <p className="text-sm text-text-secondary">
            Save a few more captures and your brief will appear here.
          </p>
          <p className="font-mono text-text-tertiary mt-1" style={{ fontSize: '12px' }}>
            {captures.length} of 5 needed
          </p>
        </div>
      ) : generating ? (
        <div className="py-10 text-center rounded-[12px] border border-border bg-surface">
          <div className="inline-flex items-center gap-2 text-sm text-text-tertiary animate-pulse">
            <span className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            Generating brief…
          </div>
        </div>
      ) : genError ? (
        <div className="py-8 text-center rounded-[12px] border border-border bg-surface">
          <p className="text-sm text-text-secondary mb-3">Couldn&apos;t generate the brief.</p>
          <button
            onClick={() => void generate()}
            className="text-xs px-3 py-1.5 rounded-[8px] border border-border text-text-secondary
                       hover:border-accent hover:text-accent transition-colors"
          >
            Try again
          </button>
        </div>
      ) : !brief ? (
        <div className="py-10 text-center rounded-[12px] border border-dashed border-border bg-surface">
          <p className="text-sm text-text-secondary mb-4">Ready to surface what matters today.</p>
          <button
            onClick={() => void generate()}
            className="text-sm px-5 py-2 rounded-[8px] bg-accent text-white font-semibold
                       hover:bg-accent-hover transition-colors duration-150"
          >
            Generate today&apos;s brief
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {/* Nudge */}
          <div
            className="rounded-[12px] px-5 py-4 flex flex-col gap-2"
            style={{ background: '#1B4D3E' }}
          >
            <div className="flex items-center gap-1.5">
              <span aria-hidden style={{ fontSize: '14px' }}>⚡</span>
              <span
                className="font-mono uppercase"
                style={{ fontSize: '11px', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.55)' }}
              >
                Nudge
              </span>
            </div>
            <p className="text-white font-medium leading-snug" style={{ fontSize: '16px' }}>{brief.nudge}</p>
          </div>

          {/* Top 3 — Fix 2: 56px number watermark + reason tag */}
          <div>
            <p className="font-mono uppercase text-text-tertiary mb-3" style={{ fontSize: '11px', letterSpacing: '0.1em' }}>
              Top 3 today
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {brief.top_3.map((item, i) => {
                const tag = detectReasonTag(item.reasoning);
                return (
                  <div
                    key={i}
                    className="rounded-[12px] p-5 flex flex-col gap-2"
                    style={{ background: '#FFFFFF', borderLeft: '3px solid #1B4D3E' }}
                  >
                    {/* Number + reason tag */}
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className="leading-none select-none"
                        style={{ fontSize: '56px', fontWeight: 700, color: '#E8E7E3', lineHeight: 1 }}
                        aria-hidden
                      >
                        {i + 1}
                      </span>
                      {tag && (
                        <span
                          className="font-mono flex-shrink-0 mt-1"
                          style={{
                            fontSize: '11px',
                            background: tag.bg,
                            color: tag.color,
                            padding: '2px 8px',
                            borderRadius: '9999px',
                          }}
                        >
                          {tag.icon} {tag.label}
                        </span>
                      )}
                    </div>
                    <p className="font-bold leading-snug text-text-primary" style={{ fontSize: '15px' }}>
                      {item.title}
                    </p>
                    <p className="text-text-secondary" style={{ fontSize: '13px', lineHeight: 1.5 }}>
                      {item.reasoning}
                    </p>
                    {item.capture_ids.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
                        {item.capture_ids.map((id) => (
                          <CaptureChip key={id} captureId={id} capturesById={capturesById} onClick={onCaptureLinkClick} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Connections — Fix 1: guard empty array, ensure description is primary */}
          {brief.connections.length > 0 && (
            <div>
              <p className="font-mono uppercase text-text-tertiary mb-3" style={{ fontSize: '11px', letterSpacing: '0.1em' }}>
                Connections worth noticing
              </p>
              <div className="flex flex-col gap-3">
                {brief.connections.map((conn, i) => (
                  <div
                    key={i}
                    className="rounded-[12px] p-5 flex flex-col gap-3"
                    style={{ background: '#FFFFFF', borderLeft: '3px solid #1B4D3E' }}
                  >
                    {/* Description is the primary content */}
                    <p className="font-medium leading-relaxed text-text-primary" style={{ fontSize: '14px', fontWeight: 500 }}>
                      {conn.description}
                    </p>
                    {conn.capture_ids.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {conn.capture_ids.flatMap((id, idx) => {
                          const els = [];
                          if (idx > 0) els.push(
                            <span key={`sep-${idx}`} className="font-mono text-text-tertiary flex-shrink-0" style={{ fontSize: '11px' }}>↔</span>
                          );
                          els.push(
                            <CaptureChip key={id} captureId={id} capturesById={capturesById} onClick={onCaptureLinkClick} />
                          );
                          return els;
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ─── Capture form ─────────────────────────────────────────────────────────────

function CaptureForm({ onSave }: { onSave: (c: Capture) => void }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) textareaRef.current?.focus();
  }, [open]);

  const isEmpty = !content.trim() && !url.trim() && !imageFile;

  function handleContentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    if (!url.trim() && /^https?:\/\/[^\s]+$/.test(val.trim())) {
      setUrl(val.trim());
      setContent('');
      return;
    }
    setContent(val);
  }

  async function handleSave() {
    if (isEmpty) return;
    setSaving(true);

    let finalContent = content.trim();
    let finalUrl = url.trim();

    if (!finalUrl) {
      const extracted = extractUrl(finalContent);
      if (extracted) {
        finalUrl = extracted.url;
        finalContent = extracted.remaining;
      }
    }

    let imageDataUrl: string | undefined;
    if (imageFile) imageDataUrl = await readFileAsDataURL(imageFile);
    const saved = addCapture({
      type: detectType(finalContent, finalUrl, !!imageFile),
      content: finalContent,
      source_url: finalUrl || undefined,
      image_data_url: imageDataUrl,
    });
    onSave(saved);
    setContent('');
    setUrl('');
    setImageFile(null);
    setImagePreview(null);
    setOpen(false);
    setSaving(false);
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void handleSave();
    }
  }

  function handleCancel() {
    setOpen(false);
    setContent('');
    setUrl('');
    setImageFile(null);
    setImagePreview(null);
  }

  return (
    <div className="mb-8">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center justify-center gap-2 w-full px-4 py-3
                     rounded-[12px] border border-dashed border-border bg-surface
                     text-[14px] text-text-tertiary hover:border-accent hover:text-accent
                     transition-colors duration-150"
        >
          + Capture something
        </button>
      ) : (
        <div className="bg-surface border border-border rounded-[16px] p-4 flex flex-col gap-3 shadow-sm">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            onKeyDown={handleKeyDown}
            placeholder="Paste text, a URL, or just a thought…"
            rows={3}
            className="w-full text-[15px] text-text-primary placeholder:text-text-tertiary
                       bg-transparent resize-none outline-none leading-relaxed"
          />
          <div className="h-px bg-divider" />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Source URL (optional)"
            className="w-full text-[13px] font-mono text-text-secondary placeholder:text-text-tertiary
                       bg-transparent outline-none"
          />
          {imagePreview && (
            <div className="relative rounded-[8px] overflow-hidden border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreview} alt="Preview" className="w-full max-h-40 object-cover" />
              <button
                onClick={() => { setImageFile(null); setImagePreview(null); }}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 text-white
                           text-xs flex items-center justify-center hover:bg-black/70"
              >
                ✕
              </button>
            </div>
          )}
          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-xs px-3 py-1.5 rounded-[8px] bg-surface-2 text-text-secondary
                         hover:bg-surface-hover transition-colors duration-150"
            >
              {imageFile ? '✓ Image added' : '+ Image'}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            <div className="flex items-center gap-3">
              <span className="text-[12px] text-text-tertiary select-none">⌘↵ to save</span>
              <button
                onClick={handleCancel}
                className="text-xs px-3 py-1.5 rounded-[8px] text-text-secondary
                           hover:text-text-primary transition-colors duration-150"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={isEmpty || saving}
                className="text-sm px-5 py-2 rounded-[8px] bg-accent text-white font-semibold
                           hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed
                           transition-colors duration-150"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Import summary banner ────────────────────────────────────────────────────

function ImportSummaryBanner({
  count,
  byLabel,
  onReview,
  onDismiss,
}: {
  count: number;
  byLabel: Partial<Record<CaptureLabel, number>>;
  onReview: () => void;
  onDismiss: () => void;
}) {
  const breakdown = (Object.entries(byLabel) as [CaptureLabel, number][])
    .sort(([, a], [, b]) => b - a)
    .map(([label, n]) => `${n} ${label}`)
    .join(' · ');

  return (
    <div
      className="mb-6 rounded-[12px] px-5 py-4"
      style={{ background: '#E3EDE9', border: '1px solid #1B4D3E' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold" style={{ color: '#1B4D3E' }}>
            ✓ {count} tab{count !== 1 ? 's' : ''} imported
          </p>
          {breakdown && (
            <p className="text-xs leading-relaxed" style={{ color: '#5C5B55' }}>{breakdown}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onReview}
            className="text-xs px-3 py-1.5 rounded-[6px] font-medium transition-colors hover:opacity-90"
            style={{ background: '#1B4D3E', color: '#FFFFFF' }}
          >
            Review imports
          </button>
          <button
            onClick={onDismiss}
            className="text-xs text-text-tertiary hover:text-text-primary transition-colors w-5 h-5
                       flex items-center justify-center"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Undo toast ───────────────────────────────────────────────────────────────

function UndoToast({
  count,
  onUndo,
  onDismiss,
}: {
  count: number;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-[10px] px-4 py-3 shadow-md"
      style={{ background: '#141413', minWidth: '240px', maxWidth: '320px' }}
    >
      <div className="flex items-center justify-between gap-6">
        <span className="text-sm text-white">
          {count} tab{count !== 1 ? 's' : ''} imported
        </span>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={onUndo}
            className="text-sm font-semibold transition-opacity hover:opacity-75"
            style={{ color: '#4ade80' }}
          >
            Undo
          </button>
          <button
            onClick={onDismiss}
            className="text-xs transition-opacity hover:opacity-75"
            style={{ color: 'rgba(255,255,255,0.4)' }}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>
      {/* 5-second countdown bar */}
      <div className="mt-2.5 h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.12)' }}>
        <div
          className="h-full rounded-full"
          style={{
            background: '#1B4D3E',
            transformOrigin: 'left',
            animation: 'toast-progress 5s linear forwards',
          }}
        />
      </div>
    </div>
  );
}

// ─── Review panel ─────────────────────────────────────────────────────────────

function ReviewRow({
  capture,
  catState,
  onLabelChange,
}: {
  capture: Capture;
  catState?: CatState;
  onLabelChange: (id: string, newLabel: CaptureLabel) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const displayText = (() => {
    if (capture.summary) {
      return capture.summary.length > 54 ? capture.summary.slice(0, 54) + '…' : capture.summary;
    }
    if (capture.source_url) {
      const u = capture.source_url;
      return u.length > 54 ? '…' + u.slice(-51) : u;
    }
    return '(capture)';
  })();

  return (
    <div className="flex items-start justify-between gap-2 px-3 py-2.5 rounded-[8px] hover:bg-surface-2 transition-colors group">
      <p className="text-xs text-text-secondary leading-relaxed flex-1 min-w-0 pt-0.5 break-all line-clamp-2">
        {displayText}
      </p>
      <div className="flex items-center gap-1 flex-shrink-0 pt-0.5" onClick={(e) => e.stopPropagation()}>
        {catState === 'pending' ? (
          <span className="inline-block w-3 h-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        ) : capture.label ? (
          <div className="relative">
            <button
              className="flex items-center gap-1"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <LabelChip label={capture.label} />
              <span className="text-[10px] text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity">
                ✎
              </span>
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute top-full right-0 mt-1 z-20 bg-surface border border-border
                                rounded-[10px] shadow-md py-1 min-w-[180px]">
                  {ALL_LABELS.map((l) => (
                    <button
                      key={l}
                      onClick={() => { onLabelChange(capture.id, l); setMenuOpen(false); }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-surface-2
                                  flex items-center gap-2 transition-colors
                                  ${l === capture.label ? 'text-accent font-medium' : 'text-text-primary'}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: LABEL_STYLES[l].dot }} />
                      {l}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : catState === 'error' ? (
          <span className="text-xs font-medium" style={{ color: '#b45309' }}>Error</span>
        ) : (
          <span className="text-xs font-mono text-text-tertiary">—</span>
        )}
      </div>
    </div>
  );
}

function ReviewPanel({
  importedIds,
  captures,
  catStates,
  onLabelChange,
  onDone,
}: {
  importedIds: string[];
  captures: Capture[];
  catStates: Record<string, CatState>;
  onLabelChange: (id: string, newLabel: CaptureLabel) => void;
  onDone: () => void;
}) {
  const importedCaptures = importedIds
    .map((id) => captures.find((c) => c.id === id))
    .filter((c): c is Capture => !!c);

  return (
    <aside className="w-80 flex-shrink-0 bg-surface border-l border-border flex flex-col h-screen">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-border flex items-center justify-between flex-shrink-0">
        <div>
          <p className="font-semibold text-text-primary" style={{ fontSize: '14px' }}>Just imported</p>
          <p className="text-text-tertiary mt-0.5" style={{ fontSize: '12px' }}>
            {importedIds.length} tab{importedIds.length !== 1 ? 's' : ''} — adjust labels
          </p>
        </div>
        <button
          onClick={onDone}
          className="text-xs px-3 py-1.5 rounded-[6px] font-medium transition-colors hover:opacity-90"
          style={{ background: '#1B4D3E', color: '#FFFFFF' }}
        >
          Done
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-2">
        {importedCaptures.length > 0 ? (
          importedCaptures.map((c) => (
            <ReviewRow
              key={c.id}
              capture={c}
              catState={catStates[c.id]}
              onLabelChange={onLabelChange}
            />
          ))
        ) : (
          <p className="text-xs text-text-tertiary text-center py-8 px-4">
            No captures found.
          </p>
        )}
      </div>
    </aside>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ view, setView }: { view: 'brief' | 'captures'; setView: (v: 'brief' | 'captures') => void }) {
  const navItem = (
    active: boolean,
    onClick: () => void,
    icon: React.ReactNode,
    label: string
  ) => (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-[8px] text-sm text-left
                  transition-colors duration-150
                  ${active ? 'font-medium' : 'font-normal text-text-secondary hover:bg-surface-2 hover:text-text-primary'}`}
      style={active ? { background: '#E3EDE9', color: '#1B4D3E' } : {}}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <aside className="w-[220px] flex-shrink-0 bg-surface border-r border-border flex flex-col h-screen">
      {/* Logo */}
      <div className="px-5 pt-6 pb-5">
        <p className="font-semibold text-text-primary" style={{ fontSize: '18px' }}>Wick</p>
        <p className="font-mono text-text-tertiary mt-1" style={{ fontSize: '11px' }}>From consumption to connection</p>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 px-3 flex-1">
        {navItem(
          view === 'captures',
          () => setView('captures'),
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" />
            <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" />
            <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" />
            <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" />
          </svg>,
          'Captures'
        )}
        {navItem(
          view === 'brief',
          () => setView('brief'),
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M9.5 1.5L3 9h5l-1.5 5.5L14 7H8.5L9.5 1.5z" fill="currentColor" />
          </svg>,
          'Brief'
        )}
        <Link
          href="/portfolio"
          className="flex items-center gap-2.5 px-3 py-2 rounded-[8px] text-sm font-normal
                     text-text-secondary hover:bg-surface-2 hover:text-text-primary
                     transition-colors duration-150"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <circle cx="6.5" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10 10l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Resources
        </Link>
      </nav>

      {/* Footer */}
      <div className="px-5 py-4">
        <p className="font-mono text-text-tertiary" style={{ fontSize: '10px' }}>v0.1 · designathon</p>
      </div>
    </aside>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [catStates, setCatStates] = useState<Record<string, CatState>>({});
  const [hydrated, setHydrated] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [view, setView] = useState<'brief' | 'captures'>('captures');

  // Import flow state
  const [importedIds, setImportedIds] = useState<string[]>([]);
  const [importStage, setImportStage] = useState<'idle' | 'importing' | 'done'>('idle');
  const [importSummary, setImportSummary] = useState<{
    count: number;
    ids: string[];
    byLabel: Partial<Record<CaptureLabel, number>>;
  } | null>(null);
  const [undoToast, setUndoToast] = useState<{ count: number; ids: string[] } | null>(null);
  const [reviewPanelOpen, setReviewPanelOpen] = useState(false);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle ?import= from browser extension
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const importParam = params.get('import');
    if (!importParam) return;

    window.history.replaceState({}, '', '/');

    const urls = importParam.split('|').filter(Boolean);
    if (urls.length === 0) return;

    setImportStage('importing');

    (async () => {
      const savedIds: string[] = [];
      for (const url of urls) {
        const saved = addCapture({ type: 'url', content: '', source_url: url });
        savedIds.push(saved.id);
        refresh();
        void categorize(saved);
        await delay(200);
      }
      setImportedIds(savedIds);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Detect when all imported captures have finished categorizing
  useEffect(() => {
    if (importStage !== 'importing' || importedIds.length === 0) return;

    const allDone = importedIds.every((id) => catStates[id] !== 'pending');
    if (!allDone) return;

    const byLabel: Partial<Record<CaptureLabel, number>> = {};
    for (const id of importedIds) {
      const cap = captures.find((c) => c.id === id);
      if (cap?.label) byLabel[cap.label] = (byLabel[cap.label] ?? 0) + 1;
    }

    setImportSummary({ count: importedIds.length, ids: importedIds, byLabel });
    setImportStage('done');

    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoToast({ count: importedIds.length, ids: importedIds });
    undoTimerRef.current = setTimeout(() => setUndoToast(null), 5000);
  }, [catStates, importedIds, importStage, captures]);

  useEffect(() => {
    getCaptures().forEach((c) => {
      const label = c.label as string;
      if (label === 'Case Study Fragment' || label === 'To-Do for Portfolio') {
        updateCapture(c.id, { label: 'Portfolio Notes' });
      } else if (label === 'Research') {
        updateCapture(c.id, { label: 'Study Material' });
      } else if (label === 'Inspiration') {
        updateCapture(c.id, { label: 'Design Inspiration' });
      } else if (label === 'Project Decision') {
        updateCapture(c.id, { label: 'Design Decisions' });
      }
    });
    setCaptures(getCaptures());
    setHydrated(true);
  }, []);

  function refresh() { setCaptures(getCaptures()); }

  async function categorize(capture: Capture) {
    setCatStates((prev) => ({ ...prev, [capture.id]: 'pending' }));
    try {
      const res = await fetch('/api/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: capture.content,
          source_url: capture.source_url,
          image_data_url: capture.image_data_url,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as {
        label: string; summary: string; themes: string[]; project_hint?: string;
      } | null;
      if (!data) throw new Error('null response');
      updateCapture(capture.id, {
        label: data.label as CaptureLabel,
        summary: data.summary,
        themes: data.themes,
        project_link: data.project_hint,
      });
      setCatStates((prev) => {
        const next = { ...prev };
        delete next[capture.id];
        return next;
      });
    } catch {
      setCatStates((prev) => ({ ...prev, [capture.id]: 'error' }));
    } finally {
      refresh();
    }
  }

  function handleSave(c: Capture) { refresh(); void categorize(c); }

  function handleDelete(id: string) {
    deleteCapture(id);
    setCatStates((prev) => { const next = { ...prev }; delete next[id]; return next; });
    refresh();
  }

  function handleMarkOpened(id: string) { updateCapture(id, { is_opened: true }); refresh(); }
  function handleLabelChange(id: string, newLabel: CaptureLabel) { updateCapture(id, { label: newLabel }); refresh(); }

  function handleSaveContent(id: string, content: string, shouldRecategorize: boolean) {
    updateCapture(id, { content });
    refresh();
    if (shouldRecategorize) {
      const updated = getCaptures().find((c) => c.id === id);
      if (updated) void categorize(updated);
    }
  }

  function handleUndo() {
    if (!undoToast) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    for (const id of undoToast.ids) {
      deleteCapture(id);
      setCatStates((prev) => { const next = { ...prev }; delete next[id]; return next; });
    }
    setUndoToast(null);
    setImportSummary(null);
    setImportedIds([]);
    setImportStage('idle');
    setReviewPanelOpen(false);
    refresh();
  }

  function handleCaptureLinkClick(id: string) {
    handleMarkOpened(id);
    setHighlightedId(id);
    setView('captures');
    setTimeout(() => {
      const el = document.querySelector(`[data-capture-id="${id}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
    setTimeout(() => setHighlightedId(null), 1600);
  }

  async function backfillAll() {
    const toProcess = captures.filter((c) => !c.label && catStates[c.id] !== 'pending');
    if (toProcess.length === 0) return;
    setBackfilling(true);
    for (let i = 0; i < toProcess.length; i++) {
      await categorize(toProcess[i]);
      if (i < toProcess.length - 1) await delay(1000);
    }
    setBackfilling(false);
  }

  const uncategorized = captures.filter((c) => !c.label);
  const labeled = captures.filter((c) => !!c.label);

  const boards: [CaptureLabel, Capture[]][] = (() => {
    const groups = new Map<CaptureLabel, Capture[]>();
    for (const c of labeled) {
      const existing = groups.get(c.label!) ?? [];
      existing.push(c);
      groups.set(c.label!, existing);
    }
    return Array.from(groups.entries()).sort(([, a], [, b]) => {
      const latestA = Math.max(...a.map((c) => new Date(c.captured_at).getTime()));
      const latestB = Math.max(...b.map((c) => new Date(c.captured_at).getTime()));
      return latestB - latestA;
    });
  })();

  const idleUncategorized = uncategorized.filter((c) => !catStates[c.id]);
  const hasAnything = captures.length > 0;

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      <Sidebar view={view} setView={setView} />

      <main className="flex-1 overflow-y-auto h-screen">
        <div className="px-10 py-8">

          {view === 'brief' ? (
            hydrated ? (
              <DailyBriefSection captures={captures} onCaptureLinkClick={handleCaptureLinkClick} />
            ) : null
          ) : (
            <>
              {/* Welcome header */}
              <div className="mb-8">
                <h1 className="font-semibold text-text-primary" style={{ fontSize: '28px', lineHeight: 1.2 }}>
                  Welcome Jyo!
                </h1>
                <p className="text-text-secondary mt-1 text-sm">Here&apos;s everything you&apos;ve been saving.</p>
              </div>

              {/* Spinner while import is in progress */}
              {importStage === 'importing' && (
                <div
                  className="mb-4 rounded-[10px] px-4 py-3 text-sm font-medium flex items-center gap-2"
                  style={{ background: '#E3EDE9', color: '#1B4D3E' }}
                >
                  <span className="inline-block w-3 h-3 border-2 border-[#1B4D3E]/30 border-t-[#1B4D3E] rounded-full animate-spin flex-shrink-0" />
                  Importing tabs from your browser…
                </div>
              )}

              {/* Summary banner after import completes */}
              {importSummary && (
                <ImportSummaryBanner
                  count={importSummary.count}
                  byLabel={importSummary.byLabel}
                  onReview={() => setReviewPanelOpen(true)}
                  onDismiss={() => setImportSummary(null)}
                />
              )}

              <CaptureForm onSave={handleSave} />

              {!hydrated ? null : !hasAnything ? (
                <div className="py-16 text-center">
                  <p className="text-text-secondary text-sm leading-relaxed">
                    Nothing here yet.{' '}
                    <span className="text-text-tertiary">Paste something and we&apos;ll figure out where it goes.</span>
                  </p>
                </div>
              ) : (
                <>
                  {/* Backfill */}
                  {idleUncategorized.length > 0 && (
                    <div className="mb-6 flex items-center justify-between py-2.5 px-4 rounded-[10px] bg-surface border border-border">
                      <span className="text-xs text-text-secondary">
                        {idleUncategorized.length} capture{idleUncategorized.length !== 1 ? 's' : ''} without a label
                      </span>
                      <button
                        onClick={() => void backfillAll()}
                        disabled={backfilling}
                        className="text-xs px-3 py-1.5 rounded-[6px] bg-accent text-white font-semibold
                                   hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed
                                   transition-colors duration-150"
                      >
                        {backfilling ? 'Categorizing…' : 'Categorize all'}
                      </button>
                    </div>
                  )}

                  {/* Just captured */}
                  {uncategorized.length > 0 && (
                    <section className="mb-8">
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <p className="font-mono uppercase text-text-tertiary" style={{ fontSize: '11px', letterSpacing: '0.1em' }}>
                          Just captured
                        </p>
                        <span className="font-mono text-text-tertiary" style={{ fontSize: '11px' }}>{uncategorized.length}</span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {uncategorized.map((c) => (
                          <CaptureCard
                            key={c.id}
                            capture={c}
                            catState={catStates[c.id]}
                            highlighted={highlightedId === c.id}
                            onRetry={() => void categorize(c)}
                            onDelete={handleDelete}
                            onMarkOpened={handleMarkOpened}
                            onSaveContent={handleSaveContent}
                            showLabel={false}
                          />
                        ))}
                      </div>
                    </section>
                  )}

                  {uncategorized.length > 0 && boards.length > 0 && (
                    <div className="h-px bg-divider mb-8" />
                  )}

                  {/* Label boards */}
                  {boards.map(([label, boardCaptures]) => (
                    <LabelBoard
                      key={label}
                      label={label}
                      captures={boardCaptures}
                      catStates={catStates}
                      highlightedId={highlightedId}
                      onRetry={(c) => void categorize(c)}
                      onDelete={handleDelete}
                      onMarkOpened={handleMarkOpened}
                      onLabelChange={handleLabelChange}
                      onSaveContent={handleSaveContent}
                    />
                  ))}
                </>
              )}
            </>
          )}

        </div>
      </main>

      {/* Review panel — slides in as right column */}
      {reviewPanelOpen && (
        <ReviewPanel
          importedIds={importedIds}
          captures={captures}
          catStates={catStates}
          onLabelChange={handleLabelChange}
          onDone={() => setReviewPanelOpen(false)}
        />
      )}

      {/* Undo toast — fixed bottom-center */}
      {undoToast && (
        <UndoToast
          count={undoToast.count}
          onUndo={handleUndo}
          onDismiss={() => {
            if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
            setUndoToast(null);
          }}
        />
      )}
    </div>
  );
}
