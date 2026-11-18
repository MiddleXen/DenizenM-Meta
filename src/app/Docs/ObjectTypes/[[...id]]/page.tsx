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
  return buildDocPageMetadata('ObjectTypes', id, 'Object Types');
}

export default async function ObjectTypesPage({ params }: PageProps) {
  const { id: idParts } = await params;
  const id = fixID(idParts ? idParts.join('/') : null);
  const { model, restUrl } = await loadDocPage('ObjectTypes', id || null);

  return (
    <DocPageLayout
      title="DenizenM Object Types"
      description={
        <>
          Object Types are the fundamental data structures passed around in DenizenM scripts, often seen as the return type of a tag.{' '}
          Learn more in <a href="https://guide.denizenscript.com/" target="_blank" rel="noreferrer">The Beginner&apos;s Guide</a>.
        </>
      }
      searchPlaceholder="Search Object Types..."
      itemPlural="object types"
      basePath="/Docs/ObjectTypes"
      model={model}
      restUrl={restUrl}
    />
  );
}
