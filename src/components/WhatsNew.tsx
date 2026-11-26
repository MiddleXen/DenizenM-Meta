'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, GitCommitHorizontal, Minus, PenLine, Plus, Sparkles, X } from 'lucide-react';
import type { ChangeEntry, Changelog, CommitInfo, MetaStatus, MetaUpdate } from '@/lib/changelog-types';

/* ---------------------------------------------------------------------------------------------
 * "What's new": a modal with the documentation changes noticed by each sync and the latest
 * commits of the source repositories. Data comes from /data/changelog.json (written at build time).
 * ------------------------------------------------------------------------------------------- */

const SEEN_KEY = 'whatsnew-seen';

interface WhatsNewContextValue {
  status: MetaStatus | null;
  open: () => void;
  hasUnseen: boolean;
}

const WhatsNewContext = createContext<WhatsNewContextValue>({ status: null, open: () => {}, hasUnseen: false });

export function useWhatsNew() {
  return useContext(WhatsNewContext);
}

const repoName = (repo: string) => repo.split('/')[1] || repo;
const shortSha = (sha?: string) => (sha ? sha.slice(0, 7) : '');

const absoluteDate = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
    : '';

const rtf = typeof Intl !== 'undefined' && 'RelativeTimeFormat' in Intl ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' }) : null;

export function timeAgo(iso?: string): string {
  if (!iso) return '';
  const diffSec = (Date.parse(iso) - Date.now()) / 1000;
  if (!Number.isFinite(diffSec)) return '';
  const steps: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [unit, sec] of steps) {
    if (Math.abs(diffSec) >= sec) {
      const v = Math.round(diffSec / sec);
      return rtf ? rtf.format(v, unit) : `${Math.abs(v)} ${unit}${Math.abs(v) === 1 ? '' : 's'} ago`;
    }
  }
  return 'just now';
}

/** Relative time that renders the absolute date on the server (no hydration mismatch) and refines after mount. */
function RelativeTime({ iso, className }: { iso?: string; className?: string }) {
  const [label, setLabel] = useState(() => absoluteDate(iso));
  useEffect(() => {
    if (!iso) return;
    setLabel(timeAgo(iso));
    const t = setInterval(() => setLabel(timeAgo(iso)), 60_000);
    return () => clearInterval(t);
  }, [iso]);
  if (!iso) return null;
  return (
    <time dateTime={iso} title={new Date(iso).toUTCString()} className={className}>
      {label}
    </time>
  );
}

let changelogPromise: Promise<Changelog> | null = null;
function loadChangelog(): Promise<Changelog> {
  if (!changelogPromise) {
    changelogPromise = fetch('/data/changelog.json', { cache: 'no-cache' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<Changelog>;
      })
      .catch((e) => {
        changelogPromise = null;
        throw e;
      });
  }
  return changelogPromise;
}

export function WhatsNewProvider({ status, children }: { status: MetaStatus | null; children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnseen, setHasUnseen] = useState(false);

  useEffect(() => {
    if (!status?.latestUpdateAt) return;
    try {
      const seen = localStorage.getItem(SEEN_KEY) || '';
      setHasUnseen(seen < status.latestUpdateAt);
    } catch {
      // storage unavailable
    }
  }, [status?.latestUpdateAt]);

  const open = useCallback(() => {
    setIsOpen(true);
    setHasUnseen(false);
    if (status?.latestUpdateAt) {
      try {
        localStorage.setItem(SEEN_KEY, status.latestUpdateAt);
      } catch {
        // ignore
      }
    }
  }, [status?.latestUpdateAt]);

  const value = useMemo(() => ({ status, open, hasUnseen }), [status, open, hasUnseen]);

  return (
    <WhatsNewContext.Provider value={value}>
      {children}
      {isOpen && <WhatsNewModal onClose={() => setIsOpen(false)} />}
    </WhatsNewContext.Provider>
  );
}

/** Navbar icon button with an unseen-changes dot. */
export function WhatsNewButton({ className = '' }: { className?: string }) {
  const { open, hasUnseen } = useWhatsNew();
  return (
    <button
      type="button"
      onClick={open}
      title="What's new"
      aria-label="What's new: documentation changes and recent commits"
      className={`relative p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--accent-soft)] transition-colors cursor-pointer ${className}`}
    >
      <Sparkles className="w-4 h-4" />
      {hasUnseen && (
        <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--accent-primary)] ring-2 ring-[var(--header-bg)]" />
      )}
    </button>
  );
}

/** Mobile-menu row. */
export function WhatsNewMenuItem({ onSelect }: { onSelect?: () => void }) {
  const { open, hasUnseen } = useWhatsNew();
  return (
    <button
      type="button"
      onClick={() => {
        onSelect?.();
        open();
      }}
      className="w-full px-3 py-2.5 rounded-lg text-xs font-semibold text-left border bg-[var(--code-bg)] text-[var(--text-page)] border-[var(--table-border)] inline-flex items-center gap-2 cursor-pointer"
    >
      <Sparkles className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
      <span>What&apos;s new</span>
      {hasUnseen && <span className="ml-auto w-2 h-2 rounded-full bg-[var(--accent-primary)]" />}
    </button>
  );
}

