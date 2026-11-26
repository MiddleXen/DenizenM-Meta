#!/usr/bin/env node
/**
 * Prints the latest commit of every meta source branch (from meta-sources.json) as JSON:
 *   { "fingerprint": "<sha256 of all commits>", "sources": { "<zip url>": "<commit sha>" } }
 *
 * Used by .github/workflows/sync.yml to redeploy only when DenizenM, DenizenM-Core or an addon actually changed.
 * Uses `git ls-remote`, so it needs no token and is not subject to the GitHub REST API rate limit.
 * No dependencies: runs on a bare runner without `npm install`.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const listFile = fileURLToPath(new URL('../meta-sources.json', import.meta.url));
const { sources } = JSON.parse(readFileSync(listFile, 'utf8'));

function parseSource(url) {
  const m = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/archive\/(?:refs\/heads\/)?(.+)\.zip$/i.exec(url);
  if (!m) throw new Error(`Not a GitHub branch archive URL: ${url}`);
  return { repoUrl: `https://github.com/${m[1]}/${m[2]}.git`, branch: m[3] };
}

const result = {};
for (const url of sources) {
  const { repoUrl, branch } = parseSource(url);
  let out = '';
  for (let attempt = 1; attempt <= 3 && !out; attempt++) {
    try {
      out = execFileSync('git', ['ls-remote', repoUrl, `refs/heads/${branch}`], {
        encoding: 'utf8',
        timeout: 60_000,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      }).trim();
    } catch (err) {
      if (attempt === 3) throw err;
    }
  }
  const sha = out.split(/\s+/)[0];
  if (!/^[0-9a-f]{40}$/.test(sha || '')) {
    throw new Error(`Could not resolve ${repoUrl} ${branch} (got: ${JSON.stringify(out)})`);
  }
  result[url] = sha;
}

const fingerprint = createHash('sha256')
  .update(Object.entries(result).map(([u, s]) => `${u} ${s}`).join('\n'))
  .digest('hex');

process.stdout.write(JSON.stringify({ fingerprint, sources: result }, null, 2) + '\n');
