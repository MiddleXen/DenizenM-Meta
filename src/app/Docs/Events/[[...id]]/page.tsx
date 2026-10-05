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
  const title = (id ? `Search '${id}' | ` : '') + 'Events | DenizenM Meta Documentation';
  const desc = id ? `Event search for '${id}'` : 'Event List';
  return {
    title,
    description: desc,
  };
}

export default async function EventsPage({ params }: PageProps) {
  const { id: idParts } = await params;
  const id = fixID(idParts ? idParts.join('/') : null);
  const { model, restUrl } = await loadDocPage('Events', id || null);

  return (
    <DocPageLayout
      title="DenizenM Events"
      description={
        <>
          <br />
          Events are a way to listen to things that happened on your server and respond to them through a script. These usually pair with &apos;world&apos; script containers.
          <br />
          Learn about how events work in{' '}
          <a href="https://guide.denizenscript.com/">The Beginner&apos;s Guide</a>.
        </>
      }
      searchPlaceholder="Search Events..."
      itemPlural="events"
      basePath="/Docs/Events"
      model={model}
      restUrl={restUrl}
    />
  );
}