/** Footer line: when the documented sources last changed, opening the modal on click. */
export function MetaUpdatedNote() {
  const { status, open } = useWhatsNew();
  if (!status) return null;
  const updated = status.contentUpdatedAt || status.generatedAt;
  const built = status.sources.map((s) => `${repoName(s.repo)} @ ${shortSha(s.sha)}${s.date ? ` (${absoluteDate(s.date)})` : ''}`).join('\n');
  return (
    <button
      type="button"
      onClick={open}
      title={`Built from:\n${built}\n\nLast checked: ${new Date(status.generatedAt).toUTCString()}`}
      className="inline-flex items-center gap-1.5 hover:text-[var(--accent-primary)] transition-colors cursor-pointer"
    >
      <span>
        Meta last updated <RelativeTime iso={updated} />
      </span>
      <span aria-hidden="true">·</span>
      <span className="underline underline-offset-2">What&apos;s new</span>
    </button>
  );
}

/* ------------------------------------------ Modal ------------------------------------------ */

type Tab = 'changes' | 'commits';

function WhatsNewModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('changes');
  const [data, setData] = useState<Changelog | null>(null);
  const [error, setError] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    loadChangelog()
      .then((d) => alive && setData(d))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.documentElement.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const hasUpdates = !!data && data.updates.length > 0;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-start sm:items-center justify-center bg-black/55 backdrop-blur-[2px] p-2 sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="whatsnew-title"
        className="w-full max-w-2xl max-h-[calc(100dvh-1rem)] sm:max-h-[85vh] flex flex-col rounded-2xl border border-[var(--table-border)] bg-[var(--card-bg)] shadow-2xl outline-none text-left"
      >
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 pt-4 pb-3 border-b border-[var(--row-border)]">
          <div className="min-w-0">
            <h2 id="whatsnew-title" className="font-display text-lg font-bold text-[var(--text-page)] inline-flex items-center gap-2">
              <Sparkles className="w-4.5 h-4.5 text-[var(--accent-primary)]" />
              What&apos;s new
            </h2>
            {data && (
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                Meta last updated <RelativeTime iso={data.contentUpdatedAt || data.generatedAt} /> · checked{' '}
                <RelativeTime iso={data.generatedAt} />
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-page)] hover:bg-[var(--accent-soft)] cursor-pointer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="flex gap-1 px-4 sm:px-5 pt-3" role="tablist">
          {(
            [
              ['changes', 'Doc changes'],
              ['commits', 'Commits'],
            ] as Array<[Tab, string]>
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                tab === id
                  ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)] border-[var(--accent-border)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-page)] border-transparent'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-5 py-3 text-sm">
          {error && <p className="text-[var(--text-muted)] text-xs py-6 text-center">Could not load the changelog.</p>}
          {!data && !error && <p className="text-[var(--text-muted)] text-xs py-6 text-center">Loading…</p>}
          {data && tab === 'changes' && (
            hasUpdates ? (
              <div className="space-y-3">
                {data.updates.map((u) => (
                  <UpdateCard key={u.at} update={u} onNavigate={onClose} />
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-[var(--text-muted)] leading-relaxed">
                No documentation changes recorded yet.
                <br />
                They show up here automatically whenever DenizenM, DenizenM-Core or an addon changes.{' '}
                <button type="button" className="underline cursor-pointer" onClick={() => setTab('commits')}>
                  See the latest commits
                </button>
                .
              </div>
            )
          )}
          {data && tab === 'commits' && <CommitsTab data={data} />}
        </div>
      </div>
    </div>
  );
}

function UpdateCard({ update, onNavigate }: { update: MetaUpdate; onNavigate: () => void }) {
  const { counts } = update;
  const noDocChanges = counts.added + counts.removed + counts.changed === 0;
  return (
    <section className="rounded-xl border border-[var(--table-border)] bg-[var(--code-bg)] p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold text-[var(--text-page)] text-[13px]">
          <RelativeTime iso={update.at} />
        </span>
        <span className="text-[11px] text-[var(--text-muted)]">{absoluteDate(update.at)}</span>
        <span className="ml-auto inline-flex gap-2 text-[11px] font-semibold">
          {counts.added > 0 && <span className="text-emerald-500">+{counts.added}</span>}
          {counts.removed > 0 && <span className="text-red-400">−{counts.removed}</span>}
          {counts.changed > 0 && <span className="text-amber-500">~{counts.changed}</span>}
        </span>
      </div>

      {update.sources.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {update.sources.map((s) => (
            <details key={s.repo} className="group">
              <summary className="cursor-pointer text-[11px] text-[var(--text-muted)] hover:text-[var(--text-page)] select-none">
                <span className="font-semibold text-[var(--text-page)]">{repoName(s.repo)}</span>{' '}
                {s.fromSha ? `${shortSha(s.fromSha)} → ` : ''}
                {shortSha(s.sha)}
                {s.commits.length > 0 && ` · ${s.commits.length}${s.moreCommits ? '+' : ''} commit${s.commits.length === 1 ? '' : 's'}`}
              </summary>
              <CommitList commits={s.commits} compact />
            </details>
          ))}
        </div>
      )}

      {noDocChanges ? (
        <p className="mt-2 text-[11px] text-[var(--text-muted)]">Source code changed, but no documentation entries did.</p>
      ) : (
        <div className="mt-2 space-y-2">
          <EntryGroup label="Added" icon={<Plus className="w-3 h-3" />} tone="text-emerald-500" entries={update.added} total={counts.added} onNavigate={onNavigate} />
          <EntryGroup label="Changed" icon={<PenLine className="w-3 h-3" />} tone="text-amber-500" entries={update.changed} total={counts.changed} onNavigate={onNavigate} />
          <EntryGroup label="Removed" icon={<Minus className="w-3 h-3" />} tone="text-red-400" entries={update.removed} total={counts.removed} removed />
        </div>
      )}
    </section>
  );
}

