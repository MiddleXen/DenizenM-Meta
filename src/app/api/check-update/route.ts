import { NextRequest, NextResponse } from 'next/server';
import type { Changelog } from '@/lib/changelog-types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/check-update - redeploys the site as soon as DenizenM, DenizenM-Core or an addon gets a new commit.
 *
 * Compares the source commits this deployment was built from (/data/changelog.json, written at build time) with
 * the current heads of those branches, and calls VERCEL_DEPLOY_HOOK only when they differ. Meant to be pinged by
 * a free external cron (e.g. cron-job.org, every 5 minutes): GitHub's own `schedule:` trigger runs only every few
 * hours on a quiet repository, so .github/workflows/sync.yml stays only as a fallback.
 *
 * Needs no token: it never deploys unless a source really changed, and repeated pings while that new build is
 * still running are held back by the cool-downs below.
 */

/** No second deploy for the same set of source heads within this time (covers the build of the first one). */
const SAME_STATE_COOLDOWN_MS = 60 * 60 * 1000;
/** No two deploys from this instance closer together than this, whatever changed. */
const ANY_DEPLOY_COOLDOWN_MS = 10 * 60 * 1000;

let lastDeployAt = 0;
const deployedStates = new Map<string, number>();

/** Head commit of a branch via git's smart-HTTP ref listing: no token and no REST API rate limit. */
async function branchHead(repo: string, branch: string): Promise<string | null> {
  const res = await fetch(`https://github.com/${repo}.git/info/refs?service=git-upload-pack`, {
    headers: { 'User-Agent': 'git/2.45 denizenm-meta-update-check' },
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`${repo}: HTTP ${res.status}`);
  const text = await res.text();
  const ref = `refs/heads/${branch}`;
  for (const line of text.split('\n')) {
    const m = /([0-9a-f]{40}) (\S+)/.exec(line);
    if (m && m[2].replace(/\0.*$/, '') === ref) return m[1];
  }
  return null;
}

export async function GET(req: NextRequest) {
  const noStore = { 'Cache-Control': 'no-store' };

  let changelog: Changelog;
  try {
    const res = await fetch(`${req.nextUrl.origin}/data/changelog.json`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    changelog = (await res.json()) as Changelog;
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `Could not read this deployment's changelog.json: ${(err as Error).message}` },
      { status: 502, headers: noStore }
    );
  }

  const sources = await Promise.all(
    (changelog.sources || []).map(async (s) => {
      try {
        const latest = await branchHead(s.repo, s.branch);
        return { repo: s.repo, branch: s.branch, deployed: s.sha, latest, changed: Boolean(latest && latest !== s.sha) };
      } catch (err) {
        return { repo: s.repo, branch: s.branch, deployed: s.sha, latest: null, changed: false, error: (err as Error).message };
      }
    })
  );

  const changed = sources.filter((s) => s.changed);
  const base = { ok: true, builtAt: changelog.generatedAt, sources };
  if (changed.length === 0) {
    return NextResponse.json({ ...base, upToDate: true, deployTriggered: false }, { headers: noStore });
  }

  const state = sources.map((s) => `${s.repo}@${s.latest ?? s.deployed}`).join(' ');
  const now = Date.now();
  for (const [key, at] of deployedStates) if (now - at > SAME_STATE_COOLDOWN_MS) deployedStates.delete(key);
  if (deployedStates.has(state) || now - lastDeployAt < ANY_DEPLOY_COOLDOWN_MS) {
    return NextResponse.json(
      { ...base, upToDate: false, deployTriggered: false, message: 'A redeploy for this change was already triggered; waiting for it to go live.' },
      { headers: noStore }
    );
  }

  const hook = process.env.VERCEL_DEPLOY_HOOK;
  if (!hook) {
    return NextResponse.json(
      { ...base, upToDate: false, deployTriggered: false, error: 'VERCEL_DEPLOY_HOOK is not set in the project environment.' },
      { status: 501, headers: noStore }
    );
  }

  try {
    const res = await fetch(hook, { method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`deploy hook answered HTTP ${res.status}`);
  } catch (err) {
    return NextResponse.json(
      { ...base, upToDate: false, deployTriggered: false, error: `Failed to trigger the deploy: ${(err as Error).message}` },
      { status: 502, headers: noStore }
    );
  }
  lastDeployAt = now;
  deployedStates.set(state, now);
  return NextResponse.json(
    {
      ...base,
      upToDate: false,
      deployTriggered: true,
      message: `New commits in ${changed.map((s) => s.repo).join(', ')}; redeploy started (live in a few minutes).`,
    },
    { headers: noStore }
  );
}
