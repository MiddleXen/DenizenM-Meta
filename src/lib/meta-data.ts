import fs from 'fs';
import path from 'path';
import { load } from 'js-yaml';

export interface ExtraDataSets {
  biomes: Set<string>;
  blocks: Set<string>;
  enchantments: Set<string>;
  effects: Set<string>;
  potion_effects: Set<string>;
  sounds: Set<string>;
  entities: Set<string>;
  potions: Set<string>;
  attributes: Set<string>;
  particles: Set<string>;
  items: Set<string>;
  gamerules: Set<string>;
  statistics: Set<string>;
  itemArray: string[];
  blockArray: string[];
  entityArray: string[];
}

let cachedExtraData: ExtraDataSets | null = null;

const SpecialEntityMatchables = new Set([
  'entity',
  'npc',
  'player',
  'living',
  'vehicle',
  'fish',
  'projectile',
  'hanging',
  'monster',
  'mob',
  'animal',
]);

const ItemCouldMatchPrefixes = new Set([
  'item_flagged',
  'vanilla_tagged',
  'item_enchanted',
  'material_flagged',
  'raw_exact',
]);

const InventoryMatchers = new Set([
  'inventory',
  'notable',
  'note',
  'npc',
  'player',
  'crafting',
  'enderchest',
  'workbench',
  'entity',
  'location',
  'generic',
  'chest',
  'dispenser',
  'dropper',
  'furnace',
  'workbench',
  'crafting',
  'enchanting',
  'brewing',
  'player',
  'creative',
  'merchant',
  'ender_chest',
  'anvil',
  'smithing',
  'beacon',
  'hopper',
  'shulker_box',
  'barrel',
  'blast_furnace',
  'lectern',
  'smoker',
  'loom',
  'cartography',
  'grindstone',
  'stonecutter',
  'composter',
]);

const SpecialEntityArray = Array.from(SpecialEntityMatchables);
const InventoryMatcherArray = Array.from(InventoryMatchers);

