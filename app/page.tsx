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
  'UI Pattern':         { bg: '#EEF2FF', color: '#4338CA', dot: '#6366F1' },
  'Portfolio Notes':    { bg: '#FFF7ED', color: '#C2410C', dot: '#EA580C' },
  'Study Material':     { bg: '#ECFEFF', color: '#0E7490', dot: '#0891B2' },
  'Design Inspiration': { bg: '#FDF4FF', color: '#A21CAF', dot: '#DB2777' },
  'Design Decisions':   { bg: '#FEF3C7', color: '#92400E', dot: '#7C2D12' },
  'Interview Prep':     { bg: '#ECFDF5', color: '#065F46', dot: '#0D7A5F' },
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

// ─── Label chip ───────────────────────────────────────────────────────────────

function LabelChip({ label }: { label: CaptureLabel }) {
  const s = LABEL_STYLES[label];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium font-mono"
      style={{ background: s.bg, color: s.color }}
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
}: {
  captureId: string;
  capturesById: Map<string, Capture>;
  onClick: (id: string) => void;
}) {
  const capture = capturesById.get(captureId);
  if (!capture) return null;
  const raw = capture.summary || capture.content || '';
  const preview = raw.length > 55 ? raw.slice(0, 55) + '…' : raw;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(captureId); }}
      className="text-xs px-2.5 py-1 rounded-full border border-border bg-surface
                 text-text-secondary hover:border-accent hover:text-accent transition-colors
                 max-w-[220px] truncate text-left"
      title={capture.summary ?? capture.content ?? ''}
    >
      {preview || '(image capture)'}
    </button>
  );
}

// ─── Capture card ─────────────────────────────────────────────────────────────

function CaptureCard({
  capture,
  catState,
  highlighted,
  onRetry,
  onDelete,
  onMarkOpened,
  onLabelChange,
  showLabel = false,
}: {
  capture: Capture;
  catState?: CatState;
  highlighted?: boolean;
  onRetry?: () => void;
  onDelete: (id: string) => void;
  onMarkOpened: (id: string) => void;
  onLabelChange?: (id: string, newLabel: CaptureLabel) => void;
  showLabel?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [labelMenuOpen, setLabelMenuOpen] = useState(false);

  function handleCardClick() {
    setExpanded((e) => !e);
    if (!capture.is_opened) onMarkOpened(capture.id);
  }

  const isPending = catState === 'pending';
  const isError = catState === 'error';
  const contentText = capture.content;
  const previewText = expanded
    ? contentText
    : contentText.slice(0, 240) + (contentText.length > 240 ? '…' : '');

  const ringClass = highlighted
    ? 'ring-2 ring-accent ring-offset-1'
    : !capture.is_opened
    ? 'ring-1 ring-accent/10'
    : '';

  return (
    <article
      data-capture-id={capture.id}
      className={`bg-surface border border-border rounded-[12px] p-4 flex flex-col gap-3
        cursor-pointer group transition-all hover:shadow-sm ${ringClass}`}
      onClick={handleCardClick}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <time className="text-xs font-mono text-text-tertiary flex-shrink-0" dateTime={capture.captured_at}>
            {formatTimestamp(capture.captured_at)}
          </time>
          {!capture.is_opened && (
            <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" title="New" />
          )}
          {showLabel && capture.label && (
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-1">
                <LabelChip label={capture.label} />
                {onLabelChange && (
                  <button
                    onClick={() => setLabelMenuOpen((v) => !v)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity
                               text-text-tertiary hover:text-text-primary text-xs leading-none px-0.5"
                    aria-label="Change label"
                  >
                    ✎
                  </button>
                )}
              </div>
              {labelMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setLabelMenuOpen(false)}
                  />
                  <div className="absolute top-full left-0 mt-1 z-20 bg-surface border border-border
                                  rounded-[10px] shadow-lg py-1 min-w-[200px]">
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
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: LABEL_STYLES[l].dot }}
                        />
                        {l}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div
          className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
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
          <img
            src={capture.image_data_url}
            alt="Captured"
            className="w-full object-cover"
            style={{ maxHeight: expanded ? 'none' : '9rem' }}
          />
        </div>
      )}

      {capture.summary && (
        <p className="text-sm text-text-primary leading-relaxed">
          {expanded ? capture.summary : capture.summary.slice(0, 160) + (capture.summary.length > 160 ? '…' : '')}
        </p>
      )}

      {contentText && (!capture.summary || expanded) && (
        <p className="text-sm text-text-secondary leading-relaxed">{previewText}</p>
      )}

      {Array.isArray(capture.themes) && capture.themes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {capture.themes.map((t) => (
            <span key={t} className="text-xs font-mono px-2 py-0.5 rounded-full bg-surface-2 text-text-secondary">
              {t}
            </span>
          ))}
        </div>
      )}

      {capture.source_url && (
        <a
          href={capture.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline text-sm truncate block max-w-full"
          onClick={(e) => e.stopPropagation()}
        >
          {capture.source_url}
        </a>
      )}
    </article>
  );
}

