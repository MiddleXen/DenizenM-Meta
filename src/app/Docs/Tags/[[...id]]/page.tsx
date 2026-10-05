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
  const title = (id ? `Search '${id}' | ` : '') + 'Tags | DenizenM Meta Documentation';
  const desc = id ? `Tag search for '${id}'` : 'Tag List';
  return {
    title,
    description: desc,
  };
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
          <br />
          Tags are always written with a &lt;between these marks&gt;, and are critical to scripts,
          <br />
          as the primary way to read data.
          <br />
          Learn about how tags work in{' '}
          <a href="https://guide.denizenscript.com/">The Beginner&apos;s Guide</a>.
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