/** Deterministic PRNG (FNV-1a hash + Mulberry32) so generated examples are stable across builds. */
export function createSeededRng(seed: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomPick<T>(arr: T[], rng: () => number = Math.random): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function loadExtraData(): ExtraDataSets {
  if (cachedExtraData) {
    return cachedExtraData;
  }

  const fdsPath = path.join(process.cwd(), 'public', 'data', 'minecraft.fds');
  let raw: Record<string, string[]> = {};
  try {
    if (fs.existsSync(fdsPath)) {
      const content = fs.readFileSync(fdsPath, 'utf8');
      raw = (load(content) as Record<string, string[]>) || {};
    }
  } catch (err) {
    console.error('Failed to load minecraft.fds:', err);
  }

  const getSet = (key: string): Set<string> => {
    const list = raw[key.toLowerCase()] || [];
    return new Set(list.map((s) => String(s).toLowerCase()));
  };

  const biomes = getSet('biomes');
  const blocks = getSet('blocks');
  const enchantments = getSet('enchantments');
  const effects = getSet('effects');
  const potion_effects = getSet('potion_effects');
  const sounds = getSet('sounds');
  const entities = getSet('entities');
  const potions = getSet('potions');
  const attributes = getSet('attributes');
  const particles = getSet('particles');
  const items = getSet('items');
  const gamerules = getSet('gamerules');
  const statistics = getSet('statistics');

  const itemArray = Array.from(items);
  const blockArray = Array.from(blocks);
  const entityArray = Array.from(entities);

  cachedExtraData = {
    biomes,
    blocks,
    enchantments,
    effects,
    potion_effects,
    sounds,
    entities,
    potions,
    attributes,
    particles,
    items,
    gamerules,
    statistics,
    itemArray: itemArray.length > 0 ? itemArray : ['stone', 'diamond_sword'],
    blockArray: blockArray.length > 0 ? blockArray : ['stone', 'dirt'],
    entityArray: entityArray.length > 0 ? entityArray : ['zombie', 'skeleton'],
  };

  return cachedExtraData;
}

export function suggestExampleFor(type: string, data: ExtraDataSets, rng: () => number = Math.random): string {
  if (type.startsWith("'") && type.endsWith("'")) {
    return type.slice(1, -1);
  }
  if (rng() > 0.7) {
    return type;
  }
  switch (type.toLowerCase()) {
    case 'entity':
      return rng() > 0.5 ? randomPick(SpecialEntityArray, rng) : randomPick(data.entityArray, rng);
    case 'projectile':
      return randomPick(['projectile', 'arrow', 'snowball'], rng);
    case 'vehicle':
      return randomPick(['vehicle', 'minecart', 'horse'], rng);
    case 'item':
      return randomPick(data.itemArray, rng);
    case 'block':
      return randomPick(data.blockArray, rng);
    case 'material':
      return rng() > 0.5 ? randomPick(data.blockArray, rng) : randomPick(data.itemArray, rng);
    case 'area':
      return randomPick(['area', 'cuboid', 'polygon'], rng);
    case 'inventory':
      return randomPick(InventoryMatcherArray, rng);
    case 'world':
      return randomPick(['world', 'world_nether', 'world_the_end', 'space', 'survivalland'], rng);
    default:
      return type;
  }
}

export function createValidators(data: ExtraDataSets): Record<string, (word: string, precise: boolean) => number> {
  const matchEntity = (word: string, _precise: boolean) => {
    if (
      word.startsWith('entity_flagged:') ||
      word.startsWith('player_flagged:') ||
      word.startsWith('npc_flagged:') ||
      SpecialEntityMatchables.has(word) ||
      data.entities.has(word)
    ) {
      return 10;
    }
    if (data.blocks.has(word) || data.items.has(word)) {
      return 0;
    }
    return 1;
  };

  const matchItem = (word: string, _precise: boolean) => {
    if (word === 'block') return 0;
    const prefix = word.includes(':') ? word.slice(0, word.indexOf(':')) : word;
    if (ItemCouldMatchPrefixes.has(prefix) || word === 'item' || word === 'potion' || data.items.has(word)) {
      return 10;
    }
    if (data.blocks.has(word) || data.entities.has(word)) return 0;
    return 1;
  };

  const matchBlock = (word: string, _precise: boolean) => {
    if (word === 'item') return 0;
    if (
      word === 'material' ||
      word === 'block' ||
      word.startsWith('vanilla_tagged:') ||
      word.startsWith('material_flagged:') ||
      data.blocks.has(word)
    ) {
      return 10;
    }
    if (data.items.has(word) || data.entities.has(word)) return 0;
    return 1;
  };

  const matchMaterial = (word: string, precise: boolean) => {
    return Math.max(matchBlock(word, precise), matchItem(word, precise));
  };

  const matchInventory = (word: string, _precise: boolean) => {
    if (InventoryMatchers.has(word) || word.startsWith('inventory_flagged:')) {
      return 10;
    }
    if (data.blocks.has(word) || data.items.has(word) || data.entities.has(word)) return 0;
    return 1;
  };

  const matchArea = (word: string, _precise: boolean) => {
    if (
      word === 'area' ||
      word === 'cuboid' ||
      word === 'polygon' ||
      word === 'ellipsoid' ||
      word.startsWith('area_flagged:') ||
      word.startsWith('biome:')
    ) {
      return 10;
    }
    if (data.items.has(word) || data.blocks.has(word) || data.entities.has(word)) return 0;
    return 1;
  };

  const matchWorld = (_word: string, _precise: boolean) => 1;

  return {
    entity: matchEntity,
    projectile: matchEntity,
    hanging: matchEntity,
    vehicle: matchEntity,
    item: matchItem,
    inventory: matchInventory,
    block: matchBlock,
    material: matchMaterial,
    area: matchArea,
    world: matchWorld,
  };
}

interface EventSegment {
  optional: boolean;
  tokens: string[];
}

const parsedEventLineCache = new Map<string, EventSegment[]>();
let cachedEventValidators: Record<string, (word: string, precise: boolean) => number> | null = null;

function getEventValidators() {
  if (!cachedEventValidators) {
    cachedEventValidators = createValidators(loadExtraData());
  }
  return cachedEventValidators;
}

function parseEventLineSegments(lineLow: string): EventSegment[] {
  const cached = parsedEventLineCache.get(lineLow);
  if (cached) return cached;

  const segments: EventSegment[] = [];
  let i = 0;
  const n = lineLow.length;

  while (i < n) {
    while (i < n && lineLow[i] === ' ') i++;
    if (i >= n) break;

    if (lineLow[i] === '(') {
      let depth = 1;
      let j = i + 1;
      while (j < n && depth > 0) {
        if (lineLow[j] === '(') depth++;
        else if (lineLow[j] === ')') depth--;
        j++;
      }
      const inner = lineLow.slice(i + 1, j - (lineLow[j - 1] === ')' ? 1 : 0));
      const innerTokens = inner
        .replace(/[()]/g, '')
        .split(/\s+/)
        .filter(Boolean);
      if (innerTokens.length > 0) {
        segments.push({ optional: true, tokens: innerTokens });
      }
      i = j;
    } else {
      let j = i;
      while (j < n && lineLow[j] !== ' ' && lineLow[j] !== '(') j++;
      const tok = lineLow.slice(i, j).replace(/[()]/g, '');
      if (tok) {
        segments.push({ optional: false, tokens: [tok] });
      }
      i = j;
    }
  }

  parsedEventLineCache.set(lineLow, segments);
  return segments;
}

function scoreEventToken(
  token: string,
  qWord: string,
  validators: Record<string, (word: string, precise: boolean) => number>
): number {
  let cleanTok = token;
  let cleanQ = qWord;

  if (cleanTok.endsWith("'s")) {
    if (!cleanQ.endsWith("'s")) return 0;
    cleanTok = cleanTok.slice(0, -2);
    cleanQ = cleanQ.slice(0, -2);
  }

  if (cleanTok.startsWith('<') && cleanTok.endsWith('>')) {
    const inner = cleanTok.slice(1, -1);
    if (inner.startsWith("'") && inner.endsWith("'")) {
      const lit = inner.slice(1, -1);
      return lit === cleanQ ? 10 : 1;
    }
    const validator = validators[inner];
    if (validator) {
      return validator(cleanQ, false);
    }
    return 1;
  }

  if (cleanTok.includes('|')) {
    const opts = cleanTok.split('|');
    for (const opt of opts) {
      if (opt.replace(/[<>']/g, '') === cleanQ) return 10;
    }
    return 0;
  }

  return cleanTok === cleanQ ? 10 : 0;
}

/**
 * Matches a Denizen script event line (`on player breaks diamond_ore:` or `player enters area`)
 * against an event specification pattern (`player breaks (<material>)`, `<entity> enters|exits <area>`).
 * Returns 10 on strong typed match, 7 on generic placeholder match, or 0 if no match.
 */
export function matchEventPattern(eventLine: string, rawQuery: string): number {
  const cleaned = rawQuery
    .trim()
    .replace(/^(?:on|after)\s+/i, '')
    .replace(/:+$/, '')
    .trim()
    .toLowerCase();

  if (!cleaned) return 0;

  // Strip event switches containing `:` (e.g. `flagged:vip`, `in:spawn`)
  const qWords = cleaned.split(/\s+/).filter((w) => w.length > 0 && !w.includes(':'));
  if (qWords.length < 2) return 0;

  const segments = parseEventLineSegments(eventLine.toLowerCase().trim());
  if (segments.length === 0) return 0;

  const validators = getEventValidators();
  const memo = new Map<number, number>();

  const solve = (segIdx: number, tokIdx: number, qIdx: number): number => {
    if (segIdx === segments.length) {
      return qIdx === qWords.length ? 10 : 0;
    }
    const key = (segIdx << 16) | (tokIdx << 8) | qIdx;
    const prev = memo.get(key);
    if (prev !== undefined) return prev;

    const seg = segments[segIdx];
    let best = 0;

    if (seg.optional && tokIdx === 0) {
      best = solve(segIdx + 1, 0, qIdx);
    }

    if (tokIdx === seg.tokens.length) {
      const nextScore = solve(segIdx + 1, 0, qIdx);
      if (nextScore > best) best = nextScore;
    } else if (qIdx < qWords.length) {
      const tokScore = scoreEventToken(seg.tokens[tokIdx], qWords[qIdx], validators);
      if (tokScore > 0) {
        const rest = solve(segIdx, tokIdx + 1, qIdx + 1);
        if (rest > 0) {
          const combined = Math.min(tokScore, rest);
          if (combined > best) best = combined;
        }
      }
    }

    memo.set(key, best);
    return best;
  };

  const score = solve(0, 0, 0);
  if (score >= 10) return 10;
  if (score > 0) return 7;
  return 0;
}
