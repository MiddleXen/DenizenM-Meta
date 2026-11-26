/**
 * Build-time "What's new" generation (used by scripts/sync-meta.ts).
 *
 * Every sync writes two public files:
 *  - data/meta-index.json: one hash per documentation entry plus the source commits it was built from;
 *  - data/changelog.json: the history of syncs that changed something, plus recent commits per source repo.
 * The next sync diffs against the previous index. On Vercel the previous files are fetched from the live production
 * site (each build starts from a fresh checkout), elsewhere they are the local files; the newer of the two wins.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { MetaDocsData, BaseMetaObject } from './types';
import type { ChangeEntry, ChangeEntryType, Changelog, CommitInfo, MetaUpdate, SourceState } from './changelog-types';
import { hrefForSuggestion } from './suggestions';

export interface MetaIndex {
  generatedAt: string;
  /** source zip url -> commit sha */
  sourceCommits: Record<string, string>;
  /** `${type}:${cleanName}` -> [hash, display name] */
  entries: Record<string, [string, string]>;
}

const MAX_UPDATES = 40;
const MAX_LIST = 300;
const RECENT_COMMITS = 15;
const FETCH_TIMEOUT_MS = 15_000;

const KINDS: Array<[keyof MetaDocsData, ChangeEntryType]> = [
  ['commands', 'Command'],
  ['tags', 'Tag'],
  ['events', 'Event'],
  ['mechanisms', 'Mechanism'],
  ['actions', 'Action'],
  ['languages', 'Language'],
  ['objectTypes', 'ObjectType'],
];

