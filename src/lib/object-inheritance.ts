import { cleanTag } from './util';

/**
 * Semantic supertype map derived from DenizenM ObjectType hierarchy (`base` + `implements`).
 * Enables searching `player.flag`, `player.location`, `npc.health`, `cuboid.bounding_box`, etc.
 */
const SUPERTYPE_MAP: Record<string, readonly string[]> = {
  playertag: ['entitytag', 'flaggableobject', 'propertyholderobject', 'objecttag'],
  npctag: ['entitytag', 'flaggableobject', 'propertyholderobject', 'objecttag'],
  entitytag: ['flaggableobject', 'propertyholderobject', 'objecttag'],
  cuboidtag: ['areaobject', 'flaggableobject', 'objecttag'],
  ellipsoidtag: ['areaobject', 'flaggableobject', 'objecttag'],
  polygontag: ['areaobject', 'flaggableobject', 'objecttag'],
  locationtag: ['vectorobject', 'flaggableobject', 'objecttag'],
  itemtag: ['flaggableobject', 'propertyholderobject', 'objecttag'],
  inventorytag: ['flaggableobject', 'propertyholderobject', 'objecttag'],
  materialtag: ['flaggableobject', 'propertyholderobject', 'objecttag'],
  tradetag: ['propertyholderobject', 'objecttag'],
  worldtag: ['flaggableobject', 'objecttag'],
  chunktag: ['flaggableobject', 'objecttag'],
  biometag: ['flaggableobject', 'objecttag'],
  enchantmenttag: ['flaggableobject', 'objecttag'],
  plugintag: ['flaggableobject', 'objecttag'],
  queuetag: ['flaggableobject', 'objecttag'],
  scripttag: ['flaggableobject', 'objecttag'],
  timetag: ['flaggableobject', 'objecttag'],
  discordbottag: ['flaggableobject', 'objecttag'],
  discordchanneltag: ['flaggableobject', 'objecttag'],
  discordcommandtag: ['flaggableobject', 'objecttag'],
  discordgrouptag: ['flaggableobject', 'objecttag'],
  discordinteractiontag: ['flaggableobject', 'objecttag'],
  discordmessagetag: ['flaggableobject', 'objecttag'],
  discordreactiontag: ['flaggableobject', 'objecttag'],
  discordroletag: ['flaggableobject', 'objecttag'],
  discordusertag: ['flaggableobject', 'objecttag'],
  griefpreventionclaimtag: ['flaggableobject', 'objecttag'],
  nationtag: ['flaggableobject', 'objecttag'],
  towntag: ['flaggableobject', 'objecttag'],
  elementtag: ['objecttag'],
};

const KNOWN_TYPES = new Set<string>([
  ...Object.keys(SUPERTYPE_MAP),
  'flaggableobject',
  'areaobject',
  'vectorobject',
  'propertyholderobject',
  'objecttag',
  'binarytag',
  'colortag',
  'customobjecttag',
  'durationtag',
  'imagetag',
  'javareflectedobjecttag',
  'listtag',
  'maptag',
  'quaterniontag',
  'secrettag',
  'server',
  'system',
  'bungee',
]);

export interface NormalizedScriptQuery {
  cleaned: string;
  strippedCmd: string;
  strippedEvent: string;
  tagCleaned: string;
  hasTagSyntax: boolean;
  hasEventSyntax: boolean;
  hasCmdSyntax: boolean;
}

/**
 * Normalizes real Denizen script snippets pasted into search:
 * - `- narrate "hello"` -> strippedCmd: `narrate`
 * - `on player joins:` / `after player breaks stone:` -> strippedEvent: `player joins`
 * - `<player.flag[coins]>` -> tagCleaned: `player.flag`
 */
export function normalizeScriptQuery(raw: string): NormalizedScriptQuery {
  const trimmed = raw.trim();
  const cleaned = trimmed.toLowerCase();
  const hasCmdSyntax = trimmed.startsWith('-');
  const noDash = hasCmdSyntax ? trimmed.replace(/^-\s*/, '').trim() : trimmed;
  const cmdFirstWord = noDash.split(/\s+/)[0] || '';
  const strippedCmd = (hasCmdSyntax ? cmdFirstWord : noDash).toLowerCase();

  const hasEventSyntax = /^(?:on|after)\s+/i.test(trimmed) || trimmed.endsWith(':');
  const strippedEvent = trimmed
    .replace(/^(?:on|after)\s+/i, '')
    .replace(/:+$/, '')
    .trim()
    .toLowerCase();

  const hasTagSyntax = trimmed.includes('<') || trimmed.includes('>') || trimmed.includes('[');
  const tagCleaned = cleanTag(trimmed).trim().toLowerCase();

  return {
    cleaned,
    strippedCmd,
    strippedEvent,
    tagCleaned,
    hasTagSyntax,
    hasEventSyntax,
    hasCmdSyntax,
  };
}

/**
 * Given a dot-separated tag/mechanism query (e.g. `player.flag`, `playertag.location`, `npc.health`),
 * returns inherited supertype candidate queries (`['entitytag.flag', 'flaggableobject.flag', ...]`).
 */
export function expandInheritedQueries(dotQuery: string): string[] {
  const q = cleanTag(dotQuery).trim().toLowerCase();
  const dotIdx = q.indexOf('.');
  if (dotIdx <= 0 || dotIdx >= q.length - 1) return [];

  const prefix = q.slice(0, dotIdx);
  const rest = q.slice(dotIdx + 1);
  if (!rest) return [];

  let typeKey = prefix;
  if (!KNOWN_TYPES.has(typeKey) && !typeKey.endsWith('tag') && !typeKey.endsWith('object')) {
    typeKey = prefix + 'tag';
  }

  const supers = SUPERTYPE_MAP[typeKey];
  if (supers && supers.length > 0) {
    return supers.map((s) => `${s}.${rest}`);
  }

  if (typeKey.endsWith('tag') && KNOWN_TYPES.has(typeKey)) {
    return [`objecttag.${rest}`];
  }

  return [];
}
