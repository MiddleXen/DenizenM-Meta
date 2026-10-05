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
  const title = (id ? `Search '${id}' | ` : '') + 'Mechanisms | DenizenM Meta Documentation';
  const desc = id ? `Mechanism search for '${id}'` : 'Mechanism List';
  return {
    title,
    description: desc,
  };
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
          <br />
          Mechanisms are found in object properties, the &apos;adjust&apos; command, and similar. These are used to change the state of an object.
          <br />
          Learn about how mechanisms work in{' '}
          <a href="https://guide.denizenscript.com/">The Beginner&apos;s Guide</a>.
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
