import React from 'react';
import { DocSearchBar } from './DocSearchBar';
import { DocRestLoader } from './DocRestLoader';
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

        <div className="mt-3.5 mb-2 relative z-10 flex items-center justify-center">
          {model.isAll ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 shadow-2xs leading-none">
              <span>Showing all</span>
              <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{model.max}</strong>
              <span>{itemPlural}</span>
            </span>
          ) : model.searchText ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 shadow-2xs leading-none">
              <span>Showing</span>
              <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{model.currentlyShown}</strong>
              <span>results for</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-emerald-600 dark:text-emerald-400 font-mono text-[11px] leading-tight">
                {model.searchText}
              </span>
              <span>out of {model.max} {itemPlural}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 shadow-2xs leading-none">
              <span>Showing</span>
              <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{model.currentlyShown}</strong>
              <span>results out of {model.max} {itemPlural}</span>
            </span>
          )}
        </div>
      </div>

      <div className="w-full max-w-[1550px] mx-auto px-2 sm:px-4 relative z-0">
        <div dangerouslySetInnerHTML={{ __html: model.headHtml }} />
        {restUrl && <DocRestLoader key={restUrl} url={restUrl} />}
      </div>
    </div>
  );
}
