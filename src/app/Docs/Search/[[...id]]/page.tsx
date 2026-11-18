import { Metadata } from 'next';
import { buildDocPageMetadata, loadDocPage } from '@/lib/doc-pages';
import { fixID } from '@/lib/util';
import { DocPageLayout } from '@/components/DocPageLayout';

interface PageProps {
  params: Promise<{ id?: string[] }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id: idParts } = await params;
  const id = fixID(idParts ? idParts.join('/') : null) || '';
  return buildDocPageMetadata('Search', id || null, 'Global Search');
}

export default async function SearchPage({ params }: PageProps) {
  const { id: idParts } = await params;
  const id = fixID(idParts ? idParts.join('/') : null) || '';
  const { model, restUrl } = await loadDocPage('Search', id || null);

  return (
    <DocPageLayout
      title="Global Meta Documentation Search"
      description={
        <>
          Search across all {model.max.toLocaleString()} commands, tags, events, mechanisms, actions, languages, and object types.
        </>
      }
      searchPlaceholder="Search all meta documentation..."
      itemPlural="meta-documentation entries"
      basePath="/Docs/Search"
      model={model}
      restUrl={restUrl}
    />
  );
}
