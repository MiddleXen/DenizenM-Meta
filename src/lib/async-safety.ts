/**
 * DenizenM Async Safety Registry & Metadata Helper
 *
 * The live data is extracted from the Java sources on every meta sync (see `async-safety-parser.ts`):
 * command classes (`asyncSafe` / `setAsyncDeferrable` ...), the `@asyncsave` / `@asyncbase` / `@asynccmd` map in
 * CommonRegistries.java, and the `TagManager.markMainThreadOnly(...)` calls. It is stored in `denizen-meta.json`
 * and applied with `setAsyncSafetyData`, so a change in DenizenM, DenizenM-Core or an addon shows up on the next sync.
 *
 * `FALLBACK_ASYNC_SAFETY` below is only used when no markings could be found (eg custom `DENIZEN_SOURCES`).
 */

import type { AsyncSafetyData } from './async-safety-parser';

export type { AsyncSafetyData } from './async-safety-parser';

const FLAG_TAGS = ['flag', 'flag_expiration', 'flag_map', 'has_flag', 'list_flags'];

/** Snapshot of the markings as of 2026-11; only a fallback, the sync replaces it with what the sources say. */
export const FALLBACK_ASYNC_SAFETY: AsyncSafetyData = {
  commands: Object.fromEntries([
    ...[
      'async', 'choose', 'debug', 'debug-invalid-command', 'debugblock', 'define', 'definemap', 'determine', 'draw', 'else',
      'filecopy', 'fileread', 'filewrite', 'flag', 'foreach', 'goto', 'if', 'image', 'inject', 'log', 'mark', 'mongo',
      'random', 'ratelimit', 'redis', 'repeat', 'run', 'schematic', 'sql', 'stop', 'tablist', 'title', 'toast', 'wait',
      'waituntil', 'webget', 'webserver', 'while', 'yaml',
    ].map((n) => [n, { runsAsync: true, deferrable: false }]),
    ['actionbar', { runsAsync: true, deferrable: true, deferrableQualifier: 'per_player' }],
    ['announce', { runsAsync: true, deferrable: true }],
    ['narrate', { runsAsync: true, deferrable: true, deferrableQualifier: 'per_player' }],
    ['playeffect', { runsAsync: true, deferrable: true }],
    ['playsound', { runsAsync: true, deferrable: true }],
    ['sidebar', { runsAsync: true, deferrable: true, deferrableQualifier: 'per_player' }],
    ['compass', { runsAsync: false, deferrable: true }],
    ['fakeequip', { runsAsync: false, deferrable: true }],
    ['runlater', { runsAsync: false, deferrable: true, deferrableQualifier: 'id' }],
    ['showfake', { runsAsync: false, deferrable: true }],
  ]),
  safeAllTypes: [
    'binarytag', 'biometag', 'colortag', 'customobjecttag', 'durationtag', 'elementtag', 'enchantmenttag', 'imagetag',
    'javareflectedobjecttag', 'listtag', 'maptag', 'materialtag', 'plugintag', 'quaterniontag', 'queuetag', 'scripttag',
    'secrettag', 'timetag', 'tradetag',
  ],
  safeSubTags: {
    chunktag: ['add', 'cuboid', 'is_loaded', 'simple', 'sub', 'world', 'x', 'xz', 'z'],
    inventorytag: ['id_type', 'inventory_type', 'note_name'],
  },
  mainThreadBases: ['biome', 'entity', 'inventory', 'item', 'npc', 'player', 'plugin', 'server', 'world'],
  bareSafeBases: ['npc', 'player'],
  baseSafeSubTags: Object.fromEntries(
    ['biome', 'entity', 'inventory', 'item', 'plugin', 'world', 'server', 'player'].map((b) => [b, FLAG_TAGS])
  ),
  awareRepos: ['energobro/denizenm-core', 'energobro/denizenm-tjtoxshpilivili1'],
  mainThreadTypes: [
    'chunktag', 'cuboidtag', 'ellipsoidtag', 'entitytag', 'inventorytag', 'itemtag', 'locationtag', 'npctag', 'playertag',
    'polygontag', 'worldtag',
  ],
  typeMainThreadTags: { enchantmenttag: ['can_enchant', 'full_name'], materialtag: ['is_enabled'] },
};

