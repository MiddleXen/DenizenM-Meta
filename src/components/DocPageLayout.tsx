import React from 'react';
import { DocSearchBar } from './DocSearchBar';
import { DocRestLoader } from './DocRestLoader';
import { DocFilterBar } from './DocFilterBar';
import type { SplitDocModel } from '@/lib/doc-pages';

interface DocPageLayoutProps {
  title: string;
  description: React.ReactNode;
  searchPlaceholder: string;
  itemPlural: string;
  basePath: string;
  model: SplitDocModel;
  restUrl: string | null;
}

export function DocPageLayout({
  title,
  description,
  searchPlaceholder,
  itemPlural,
  basePath,
  model,
  restUrl,
}: DocPageLayoutProps) {
  const containerId = 'doc-entries-root';

  return (
    <div className="w-full pb-16">
      <div className="center_helper relative z-30 px-3 sm:px-4 max-w-full">
        <div className="jumbotron">
          <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-[-0.035em] mb-3 text-[var(--text-page)]">
            {title}
          </h1>
          <div className="text-sm sm:text-base leading-relaxed max-w-2xl mx-auto text-[var(--text-muted)]">
            {description}
          </div>
        </div>

        <div className="relative z-40 max-w-xl mx-auto">
          <DocSearchBar
            basePath={basePath}
            placeholder={searchPlaceholder}
            initialValue={model.searchText}
          />
        </div>

        <DocFilterBar
          containerId={containerId}
          basePath={basePath}
          itemPlural={itemPlural}
          isAll={model.isAll}
          currentlyShown={model.currentlyShown}
          max={model.max}
          searchText={model.searchText}
          categories={model.categories}
          asyncCounts={model.asyncCounts}
          pluginOptions={model.pluginOptions}
        />
      </div>

      <div id={containerId} className="w-full max-w-[1550px] mx-auto px-2 sm:px-4 relative z-0">
        <div className="doc-head" dangerouslySetInnerHTML={{ __html: model.headHtml }} />
        {restUrl && (
          <DocRestLoader
            key={restUrl}
            url={restUrl}
            containerId={containerId}
            estimateFeatures={model.restEstFeatures}
            estimateExtraPx={model.restEstExtraPx}
          />
        )}
      </div>
    </div>
  );
}
