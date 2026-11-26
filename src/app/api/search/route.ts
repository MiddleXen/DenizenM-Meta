import { NextRequest, NextResponse } from 'next/server';
import { getAsyncTokens, getMetaDocs, getPluginBucket, searchAllObjects, SEARCH_QUALITY_NAMES } from '@/lib/meta-store';
import { cleanPlainSummary } from '@/lib/doc-pages';
import { hrefForSuggestion, type SuggestionType } from '@/lib/suggestions';
import type {
  AnyMetaObject,
  MetaCommandObject,
  MetaEventObject,
  MetaLanguageObject,
  MetaMechanismObject,
  MetaObjectTypeObject,
  MetaTagObject,
  MetaActionObject,
} from '@/lib/types';

/**
 * Public JSON search API: GET /api/search?q=<query>[&type=command,tag,...][&limit=25]
 * Same ranking as the site's global search. CORS-enabled and CDN-cached, for Discord bots, editor plugins and such.
 */

const TYPE_ALIASES: Record<string, SuggestionType> = {
  command: 'Command',
  commands: 'Command',
  tag: 'Tag',
  tags: 'Tag',
  event: 'Event',
  events: 'Event',
  mechanism: 'Mechanism',
  mechanisms: 'Mechanism',
  mech: 'Mechanism',
  action: 'Action',
  actions: 'Action',
  language: 'Language',
  languages: 'Language',
  objecttype: 'ObjectType',
  objecttypes: 'ObjectType',
  'object-type': 'ObjectType',
  type: 'ObjectType',
};

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const MAX_QUERY_LENGTH = 200;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function usage(origin: string, error?: string) {
  return {
    ...(error ? { error } : {}),
    usage: `${origin}/api/search?q=<query>[&type=command,tag,event,mechanism,action,language,objecttype][&limit=1-${MAX_LIMIT}]`,
    examples: [
      `${origin}/api/search?q=narrate`,
      `${origin}/api/search?q=player.location&type=tag&limit=5`,
      `${origin}/api/search?q=on player breaks block&type=event`,
    ],
  };
}

function describe(obj: AnyMetaObject, origin: string, quality: number) {
  const href = hrefForSuggestion(obj.type as SuggestionType, obj.cleanName);
  const base: Record<string, unknown> = {
    type: obj.type,
    name: obj.name,
    url: origin + href,
    match: SEARCH_QUALITY_NAMES[quality] || 'Matched',
    quality,
    plugin: getPluginBucket(obj.plugin).label,
    group: obj.group || undefined,
    asyncSafety: getAsyncTokens(obj)?.split(' ') ?? null,
    deprecated: obj.deprecated || undefined,
    source: obj.sourceFile || undefined,
  };
  switch (obj.type) {
    case 'Command': {
      const c = obj as MetaCommandObject;
      return { ...base, syntax: c.syntax, description: cleanPlainSummary(c.short || c.description) };
    }
    case 'Tag': {
      const t = obj as MetaTagObject;
      return { ...base, returns: t.returns || undefined, mechanism: t.mechanism || undefined, description: cleanPlainSummary(t.description) };
    }
    case 'Event': {
      const e = obj as MetaEventObject;
      return { ...base, events: e.events, cancellable: e.cancellable, description: cleanPlainSummary(e.triggers) };
    }
    case 'Mechanism': {
      const m = obj as MetaMechanismObject;
      return { ...base, object: m.mechObject, input: m.input || undefined, description: cleanPlainSummary(m.description) };
    }
    case 'Action': {
      const a = obj as MetaActionObject;
      return { ...base, actions: a.actions, description: cleanPlainSummary(a.triggers) };
    }
    case 'Language':
      return { ...base, description: cleanPlainSummary((obj as MetaLanguageObject).description) };
    case 'ObjectType': {
      const o = obj as MetaObjectTypeObject;
      return { ...base, prefix: o.prefix || undefined, description: cleanPlainSummary(o.description) };
    }
    default:
      return base;
  }
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const params = req.nextUrl.searchParams;
  const q = (params.get('q') || '').trim();

  if (!q) {
    return NextResponse.json(usage(origin, 'Missing ?q= parameter.'), { status: 400, headers: CORS_HEADERS });
  }
  if (q.length > MAX_QUERY_LENGTH) {
    return NextResponse.json(usage(origin, `Query too long (max ${MAX_QUERY_LENGTH} characters).`), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  let types: Set<SuggestionType> | null = null;
  const typeParam = params.get('type');
  if (typeParam) {
    types = new Set();
    for (const raw of typeParam.split(',')) {
      const t = TYPE_ALIASES[raw.trim().toLowerCase()];
      if (!t) {
        return NextResponse.json(usage(origin, `Unknown type '${raw.trim()}'.`), { status: 400, headers: CORS_HEADERS });
      }
      types.add(t);
    }
  }

  const limitRaw = Number(params.get('limit') || DEFAULT_LIMIT);
  const limit = Number.isFinite(limitRaw) ? Math.min(MAX_LIMIT, Math.max(1, Math.floor(limitRaw))) : DEFAULT_LIMIT;

  const docs = await getMetaDocs();
  let matches = searchAllObjects(docs.allObjects, q);
  if (types) matches = matches.filter((m) => types!.has(m.obj.type as SuggestionType));

  return NextResponse.json(
    {
      query: q,
      total: matches.length,
      limit,
      metaVersion: docs.lastReload,
      results: matches.slice(0, limit).map((m) => describe(m.obj, origin, m.quality)),
    },
    {
      headers: {
        ...CORS_HEADERS,
        // Results only change with the meta, which comes with a redeploy (new CDN cache).
        'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
      },
    }
  );
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