// Script-memory bases and constructor aliases that are not object types but are always safe (they read the queue's own data).
const QUEUE_MEMORY_BASES = new Set(['definition', 'def', 'context', 'entry', 'proc', 'static', 'tern', 'list_single', 'reflected', 'custom_object']);

// Minecraft color and formatting codes that evaluate statically off-thread
const COLOR_FORMATTING_TAGS = new Set<string>([
  'aqua', 'black', 'blue', 'bold', 'dark_aqua', 'dark_blue', 'dark_gray',
  'dark_green', 'dark_purple', 'dark_red', 'gold', 'gray', 'green', 'italic',
  'light_purple', 'magic', 'red', 'reset', 'strikethrough', 'underline', 'white', 'yellow',
]);

interface ActiveState {
  data: AsyncSafetyData;
  safeAll: Set<string>;
  safeSub: Map<string, Set<string>>;
  mainBases: Set<string>;
  bareBases: Set<string>;
  baseSub: Map<string, Set<string>>;
  awareRepos: string[];
  mainTypes: Set<string>;
  typeTags: Map<string, Set<string>>;
}

function buildState(data: AsyncSafetyData): ActiveState {
  const toMap = (rec: Record<string, string[]>) =>
    new Map(Object.entries(rec || {}).map(([k, v]) => [k.toLowerCase(), new Set(v.map((s) => s.toLowerCase()))]));
  return {
    data,
    safeAll: new Set((data.safeAllTypes || []).map((s) => s.toLowerCase())),
    safeSub: toMap(data.safeSubTags),
    mainBases: new Set((data.mainThreadBases || []).map((s) => s.toLowerCase())),
    bareBases: new Set((data.bareSafeBases || []).map((s) => s.toLowerCase())),
    baseSub: toMap(data.baseSafeSubTags),
    awareRepos: (data.awareRepos || []).map((s) => s.toLowerCase()),
    // Meta synced before these were parsed has no such fields: fall back to the snapshot rather than to "nothing marked".
    mainTypes: new Set((data.mainThreadTypes || FALLBACK_ASYNC_SAFETY.mainThreadTypes || []).map((s) => s.toLowerCase())),
    typeTags: toMap(data.typeMainThreadTags || FALLBACK_ASYNC_SAFETY.typeMainThreadTags || {}),
  };
}

// Kept on globalThis so every server bundle that imports this module sees the same data.
const STATE_KEY = Symbol.for('denizenm.asyncSafetyState');
type GlobalWithState = typeof globalThis & { [STATE_KEY]?: ActiveState };

function state(): ActiveState {
  const g = globalThis as GlobalWithState;
  if (!g[STATE_KEY]) g[STATE_KEY] = buildState(FALLBACK_ASYNC_SAFETY);
  return g[STATE_KEY]!;
}

/** Applies freshly parsed (or loaded) markings; `null` / missing keeps the built-in fallback. */
export function setAsyncSafetyData(data: AsyncSafetyData | null | undefined): void {
  (globalThis as GlobalWithState)[STATE_KEY] = buildState(data && data.commands ? data : FALLBACK_ASYNC_SAFETY);
}

export function getAsyncSafetyData(): AsyncSafetyData {
  return state().data;
}

/** True when the entry comes from a source that actually declares async markings (DenizenM / DenizenM-Core). */
function isAwareSource(sourceFile?: string): boolean {
  if (!sourceFile) return true;
  const low = sourceFile.toLowerCase();
  return state().awareRepos.some((repo) => low.includes(`github.com/${repo}/`));
}

export interface CommandAsyncInfo {
  runsAsync: boolean;
  deferrable: boolean;
  deferrableDetails?: string;
  badgeHtml: string;
  descriptionText: string;
}

function makeSafeBadge(text: string): string {
  return `<span class="badge-async-safe">${text}</span>`;
}

function makeDeferBadge(text: string): string {
  return `<span class="badge-async-defer">${text}</span>`;
}

function makeMainBadge(text: string): string {
  return `<span class="badge-async-main">${text}</span>`;
}

function makeUnverifiedBadge(text: string): string {
  return `<span class="badge-async-unverified">${text}</span>`;
}

function describeDeferQualifier(qualifier?: string): string {
  if (!qualifier) return 'Deferrable: fired to the main thread without waiting';
  if (qualifier === 'per_player') return 'Deferrable when targeting per-player';
  if (qualifier === 'id') return 'Deferrable with persistent id';
  return `Deferrable when used with ${qualifier.replace(/_/g, ' ')}`;
}

