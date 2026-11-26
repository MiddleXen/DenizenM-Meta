import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { reloadMetaDocs } from '@/lib/meta-store';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

/**
 * POST /webhook/reload - refresh the meta documentation.
 *
 * Auth (secret = RELOAD_WEBHOOK_TOKEN): `Authorization: Bearer <secret>`, `X-Webhook-Token: <secret>`,
 * or a GitHub webhook signed with that secret (`X-Hub-Signature-256`). Tokens in the URL are not accepted,
 * because URLs end up in access logs.
 *
 * On Vercel an in-memory reload would only refresh the one serverless instance that got the request (and the
 * filesystem is read-only), so there the webhook triggers a full redeploy via VERCEL_DEPLOY_HOOK instead.
 * Self-hosted (`npm start`), it reloads the meta in place.
 */

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

function isAuthorized(req: NextRequest, rawBody: string, secret: string): boolean {
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    if (safeEqual(authHeader.slice(7).trim(), secret)) return true;
  }
  const headerToken = req.headers.get('x-webhook-token');
  if (headerToken && safeEqual(headerToken.trim(), secret)) return true;

  const signature = req.headers.get('x-hub-signature-256');
  if (signature) {
    const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
    if (safeEqual(signature.trim(), expected)) return true;
  }
  return false;
}

const isVercel = () => Boolean(process.env.VERCEL);

export async function POST(req: NextRequest) {
  const secret = process.env.RELOAD_WEBHOOK_TOKEN;
  if (!secret) {
    return NextResponse.json(
      { success: false, error: 'Webhook reload token is not configured on the server.' },
      { status: 503 }
    );
  }

  const rawBody = await req.text().catch(() => '');
  if (!isAuthorized(req, rawBody, secret)) {
    return NextResponse.json({ success: false, error: 'Invalid token.' }, { status: 401 });
  }

  if (req.headers.get('x-github-event') === 'ping') {
    return NextResponse.json({ success: true, message: 'pong' });
  }

  if (isVercel()) {
    const hook = process.env.VERCEL_DEPLOY_HOOK;
    if (!hook) {
      return NextResponse.json(
        {
          success: false,
          error: 'On Vercel this webhook redeploys the site, but VERCEL_DEPLOY_HOOK is not set in the project environment.',
        },
        { status: 501 }
      );
    }
    try {
      const res = await fetch(hook, { method: 'POST', cache: 'no-store' });
      if (!res.ok) throw new Error(`Deploy hook answered ${res.status}`);
      return NextResponse.json({
        success: true,
        mode: 'redeploy',
        message: 'Redeploy triggered; the new meta goes live when the build finishes (usually 1-3 minutes).',
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      console.error('Webhook redeploy error:', err);
      return NextResponse.json({ success: false, error: 'Failed to trigger the Vercel deploy hook.' }, { status: 502 });
    }
  }

  try {
    const updatedDocs = await reloadMetaDocs();

    try {
      revalidatePath('/', 'layout');
    } catch {
      // Normal in standalone / dev contexts
    }

    return NextResponse.json({
      success: true,
      mode: 'reload',
      message: 'Denizen meta documentation reloaded and revalidated successfully.',
      timestamp: new Date().toISOString(),
      totalEntries: updatedDocs.allObjects.length,
      counts: {
        commands: Object.keys(updatedDocs.commands).length,
        tags: Object.keys(updatedDocs.tags).length,
        events: Object.keys(updatedDocs.events).length,
        mechanisms: Object.keys(updatedDocs.mechanisms).length,
        objectTypes: Object.keys(updatedDocs.objectTypes).length,
        languages: Object.keys(updatedDocs.languages).length,
        actions: Object.keys(updatedDocs.actions).length,
      },
    });
  } catch (err: unknown) {
    console.error('Webhook reload error:', err);
    return NextResponse.json({ success: false, error: 'Failed to reload meta documentation.' }, { status: 500 });
  }
}

export function GET() {
  return NextResponse.json(
    { success: false, error: 'Use POST. The token goes in the Authorization or X-Webhook-Token header.' },
    { status: 405, headers: { Allow: 'POST' } }
  );
}
