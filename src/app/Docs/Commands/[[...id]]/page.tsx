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
  const title = (id ? `Search '${id}' | ` : '') + 'Commands | DenizenM Meta Documentation';
  const desc = id ? `Command search for '${id}'` : 'Command List';
  return {
    title,
    description: desc,
  };
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
          <br />
          Commands are always written with a &apos;-&apos; before them, and are the core component of any script, the primary way to cause things to happen.
          <br />
          Learn about how commands work in{' '}
          <a href="https://guide.denizenscript.com/">The Beginner&apos;s Guide</a>.
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
