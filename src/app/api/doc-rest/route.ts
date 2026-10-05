import { NextRequest } from 'next/server';
import { getDocModel, isDocKind } from '@/lib/doc-pages';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get('kind');
  const id = req.nextUrl.searchParams.get('id') || null;
  if (!isDocKind(kind)) {
    return new Response('Unknown kind', { status: 400 });
  }
  const model = await getDocModel(kind, id);
  return new Response(model.restHtml, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // URL contains the meta version (`v`), so it is safe to cache aggressively in the browser.
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
