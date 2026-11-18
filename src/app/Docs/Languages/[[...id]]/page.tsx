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
  return buildDocPageMetadata('Languages', id, 'Language Explanations');
}

export default async function LanguagesPage({ params }: PageProps) {
  const { id: idParts } = await params;
  const id = fixID(idParts ? idParts.join('/') : null);
  const { model, restUrl } = await loadDocPage('Languages', id || null);

  return (
    <DocPageLayout
      title="DenizenM Languages"
      description={
        <>
          Language Explanations cover core systems, syntax rules, and architecture of DenizenM in technical detail beyond{' '}
          <a href="https://guide.denizenscript.com/" target="_blank" rel="noreferrer">The Beginner&apos;s Guide</a>.
        </>
      }
      searchPlaceholder="Search Language Explanations..."
      itemPlural="language explanations"
      basePath="/Docs/Languages"
      model={model}
      restUrl={restUrl}
    />
  );
}
