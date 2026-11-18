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
  return buildDocPageMetadata('Actions', id, 'NPC Actions');
}

export default async function ActionsPage({ params }: PageProps) {
  const { id: idParts } = await params;
  const id = fixID(idParts ? idParts.join('/') : null);
  const { model, restUrl } = await loadDocPage('Actions', id || null);

  return (
    <DocPageLayout
      title="DenizenM NPC Actions"
      description={
        <>
          NPC Actions go in <code>assignment</code> scripts and work like events linked directly to the assigned Citizens NPC.{' '}
          Learn more in <a href="https://guide.denizenscript.com/" target="_blank" rel="noreferrer">The Beginner&apos;s Guide</a>.
        </>
      }
      searchPlaceholder="Search Actions..."
      itemPlural="NPC Actions"
      basePath="/Docs/Actions"
      model={model}
      restUrl={restUrl}
    />
  );
}
