import fsp from 'node:fs/promises';
import path from 'node:path';
import type { Changelog, MetaStatus } from './changelog-types';

const CHANGELOG_FILE = path.join(process.cwd(), 'public', 'data', 'changelog.json');
const TTL_MS = 60_000;

let cached: { at: number; value: MetaStatus | null } | null = null;

/** Small summary of public/data/changelog.json for the footer and the "What's new" badge (cached for a minute). */
export async function getMetaStatus(): Promise<MetaStatus | null> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  let value: MetaStatus | null = null;
  try {
    const log = JSON.parse(await fsp.readFile(CHANGELOG_FILE, 'utf8')) as Changelog;
    value = {
      generatedAt: log.generatedAt,
      contentUpdatedAt: log.contentUpdatedAt,
      latestUpdateAt: log.updates?.[0]?.at,
      sources: log.sources || [],
    };
  } catch {
    value = null;
  }
  cached = { at: Date.now(), value };
  return value;
}
