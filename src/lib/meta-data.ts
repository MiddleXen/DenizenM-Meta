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

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
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

export function suggestExampleFor(type: string, data: ExtraDataSets): string {
  if (type.startsWith("'") && type.endsWith("'")) {
    return type.slice(1, -1);
  }
  if (Math.random() > 0.7) {
    return type;
  }
  switch (type.toLowerCase()) {
    case 'entity':
      return Math.random() > 0.5 ? randomPick(Array.from(SpecialEntityMatchables)) : randomPick(data.entityArray);
    case 'projectile':
      return randomPick(['projectile', 'arrow', 'snowball']);
    case 'vehicle':
      return randomPick(['vehicle', 'minecart', 'horse']);
    case 'item':
      return randomPick(data.itemArray);
    case 'block':
      return randomPick(data.blockArray);
    case 'material':
      return Math.random() > 0.5 ? randomPick(data.blockArray) : randomPick(data.itemArray);
    case 'area':
      return randomPick(['area', 'cuboid', 'polygon']);
    case 'inventory':
      return randomPick(Array.from(InventoryMatchers));
    case 'world':
      return randomPick(['world', 'world_nether', 'world_the_end', 'space', 'survivalland']);
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
