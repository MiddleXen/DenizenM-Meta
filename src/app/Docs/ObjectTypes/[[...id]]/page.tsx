import { Metadata } from 'next';
import { loadDocPage } from '@/lib/doc-pages';
import { fixID } from '@/lib/util';
import { DocPageLayout } from '@/components/DocPageLayout';

interface PageProps {
  params: Promise<{ id?: string[] }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id: idParts } = await params;
  const id = fixID(idParts ? idParts.join('/') : null);
  const title = (id ? `Search '${id}' | ` : '') + 'Object Types | DenizenM Meta Documentation';
  const desc = id ? `Object type search for '${id}'` : 'Object Type List';
  return {
    title,
    description: desc,
  };
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
          <br />
          Object Types are the fundamental types of data passed around in a DenizenM script, often seen as the return type of a tag.
          <br />
          Learn about how objects work in{' '}
          <a href="https://guide.denizenscript.com/">The Beginner&apos;s Guide</a>.
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