function DeleteButton({ captureId, onDelete }: { captureId: string; onDelete: (id: string) => void }) {
  const [confirming, setConfirming] = useState(false);
  return confirming ? (
    <>
      <button
        onClick={() => onDelete(captureId)}
        className="text-xs px-2 py-1 rounded-[6px] bg-red-50 text-red-600 hover:bg-red-100 font-medium"
      >
        Delete
      </button>
      <button
        onClick={() => setConfirming(false)}
        className="text-xs px-2 py-1 rounded-[6px] text-text-secondary hover:bg-surface-2"
      >
        No
      </button>
    </>
  ) : (
    <button
      onClick={() => setConfirming(true)}
      className="text-xs px-2 py-1 rounded-[6px] text-text-tertiary hover:text-red-500 hover:bg-red-50"
      aria-label="Delete"
    >
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
}: {
  label: CaptureLabel;
  captures: Capture[];
  catStates: Record<string, CatState>;
  highlightedId: string | null;
  onRetry: (c: Capture) => void;
  onDelete: (id: string) => void;
  onMarkOpened: (id: string) => void;
  onLabelChange: (id: string, newLabel: CaptureLabel) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const s = LABEL_STYLES[label];

  // Auto-expand if a highlighted capture lives in this board
  useEffect(() => {
    if (highlightedId && captures.some((c) => c.id === highlightedId)) {
      setCollapsed(false);
    }
  }, [highlightedId, captures]);

  return (
    <section className="mb-6">
      <button
        className="w-full flex items-center justify-between py-2 px-1 group"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.dot }} />
          <span className="text-sm font-medium text-text-primary">{label}</span>
          <span className="text-xs font-mono text-text-tertiary">{captures.length}</span>
        </div>
        <span className="text-xs text-text-tertiary group-hover:text-text-secondary transition-colors">
          {collapsed ? '▶' : '▼'}
        </span>
      </button>

      {!collapsed && (
        <div className="flex flex-col gap-3 mt-2">
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
              showLabel={true}
            />
          ))}
        </div>
      )}
    </section>
  );
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
      // Strip image data — not needed for brief generation, keeps payload small
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

  return (
    <section className="mb-10">
      {/* Section header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-text-primary">
            Today&apos;s brief
          </h2>
          {brief && !generating && (
            <p className="text-xs font-mono text-text-tertiary mt-1">
              {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
              {' · '}generated {formatTimestamp(brief.generated_at)}
            </p>
          )}
        </div>
        {hasEnough && (
          <button
            onClick={() => void generate()}
            disabled={generating}
            className="flex-shrink-0 mt-0.5 text-xs px-3 py-1.5 rounded-[8px] border border-border
                       bg-surface text-text-secondary hover:border-accent hover:text-accent
                       transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-medium"
          >
            {generating ? 'Generating…' : brief ? 'Regenerate' : 'Generate brief'}
          </button>
        )}
      </div>

      {/* States */}
      {!hasEnough ? (
        <div className="py-8 text-center rounded-[12px] border border-dashed border-border">
          <p className="text-sm text-text-secondary">
            Save a few more captures and your brief will appear here.
          </p>
          <p className="text-xs font-mono text-text-tertiary mt-1">
            {captures.length} of 5 needed
          </p>
        </div>
      ) : generating ? (
        <div className="py-10 text-center rounded-[12px] border border-border bg-surface">
          <div className="inline-flex items-center gap-2 text-sm text-text-tertiary">
            <span className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            Structuring your brief…
          </div>
        </div>
      ) : genError ? (
        <div className="py-8 text-center rounded-[12px] border border-border bg-surface">
          <p className="text-sm text-text-secondary mb-3">
            Couldn&apos;t generate the brief.
          </p>
          <button
            onClick={() => void generate()}
            className="text-xs px-3 py-1.5 rounded-[8px] border border-border text-text-secondary
                       hover:border-accent hover:text-accent transition-colors"
          >
            Try again
          </button>
        </div>
      ) : !brief ? (
        <div className="py-10 text-center rounded-[12px] border border-dashed border-border">
          <p className="text-sm text-text-secondary mb-4">
            Ready to surface what matters today.
          </p>
          <button
            onClick={() => void generate()}
            className="text-sm px-5 py-2 rounded-[8px] bg-accent text-white font-medium
                       hover:opacity-90 transition-opacity"
          >
            Generate today&apos;s brief
          </button>
        </div>
      ) : (
        <div className="rounded-[12px] border border-border bg-surface p-6 flex flex-col gap-8">
          {/* Top 3 */}
          <div>
            <p className="text-xs font-mono text-text-tertiary uppercase tracking-widest mb-3">
              Top 3 today
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {brief.top_3.map((item, i) => (
                <div key={i} className="bg-surface-2 rounded-[12px] p-4 flex flex-col gap-2">
                  <p className="text-sm font-semibold text-text-primary leading-snug">{item.title}</p>
                  <p className="text-xs text-text-secondary leading-relaxed flex-1">{item.reasoning}</p>
                  {item.capture_ids.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {item.capture_ids.map((id) => (
                        <CaptureChip
                          key={id}
                          captureId={id}
                          capturesById={capturesById}
                          onClick={onCaptureLinkClick}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Connections */}
          <div>
            <p className="text-xs font-mono text-text-tertiary uppercase tracking-widest mb-3">
              Connections worth noticing
            </p>
            <div className="flex flex-col gap-3">
              {brief.connections.map((conn, i) => (
                <div key={i} className="bg-surface-2 rounded-[12px] p-4 flex flex-col gap-2">
                  <p className="text-sm text-text-primary leading-relaxed">{conn.description}</p>
                  {conn.capture_ids.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {conn.capture_ids.map((id) => (
                        <CaptureChip
                          key={id}
                          captureId={id}
                          capturesById={capturesById}
                          onClick={onCaptureLinkClick}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Nudge */}
          <div>
            <p className="text-xs font-mono text-text-tertiary uppercase tracking-widest mb-2">
              Nudge
            </p>
            <p className="text-sm text-text-secondary italic leading-relaxed">{brief.nudge}</p>
          </div>
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

  async function handleSave() {
    if (isEmpty) return;
    setSaving(true);
    let imageDataUrl: string | undefined;
    if (imageFile) imageDataUrl = await readFileAsDataURL(imageFile);

    const saved = addCapture({
      type: detectType(content, url, !!imageFile),
      content: content.trim(),
      source_url: url.trim() || undefined,
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
          className="flex items-center gap-2 px-4 py-2.5 rounded-[8px] border border-dashed border-border
                     text-sm text-text-secondary hover:border-accent hover:text-accent
                     transition-colors w-full justify-center group"
        >
          <span className="text-lg leading-none group-hover:text-accent">+</span>
          Capture something
        </button>
      ) : (
        <div className="bg-surface border border-border rounded-[12px] p-4 flex flex-col gap-3">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste text, a URL, or just a thought…"
            rows={3}
            className="w-full text-sm text-text-primary placeholder:text-text-tertiary
                       bg-transparent resize-none outline-none leading-relaxed"
          />
          <div className="h-px bg-divider" />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Source URL (optional)"
            className="w-full text-xs font-mono text-text-secondary placeholder:text-text-tertiary
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
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs px-3 py-1.5 rounded-[8px] bg-surface-2 text-text-secondary hover:bg-border transition-colors"
              >
                {imageFile ? '✓ Image added' : '+ Image'}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleCancel} className="text-xs px-3 py-1.5 rounded-[8px] text-text-secondary hover:text-text-primary">
                Cancel
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={isEmpty || saving}
                className="text-xs px-4 py-1.5 rounded-[8px] bg-accent text-white font-medium
                           hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              >
                {saving ? 'Saving…' : 'Save  ⌘↵'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [catStates, setCatStates] = useState<Record<string, CatState>>({});
  const [hydrated, setHydrated] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  useEffect(() => {
    // Migrate old label names to new ones
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

  function refresh() {
    setCaptures(getCaptures());
  }

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

  function handleSave(c: Capture) {
    refresh();
    void categorize(c);
  }

  function handleDelete(id: string) {
    deleteCapture(id);
    setCatStates((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    refresh();
  }

  function handleMarkOpened(id: string) {
    updateCapture(id, { is_opened: true });
    refresh();
  }

  function handleLabelChange(id: string, newLabel: CaptureLabel) {
    updateCapture(id, { label: newLabel });
    refresh();
  }

  function handleCaptureLinkClick(id: string) {
    handleMarkOpened(id);
    setHighlightedId(id);
    const el = document.querySelector(`[data-capture-id="${id}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => setHighlightedId(null), 1500);
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

  // ─── Derived state ───────────────────────────────────────────────────────────

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

  // ─── Render ──────────────────────────────────────────────────────────────────

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
                className="text-xs font-mono px-3 py-1.5 rounded-[8px] bg-accent-soft
                           text-accent font-medium"
              >
                Brief
              </Link>
              <Link
                href="/portfolio"
                className="text-xs font-mono px-3 py-1.5 rounded-[8px] text-text-secondary
                           hover:text-text-primary transition-colors"
              >
                Portfolio
              </Link>
            </nav>
          </div>
        </header>

        {/* Daily Brief — primary view */}
        {hydrated && (
          <DailyBriefSection
            captures={captures}
            onCaptureLinkClick={handleCaptureLinkClick}
          />
        )}

        {/* Divider between brief and capture area */}
        <div className="h-px bg-divider mb-8" />

        {/* Capture form */}
        <CaptureForm onSave={handleSave} />

        {!hydrated ? null : !hasAnything ? (
          /* ── Empty state ── */
          <div className="py-16 text-center">
            <p className="text-text-secondary text-sm leading-relaxed">
              Nothing here yet.{' '}
              <span className="text-text-tertiary">
                Paste something and we&apos;ll figure out where it goes.
              </span>
            </p>
          </div>
        ) : (
          <>
            {/* Backfill button */}
            {idleUncategorized.length > 0 && (
              <div className="mb-6 flex items-center justify-between py-2 px-3 rounded-[8px] bg-surface-2 border border-border">
                <span className="text-xs text-text-secondary">
                  {idleUncategorized.length} capture{idleUncategorized.length !== 1 ? 's' : ''} without a label
                </span>
                <button
                  onClick={() => void backfillAll()}
                  disabled={backfilling}
                  className="text-xs px-3 py-1.5 rounded-[6px] bg-accent text-white font-medium
                             hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                >
                  {backfilling ? 'Categorizing…' : 'Categorize all'}
                </button>
              </div>
            )}

            {/* Just captured */}
            {uncategorized.length > 0 && (
              <section className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-xs font-mono text-text-tertiary uppercase tracking-widest">
                    Just captured
                  </h2>
                  <span className="text-xs font-mono text-text-tertiary">{uncategorized.length}</span>
                </div>
                <div className="flex flex-col gap-3">
                  {uncategorized.map((c) => (
                    <CaptureCard
                      key={c.id}
                      capture={c}
                      catState={catStates[c.id]}
                      highlighted={highlightedId === c.id}
                      onRetry={() => void categorize(c)}
                      onDelete={handleDelete}
                      onMarkOpened={handleMarkOpened}
                      showLabel={false}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Divider */}
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
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