export function getCommandAsyncStatus(commandName: string): CommandAsyncInfo {
  const clean = commandName.trim().toLowerCase();
  const marking = state().data.commands[clean];
  const runsAsync = !!marking?.runsAsync;
  const deferrable = !!marking?.deferrable;
  const conditional = !!marking?.runsAsyncConditional;
  const deferrableDetails = deferrable ? describeDeferQualifier(marking?.deferrableQualifier) : undefined;
  const runText = conditional
    ? `Runs on the async queue's worker thread for most uses (depends on its arguments, see the command description); otherwise handed to the main thread.`
    : `Runs directly on the async queue's worker thread without main-thread hand-off.`;

  if (runsAsync && deferrable) {
    return {
      runsAsync: true,
      deferrable: true,
      deferrableDetails,
      badgeHtml: `${makeSafeBadge('Runs Off-Thread')} ${makeDeferBadge('Deferrable')}`,
      descriptionText: `${runText} Also deferrable (${deferrableDetails!.toLowerCase()}).`,
    };
  }

  if (runsAsync) {
    return {
      runsAsync: true,
      deferrable: false,
      badgeHtml: makeSafeBadge('Runs Off-Thread'),
      descriptionText: runText,
    };
  }

  if (deferrable) {
    return {
      runsAsync: false,
      deferrable: true,
      deferrableDetails,
      badgeHtml: makeDeferBadge('Deferrable'),
      descriptionText: `${deferrableDetails}. Async scripts fire this to the main thread and continue immediately without waiting.`,
    };
  }

  return {
    runsAsync: false,
    deferrable: false,
    badgeHtml: makeMainBadge('Main Thread Hand-Off'),
    descriptionText: `Requires live server state; automatically dispatched to the main thread when executed from an async queue.`,
  };
}

/**
 * - safe: DenizenM declares it safe off the main thread.
 * - main: DenizenM hands it to the main thread when an async queue reads it.
 * - unverified: from an addon that marks nothing, so DenizenM runs it in place on the async thread, but nobody has
 *   declared that this is safe (it may read live plugin / world state).
 */
export type AsyncStatus = 'safe' | 'main' | 'unverified';

export interface TagAsyncInfo {
  status: AsyncStatus;
  isSafe: boolean;
  badgeHtml: string;
  descriptionText: string;
}

const SAFE = (descriptionText: string): TagAsyncInfo => ({
  status: 'safe',
  isSafe: true,
  badgeHtml: makeSafeBadge('Async-Safe'),
  descriptionText,
});

const MAIN = (descriptionText: string): TagAsyncInfo => ({
  status: 'main',
  isSafe: false,
  badgeHtml: makeMainBadge('Main Thread Hand-Off'),
  descriptionText,
});

const UNVERIFIED_BADGE = 'Off-Thread · Unverified';

const UNVERIFIED = (descriptionText: string): TagAsyncInfo => ({
  status: 'unverified',
  isSafe: false,
  badgeHtml: makeUnverifiedBadge(UNVERIFIED_BADGE),
  descriptionText,
});

const UNVERIFIED_TAG = UNVERIFIED(
  `Not marked by the addon: runs directly on the async thread. May be unsafe if it reads live plugin data.`
);

const MAIN_DEFAULT = MAIN(
  `Reads live server state; automatically evaluated on the main thread when called from an async queue.`
);

