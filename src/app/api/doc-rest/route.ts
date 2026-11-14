import { NextRequest } from 'next/server';
import { promisify } from 'node:util';
import zlib from 'node:zlib';
import { getDocModel, isDocKind, SplitDocModel } from '@/lib/doc-pages';

export const dynamic = 'force-dynamic';

const brotli = promisify(zlib.brotliCompress);
const gzip = promisify(zlib.gzip);

type Encoding = 'br' | 'gzip';

/**
 * Compressed bodies are cached per model object; models are themselves cached (and dropped on meta
 * reload) in doc-pages, so this never outlives the HTML it was built from.
 * `next start` does not compress route-handler responses, and the Tags rest part is ~8 MB of raw HTML
 * (~0.2 MB with brotli), so compressing here is by far the biggest win for page load time.
 */
const compressedCache = new WeakMap<SplitDocModel, Partial<Record<Encoding, Promise<Buffer>>>>();

function compress(model: SplitDocModel, encoding: Encoding): Promise<Buffer> {
  let entry = compressedCache.get(model);
  if (!entry) compressedCache.set(model, (entry = {}));
  let result = entry[encoding];
  if (!result) {
    const input = Buffer.from(model.restHtml, 'utf8');
    result =
      encoding === 'br'
        ? brotli(input, {
            params: {
              [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
              [zlib.constants.BROTLI_PARAM_QUALITY]: 7,
              [zlib.constants.BROTLI_PARAM_SIZE_HINT]: input.length,
            },
          })
        : gzip(input, { level: 6 });
    result.catch(() => {
      if (entry) delete entry[encoding];
    });
    entry[encoding] = result;
  }
  return result;
}

function pickEncoding(acceptEncoding: string | null): Encoding | null {
  if (!acceptEncoding) return null;
  const accepted = acceptEncoding
    .toLowerCase()
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part && !/;\s*q=0(?:\.0*)?$/.test(part))
    .map((part) => part.split(';')[0].trim());
  if (accepted.includes('br')) return 'br';
  if (accepted.includes('gzip') || accepted.includes('*')) return 'gzip';
  return null;
}

export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get('kind');
  const id = req.nextUrl.searchParams.get('id') || null;
  if (!isDocKind(kind)) {
    return new Response('Unknown kind', { status: 400 });
  }
  const model = await getDocModel(kind, id);
  const headers: Record<string, string> = {
    'Content-Type': 'text/html; charset=utf-8',
    // URL contains the meta version (`v`) and format (`f`), so it is safe to cache aggressively in the browser.
    'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    Vary: 'Accept-Encoding',
  };

  const encoding = model.restHtml.length > 1024 ? pickEncoding(req.headers.get('accept-encoding')) : null;
  if (encoding) {
    try {
      const body = await compress(model, encoding);
      headers['Content-Encoding'] = encoding;
      headers['Content-Length'] = String(body.length);
      return new Response(new Uint8Array(body), { headers });
    } catch (e) {
      console.error('doc-rest compression failed, sending uncompressed:', e);
    }
  }

  return new Response(model.restHtml, { headers });
}
