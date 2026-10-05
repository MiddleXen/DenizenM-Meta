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
  const title = (id ? `Search '${id}' | ` : '') + 'NPC Actions | DenizenM Meta Documentation';
  const desc = id ? `NPC Action search for '${id}'` : 'NPC Action List';
  return {
    title,
    description: desc,
  };
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
          <br />
          NPC Actions go in &apos;assignment&apos; scripts, and work like &apos;events&apos; but linked to the assigned NPC.
          <br />
          Learn about how NPC Actions work in{' '}
          <a href="https://guide.denizenscript.com/">The Beginner&apos;s Guide</a>.
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
