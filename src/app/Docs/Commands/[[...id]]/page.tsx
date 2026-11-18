import { Metadata } from 'next';
import { buildDocPageMetadata, loadDocPage } from '@/lib/doc-pages';
import { fixID } from '@/lib/util';
import { DocPageLayout } from '@/components/DocPageLayout';

interface PageProps {
  params: Promise<{ id?: string[] }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id: idParts } = await params;
  const id = fixID(idParts ? idParts.join('/') : null);
  return buildDocPageMetadata('Commands', id, 'Commands');
}

export default async function CommandsPage({ params }: PageProps) {
  const { id: idParts } = await params;
  const id = fixID(idParts ? idParts.join('/') : null);
  const { model, restUrl } = await loadDocPage('Commands', id || null);

  return (
    <DocPageLayout
      title="DenizenM Commands"
      description={
        <>
          Commands are always written with a <code>-</code> before them, and are the core component of any script — the primary way to cause things to happen.{' '}
          Learn more in <a href="https://guide.denizenscript.com/" target="_blank" rel="noreferrer">The Beginner&apos;s Guide</a>.
        </>
      }
      searchPlaceholder="Search Commands..."
      itemPlural="commands"
      basePath="/Docs/Commands"
      model={model}
      restUrl={restUrl}
    />
  );
}