/** Hash of what the source says about an entry (its raw meta block), ignoring line numbers and generated HTML. */
function entryHash(obj: BaseMetaObject): string {
  const basis = obj.rawValues ? JSON.stringify(obj.rawValues) : (obj.htmlContent || '').replace(/#L\d+/g, '');
  return crypto.createHash('sha1').update(basis).digest('hex').slice(0, 12);
}

export function buildMetaIndex(docs: MetaDocsData): MetaIndex {
  const entries: MetaIndex['entries'] = {};
  for (const [key, type] of KINDS) {
    const dict = docs[key] as Record<string, BaseMetaObject>;
    for (const obj of Object.values(dict)) {
      entries[`${type}:${obj.cleanName}`] = [entryHash(obj), obj.name];
    }
  }
  return { generatedAt: docs.lastReload, sourceCommits: docs.sourceCommits || {}, entries };
}

function parseSource(url: string): { repo: string; branch: string } | null {
  const m = /github\.com\/([^/]+\/[^/]+)\/archive\/(?:refs\/heads\/)?(.+)\.zip$/i.exec(url);
  return m ? { repo: m[1], branch: m[2] } : null;
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Latest commits of a branch from GitHub's public Atom feed (no token, no REST rate limit). */
export async function fetchCommitFeed(repo: string, branch: string): Promise<CommitInfo[]> {
  const res = await fetch(`https://github.com/${repo}/commits/${branch}.atom`, {
    headers: { 'User-Agent': 'DenizenMetaScanner/1.0', Accept: 'application/atom+xml' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`commit feed ${repo}: HTTP ${res.status}`);
  const xml = await res.text();
  const out: CommitInfo[] = [];
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const e = m[1];
    const sha = /Commit\/([0-9a-f]{40})/.exec(e)?.[1];
    if (!sha) continue;
    // The full message is in <content><pre>; <title> is cut at ~70 chars.
    const content = decodeXml(/<content[^>]*>([\s\S]*?)<\/content>/.exec(e)?.[1] || '');
    const fullMessage = decodeXml(content.replace(/<[^>]+>/g, '')).trim();
    const title = (fullMessage.split('\n')[0] || decodeXml(/<title>([\s\S]*?)<\/title>/.exec(e)?.[1] || '')).trim();
    out.push({
      sha,
      title: title.length > 160 ? title.slice(0, 159) + '…' : title,
      url: decodeXml(/<link[^>]*href="([^"]+)"/.exec(e)?.[1] || `https://github.com/${repo}/commit/${sha}`),
      date: /<updated>([^<]+)<\/updated>/.exec(e)?.[1] || '',
      author: decodeXml(/<author>\s*<name>([^<]*)<\/name>/.exec(e)?.[1] || ''),
    });
  }
  return out;
}

function entryFromKey(key: string, name: string): ChangeEntry {
  const sep = key.indexOf(':');
  const type = key.slice(0, sep) as ChangeEntryType;
  return { type, name, href: hrefForSuggestion(type, key.slice(sep + 1)) };
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

/** Base URL of the live site to chain history from, if known. */
export function productionSiteUrl(): string | null {
  const raw = process.env.META_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (!raw) return null;
  return (raw.startsWith('http') ? raw : `https://${raw}`).replace(/\/+$/, '');
}

/** Previous index + changelog: the live site's or the local files', whichever is newer. Call before overwriting. */
export async function loadPreviousState(outDir: string): Promise<{ index: MetaIndex | null; changelog: Changelog | null; from: string }> {
  const local = {
    index: readJson<MetaIndex>(path.join(outDir, 'meta-index.json')),
    changelog: readJson<Changelog>(path.join(outDir, 'changelog.json')),
    from: 'local files',
  };
  const site = productionSiteUrl();
  if (!site) return local;
  const [index, changelog] = await Promise.all([
    fetchJson<MetaIndex>(`${site}/data/meta-index.json`),
    fetchJson<Changelog>(`${site}/data/changelog.json`),
  ]);
  const remote = { index, changelog, from: site };
  const t = (x: { index: MetaIndex | null }) => (x.index ? Date.parse(x.index.generatedAt) || 0 : -1);
  return t(remote) > t(local) ? remote : local;
}

export async function buildChangelog(
  docs: MetaDocsData,
  index: MetaIndex,
  prev: { index: MetaIndex | null; changelog: Changelog | null }
): Promise<{ changelog: Changelog; update: MetaUpdate | null }> {
  const sourceUrls = Object.keys(index.sourceCommits);
  const parsed = sourceUrls
    .map((url) => ({ url, ...parseSource(url) }))
    .filter((s): s is { url: string; repo: string; branch: string } => !!s.repo);

  const feeds = new Map<string, CommitInfo[]>();
  await Promise.all(
    parsed.map(async (s) => {
      try {
        feeds.set(s.url, await fetchCommitFeed(s.repo, s.branch));
      } catch (err) {
        console.warn(`Could not read commits of ${s.repo}:`, (err as Error).message);
      }
    })
  );

  const sources: SourceState[] = parsed.map((s) => {
    const sha = index.sourceCommits[s.url];
    const head = feeds.get(s.url)?.find((c) => c.sha === sha);
    return { repo: s.repo, branch: s.branch, sha, date: head?.date };
  });

  const recentCommits: Record<string, CommitInfo[]> = {};
  for (const s of parsed) {
    const feed = feeds.get(s.url);
    recentCommits[s.repo] = feed ? feed.slice(0, RECENT_COMMITS) : prev.changelog?.recentCommits?.[s.repo] || [];
  }

  let update: MetaUpdate | null = null;
  if (prev.index) {
    const added: ChangeEntry[] = [];
    const removed: ChangeEntry[] = [];
    const changed: ChangeEntry[] = [];
    for (const [key, [hash, name]] of Object.entries(index.entries)) {
      const old = prev.index.entries[key];
      if (!old) added.push(entryFromKey(key, name));
      else if (old[0] !== hash) changed.push(entryFromKey(key, name));
    }
    for (const [key, [, name]] of Object.entries(prev.index.entries)) {
      if (!index.entries[key]) removed.push(entryFromKey(key, name));
    }

    const changedSources: MetaUpdate['sources'] = [];
    for (const s of parsed) {
      const sha = index.sourceCommits[s.url];
      const fromSha = prev.index.sourceCommits?.[s.url];
      if (!sha || sha === fromSha) continue;
      const feed = feeds.get(s.url) || [];
      const start = feed.findIndex((c) => c.sha === sha);
      const between: CommitInfo[] = [];
      let reachedOld = false;
      for (let i = Math.max(0, start); i < feed.length; i++) {
        if (feed[i].sha === fromSha) {
          reachedOld = true;
          break;
        }
        between.push(feed[i]);
      }
      changedSources.push({
        repo: s.repo,
        branch: s.branch,
        sha,
        fromSha,
        date: feed.find((c) => c.sha === sha)?.date,
        commits: fromSha ? between : between.slice(0, 1),
        moreCommits: !!fromSha && !reachedOld,
      });
    }

    if (added.length || removed.length || changed.length || changedSources.length) {
      const byName = (a: ChangeEntry, b: ChangeEntry) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name);
      update = {
        at: docs.lastReload,
        sources: changedSources,
        added: added.sort(byName).slice(0, MAX_LIST),
        removed: removed.sort(byName).slice(0, MAX_LIST),
        changed: changed.sort(byName).slice(0, MAX_LIST),
        counts: { added: added.length, removed: removed.length, changed: changed.length },
      };
    }
  }

  const updates = [...(update ? [update] : []), ...(prev.changelog?.updates || [])].slice(0, MAX_UPDATES);
  const dates = sources.map((s) => s.date).filter((d): d is string => !!d).sort();
  const changelog: Changelog = {
    generatedAt: docs.lastReload,
    contentUpdatedAt: dates[dates.length - 1] || prev.changelog?.contentUpdatedAt,
    sources,
    updates,
    recentCommits,
  };
  return { changelog, update };
}