export function getTagAsyncStatus(
  cleanTagName: string,
  beforeDotRaw = '',
  afterDotRaw = '',
  sourceFile?: string
): TagAsyncInfo {
  const st = state();
  const cleanTag = cleanTagName.trim().toLowerCase();
  const beforeDot = (beforeDotRaw || (cleanTag.includes('.') ? cleanTag.split('.')[0] : cleanTag)).toLowerCase();
  const afterDot = (afterDotRaw || (cleanTag.includes('.') ? cleanTag.slice(beforeDot.length + 1) : '')).toLowerCase();
  const firstAttr = afterDot.split('.')[0].replace(/\[.*\]/g, '').trim();
  const aware = isAwareSource(sourceFile);

  // 0. Base tags (eg <color[...]>, <list[...]>, <red>, <&a>, <player>, <location[...]>)
  if (beforeDot === 'base') {
    const target = (firstAttr || cleanTag).replace(/\[.*\]/g, '').trim();
    if (COLOR_FORMATTING_TAGS.has(target) || target.startsWith('&')) {
      return SAFE(`Pure static formatting code: evaluates directly on the async worker thread with 0ms latency.`);
    }
    if (st.mainBases.has(target)) {
      if (st.bareBases.has(target)) {
        return SAFE(
          `Written bare (<${target}>) it hands back the queue's linked object with no main-thread hand-off. With a parameter, or followed by a sub-tag that is not async-safe, it is handed to the main thread.`
        );
      }
      return MAIN(`Reads live server state; automatically dispatched to the main thread when evaluated from an async queue.`);
    }
    // An addon's constructor (eg <mythicmob[...]>, <town[...]>) usually looks the object up in the plugin's own data.
    if (!aware) return UNVERIFIED_TAG;
    return SAFE(`Pure data constructor / static format: evaluates directly on the async worker thread (0ms latency, no main-thread hand-off).`);
  }

  // 1. Object types (eg <ElementTag.x>, <PlayerTag.name>). Type markings apply to every tag on the type,
  //    including extension tags an addon registers onto it.
  if (beforeDot.endsWith('tag')) {
    if (st.typeTags.get(beforeDot)?.has(firstAttr)) {
      return MAIN(`Fetches live server state although the type itself is plain data: handed to the main thread when called from an async queue.`);
    }
    const sub = st.safeSub.get(beforeDot);
    if (st.mainTypes.has(beforeDot) || (sub && !st.safeAll.has(beforeDot))) {
      if (sub && sub.has(firstAttr)) {
        return SAFE(`Memory / cached field: safe off the main thread (0ms latency, thread-safe access).`);
      }
      return MAIN_DEFAULT;
    }
    if (st.safeAll.has(beforeDot)) {
      // An addon's extension tag on a pure-data type still runs in place, but the addon never said it only reads that data.
      if (!aware) return UNVERIFIED_TAG;
      return SAFE(`Pure data processing: evaluates directly on the async script's worker thread (0ms latency, no main-thread hand-off).`);
    }
    // A type DenizenM does not mark at all: an addon's own type (DiscordUserTag, MythicMobsMobTag, TownTag, ...).
    return aware ? MAIN_DEFAULT : UNVERIFIED_TAG;
  }

  if (QUEUE_MEMORY_BASES.has(beforeDot)) {
    return SAFE(`Reads the queue's own data: evaluates directly on the async worker thread.`);
  }

  // 2. Lower-case tag bases (eg <server.x>, <util.x>, <yaml[...].x>)
  if (st.mainBases.has(beforeDot)) {
    const sub = st.baseSub.get(beforeDot);
    if (sub && sub.has(firstAttr)) {
      return SAFE(
        beforeDot === 'server'
          ? `Static server registry / saved data: safe off the main thread.`
          : `Thread-safe data (eg flags): safe off the main thread.`
      );
    }
    return MAIN_DEFAULT;
  }

  // Addon tag bases (<mythicmobs.x>, <luckperms.x>, ...): DenizenM only hands over bases that are marked, and no addon marks any.
  if (!aware) return UNVERIFIED_TAG;

  // Interface-like pseudo types (AreaObject, ObjectTag, VectorObject, ...) depend on the real object; stay conservative.
  if (/[A-Z]/.test(beforeDotRaw)) {
    return MAIN_DEFAULT;
  }

  // Bases that are not marked main-thread-only run in place on the async thread (see <@link language Async Tag Safety>).
  return SAFE(`Tag base is not marked main-thread-only: runs directly on the async script's thread.`);
}

