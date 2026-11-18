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
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-3 text-slate-900 dark:text-white">
            {title}
          </h1>
          <div className="text-sm sm:text-base leading-relaxed max-w-2xl mx-auto text-slate-600 dark:text-slate-400">
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
        {restUrl && <DocRestLoader key={restUrl} url={restUrl} containerId={containerId} />}
      </div>
    </div>
  );
}
