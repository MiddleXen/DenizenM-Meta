/** Shapes of public/data/changelog.json, shared by the build script and the "What's new" UI. */

export type ChangeEntryType = 'Command' | 'Tag' | 'Event' | 'Mechanism' | 'Action' | 'Language' | 'ObjectType';

export interface ChangeEntry {
  type: ChangeEntryType;
  name: string;
  href: string;
}

export interface CommitInfo {
  sha: string;
  title: string;
  url: string;
  date: string;
  author: string;
}

export interface SourceState {
  /** `owner/repo` */
  repo: string;
  branch: string;
  sha: string;
  /** Commit date of `sha`, when the commit feed had it. */
  date?: string;
}

export interface MetaUpdate {
  /** When the sync that noticed this change ran. */
  at: string;
  /** Sources whose commit changed, with the commits in between (newest first). */
  sources: Array<SourceState & { fromSha?: string; commits: CommitInfo[]; moreCommits?: boolean }>;
  added: ChangeEntry[];
  removed: ChangeEntry[];
  changed: ChangeEntry[];
  /** Full counts when the lists above were capped. */
  counts: { added: number; removed: number; changed: number };
}

export interface Changelog {
  /** When this file was generated (= the last sync / check). */
  generatedAt: string;
  /** When the documented sources last changed: newest commit date among the sources. */
  contentUpdatedAt?: string;
  sources: SourceState[];
  /** Newest first. */
  updates: MetaUpdate[];
  /** Latest commits per repo (newest first), independent of the updates above. */
  recentCommits: Record<string, CommitInfo[]>;
}

/** Small status the layout passes to the client (no fetch needed for the footer / badge). */
export interface MetaStatus {
  generatedAt: string;
  contentUpdatedAt?: string;
  latestUpdateAt?: string;
  sources: SourceState[];
}
