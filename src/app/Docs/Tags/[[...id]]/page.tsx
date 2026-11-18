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
  return buildDocPageMetadata('Tags', id, 'Tags');
}

export default async function TagsPage({ params }: PageProps) {
  const { id: idParts } = await params;
  const id = fixID(idParts ? idParts.join('/') : null);
  const { model, restUrl } = await loadDocPage('Tags', id || null);

  return (
    <DocPageLayout
      title="DenizenM Tags"
      description={
        <>
          Tags are written <code>&lt;between these marks&gt;</code> and are critical to scripts as the primary way to read data and compute values.{' '}
          Learn more in <a href="https://guide.denizenscript.com/" target="_blank" rel="noreferrer">The Beginner&apos;s Guide</a>.
        </>
      }
      searchPlaceholder="Search Tags..."
      itemPlural="tags"
      basePath="/Docs/Tags"
      model={model}
      restUrl={restUrl}
    />
  );
}
