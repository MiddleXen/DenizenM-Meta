import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { reloadMetaDocs } from '@/lib/meta-store';
import { revalidatePath } from 'next/cache';

function safeTokenCompare(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function extractToken(req: NextRequest): string | null {
  const queryToken = req.nextUrl.searchParams.get('token');
  if (queryToken) return queryToken;

  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  const headerToken = req.headers.get('x-webhook-token');
  if (headerToken) return headerToken.trim();

  return null;
}

export async function POST(req: NextRequest) {
  const expectedToken = process.env.RELOAD_WEBHOOK_TOKEN;
  if (!expectedToken) {
    return NextResponse.json(
      { success: false, error: 'Webhook reload token is not configured on the server.' },
      { status: 503 }
    );
  }

  const token = extractToken(req);
  if (!safeTokenCompare(token, expectedToken)) {
    return NextResponse.json({ success: false, error: 'Invalid token.' }, { status: 401 });
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
    const message = err instanceof Error ? err.message : 'Failed to reload meta documentation.';
    console.error('Webhook reload error:', err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