export function getObjectTypeAsyncStatus(cleanTypeName: string, sourceFile?: string): {
  isFullSafe: boolean;
  isPartial: boolean;
  isUnverified: boolean;
  safeCount: number;
  badgeHtml: string;
  descriptionText: string;
} {
  const st = state();
  const low = cleanTypeName.toLowerCase();
  const clean = low.endsWith('tag') ? low : low + 'tag';

  if (st.safeAll.has(clean)) {
    return {
      isFullSafe: true,
      isPartial: false,
      isUnverified: false,
      safeCount: 999,
      badgeHtml: makeSafeBadge('Fully Async-Safe'),
      descriptionText: `Every tag on this object type is completely safe off the main thread. Pure data processing.`,
    };
  }

  // Pseudo types that are really tag bases (eg 'server'): use the base's safe sub-tags.
  const set = st.safeSub.get(clean) || (st.mainBases.has(low) ? st.baseSub.get(low) : undefined);
  if (set && set.size > 0) {
    return {
      isFullSafe: false,
      isPartial: true,
      isUnverified: false,
      safeCount: set.size,
      badgeHtml: makeDeferBadge(`Partial Async-Safe (${set.size} tags)`),
      descriptionText: `${set.size} sub-tags are safe off the main thread (${[...set].slice(0, 6).join(', ')}${set.size > 6 ? ', …' : ''}). Live server reads hand off.`,
    };
  }

  if (!st.mainTypes.has(clean) && !isAwareSource(sourceFile)) {
    return {
      isFullSafe: false,
      isPartial: false,
      isUnverified: true,
      safeCount: 0,
      badgeHtml: makeUnverifiedBadge(UNVERIFIED_BADGE),
      descriptionText: `Not marked by the addon: its tags run directly on the async thread. Safety is not declared.`,
    };
  }

  return {
    isFullSafe: false,
    isPartial: false,
    isUnverified: false,
    safeCount: 0,
    badgeHtml: makeMainBadge('Main Thread Only'),
    descriptionText: `Object wraps live Minecraft / Bukkit entities or state. Tags require main thread execution.`,
  };
}

/** Plain-text body of the generated "Async Tag Safety Map" language page. */
export function describeAsyncSafetyMap(): string {
  const d = state().data;
  const typeName = (low: string) => low.replace(/tag$/, '').replace(/^./, (c) => c.toUpperCase()) + 'Tag';
  const cmds = Object.entries(d.commands);
  const runs = cmds.filter(([, m]) => m.runsAsync).map(([n, m]) => (m.runsAsyncConditional ? `${n}*` : n));
  const defer = cmds
    .filter(([, m]) => m.deferrable)
    .map(([n, m]) => (m.deferrableQualifier ? `${n}(${m.deferrableQualifier})` : n));
  const partial = Object.entries(d.safeSubTags).sort(([a], [b]) => a.localeCompare(b));
  const baseSub = Object.entries(d.baseSafeSubTags).filter(([, v]) => v.length > 0);

  return (
    `Complete machine-readable mapping of DenizenM Async Safety for commands, tag bases, and object types.\n` +
    `Generated automatically from the DenizenM / DenizenM-Core sources on every sync.\n\n` +
    `=== ASYNC COMMAND MAP ===\n` +
    `Commands an async queue can run directly on its own thread (${runs.length} commands, * = depends on arguments):\n` +
    `${runs.join(', ')}.\n\n` +
    `Deferrable commands (can be dispatched to main thread without stalling the async script):\n` +
    `${defer.join(', ')}.\n\n` +
    `=== ASYNC TAG SAFETY MAP ===\n` +
    `Object types where 100% of tags are safe off the main thread (pure data / immutable objects):\n` +
    `${d.safeAllTypes.map(typeName).join(', ')}.\n\n` +
    `Object types with specific async-safe sub-tags (anything not listed is handed to the main thread):\n` +
    partial.map(([t, list]) => `- ${typeName(t)}: ${list.length ? list.join(', ') : '(none)'}`).join('\n') +
    (Object.keys(d.typeMainThreadTags || {}).length
      ? `\n\nPure-data object types with a few tags that still go to the main thread:\n` +
        Object.entries(d.typeMainThreadTags || {})
          .map(([t, list]) => `- ${typeName(t)}: ${list.join(', ')}`)
          .join('\n')
      : '') +
    `\n\n=== TAG BASES ===\n` +
    `- mainThreadOnly: ${d.mainThreadBases.join(', ')}\n` +
    `- bareSafe: ${d.bareSafeBases.join(', ')} (reading the bare base hands back the queue's linked object with 0 hand-offs)\n` +
    baseSub.map(([b, list]) => `- <${b}.*> safe sub-tags: ${list.join(', ')}`).join('\n') +
    `\n- Every other tag base is not marked, and runs directly on the async script's own thread.\n\n` +
    `=== ADDONS ===\n` +
    `Addons (Depenizen, dDiscordBot, ...) mark nothing, so their tag bases, their own object types and their extension tags on ` +
    `pure-data types run directly on the async thread. These are shown as "${UNVERIFIED_BADGE}": nobody has declared them safe.\n` +
    `Their extension tags on main-thread-only types (eg <EntityTag.mythicmob>) are still handed to the main thread as usual.`
  );
}
