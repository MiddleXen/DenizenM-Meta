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
  return buildDocPageMetadata('Mechanisms', id, 'Mechanisms');
}

export default async function MechanismsPage({ params }: PageProps) {
  const { id: idParts } = await params;
  const id = fixID(idParts ? idParts.join('/') : null);
  const { model, restUrl } = await loadDocPage('Mechanisms', id || null);

  return (
    <DocPageLayout
      title="DenizenM Mechanisms"
      description={
        <>
          Mechanisms are used in object properties, the <code>adjust</code> command, and similar places to modify the state of an object.{' '}
          Learn more in <a href="https://guide.denizenscript.com/" target="_blank" rel="noreferrer">The Beginner&apos;s Guide</a>.
        </>
      }
      searchPlaceholder="Search Mechanisms..."
      itemPlural="mechanisms"
      basePath="/Docs/Mechanisms"
      model={model}
      restUrl={restUrl}
    />
  );
}