const COLLAPSED_ENTRIES = 12;

function EntryGroup({
  label,
  icon,
  tone,
  entries,
  total,
  removed,
  onNavigate,
}: {
  label: string;
  icon: React.ReactNode;
  tone: string;
  entries: ChangeEntry[];
  total: number;
  removed?: boolean;
  onNavigate?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (total === 0) return null;
  const shown = expanded ? entries : entries.slice(0, COLLAPSED_ENTRIES);
  return (
    <div>
      <div className={`text-[11px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ${tone}`}>
        {icon}
        {label} ({total})
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {shown.map((e) =>
          removed ? (
            <span
              key={e.type + e.name}
              className="px-2 py-0.5 rounded-md text-[11px] font-mono border border-[var(--table-border)] text-[var(--text-muted)] line-through"
              title={e.type}
            >
              {e.name}
            </span>
          ) : (
            <Link
              key={e.type + e.name}
              href={e.href}
              onClick={onNavigate}
              title={e.type}
              className="px-2 py-0.5 rounded-md text-[11px] font-mono border border-[var(--table-border)] bg-[var(--card-bg)] text-[var(--text-page)] hover:border-[var(--accent-border)] hover:text-[var(--accent-primary)] no-underline hover:no-underline"
            >
              {e.name}
            </Link>
          )
        )}
        {entries.length > COLLAPSED_ENTRIES && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="px-2 py-0.5 rounded-md text-[11px] text-[var(--accent-primary)] cursor-pointer"
          >
            {expanded ? 'Show less' : `+${entries.length - COLLAPSED_ENTRIES} more`}
          </button>
        )}
        {expanded && total > entries.length && (
          <span className="px-2 py-0.5 text-[11px] text-[var(--text-muted)]">…and {total - entries.length} more</span>
        )}
      </div>
    </div>
  );
}

function CommitList({ commits, compact }: { commits: CommitInfo[]; compact?: boolean }) {
  if (commits.length === 0) return <p className="text-[11px] text-[var(--text-muted)] mt-1">No commit details available.</p>;
  return (
    <ul className={`${compact ? 'mt-1 ml-1' : 'mt-1.5'} space-y-1`}>
      {commits.map((c) => (
        <li key={c.sha} className="flex items-start gap-2 text-[12px] leading-snug">
          <GitCommitHorizontal className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-[var(--text-muted)]" />
          <div className="min-w-0">
            <a
              href={c.url}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--text-page)] hover:text-[var(--accent-primary)] break-words"
            >
              {c.title || shortSha(c.sha)}
            </a>
            <div className="text-[10.5px] text-[var(--text-muted)]">
              <span className="font-mono">{shortSha(c.sha)}</span>
              {c.author && ` · ${c.author}`}
              {c.date && (
                <>
                  {' · '}
                  <RelativeTime iso={c.date} />
                </>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function CommitsTab({ data }: { data: Changelog }) {
  const repos = Object.keys(data.recentCommits);
  if (repos.length === 0) return <p className="text-[var(--text-muted)] text-xs py-6 text-center">No commits available.</p>;
  return (
    <div className="space-y-4">
      {repos.map((repo) => {
        const branch = data.sources.find((s) => s.repo === repo)?.branch;
        return (
          <section key={repo}>
            <a
              href={`https://github.com/${repo}${branch ? `/commits/${branch}` : ''}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[var(--text-page)] hover:text-[var(--accent-primary)]"
            >
              {repoName(repo)}
              <ExternalLink className="w-3 h-3" />
            </a>
            <CommitList commits={data.recentCommits[repo]} />
          </section>
        );
      })}
    </div>
  );
}
