import { NextRequest, NextResponse } from 'next/server';
import { reloadMetaDocs } from '@/lib/meta-store';
import { revalidatePath } from 'next/cache';

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const expectedToken = process.env.RELOAD_WEBHOOK_TOKEN;

  if (expectedToken && token !== expectedToken) {
    return new NextResponse('Invalid token.', { status: 401 });
  }

  try {
    console.log('Webhook /Webhook/Reload triggered. Re-downloading and parsing meta documentation...');
    const updatedDocs = await reloadMetaDocs();

    try {
      revalidatePath('/', 'layout');
    } catch (revalErr) {
      console.warn('Revalidate warning (normal in dev):', revalErr);
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
  } catch (err: any) {
    console.error('Webhook reload error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Failed to reload meta documentation.',
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
