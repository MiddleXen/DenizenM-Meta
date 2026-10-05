import React from 'react';
import { DocSearchBar } from './DocSearchBar';
import { DocRestLoader } from './DocRestLoader';
import { Sparkles } from 'lucide-react';
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
  let mainText = '';
  let gradientText = '';
  if (title.endsWith('Object Types')) {
    mainText = title.slice(0, -'Object Types'.length).trim();
    gradientText = 'Object Types';
  } else if (title.endsWith('NPC Actions')) {
    mainText = title.slice(0, -'NPC Actions'.length).trim();
    gradientText = 'NPC Actions';
  } else {
    const words = title.split(' ');
    if (words.length > 1) {
      gradientText = words[words.length - 1];
      mainText = words.slice(0, -1).join(' ');
    } else {
      gradientText = title;
    }
  }

  return (
    <div className="w-full pb-16">
      <div className="center_helper relative z-30 px-3 sm:px-4 max-w-full">
        <div className="jumbotron animate-fade-in-up">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-[#00bc8c] border border-emerald-500/20 mb-3 shadow-xs">
            <Sparkles className="w-3 h-3" />
            <span>DenizenM Meta Explorer</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-2.5 text-slate-900 dark:text-white">
            {mainText && `${mainText} `}
            <span className="bg-gradient-to-r from-emerald-600 via-emerald-400 to-teal-400 dark:from-[#00bc8c] dark:via-[#00efb2] dark:to-teal-300 bg-clip-text text-transparent animate-shimmer">
              {gradientText}
            </span>
          </h2>
          <div className="text-sm sm:text-base leading-relaxed max-w-3xl mx-auto text-slate-600 dark:text-slate-300">
            {description}
          </div>
        </div>

        <div className="relative z-40 animate-fade-in-up stagger-1">
          <DocSearchBar
            basePath={basePath}
            placeholder={searchPlaceholder}
            initialValue={model.searchText}
          />
        </div>
        <div className="mt-3 mb-1.5 animate-fade-in stagger-2 relative z-10">
          {model.isAll ? (
            <h5 className="text-sm font-semibold text-slate-600 dark:text-slate-300 m-0">
              Showing all <span className="font-bold text-emerald-600 dark:text-[#00bc8c]">{model.max}</span> {itemPlural}...
            </h5>
          ) : model.searchText ? (
            <h5 className="text-sm font-semibold text-slate-600 dark:text-slate-300 m-0">
              Showing <span className="font-bold text-emerald-600 dark:text-[#00bc8c]">{model.currentlyShown}</span> search results for{' '}
              <code className="px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-white/10 text-emerald-600 dark:text-[#00bc8c] font-mono text-xs">{model.searchText}</code> out of {model.max} {itemPlural}...
            </h5>
          ) : (
            <h5 className="text-sm font-semibold text-slate-600 dark:text-slate-300 m-0">
              Showing <span className="font-bold text-emerald-600 dark:text-[#00bc8c]">{model.currentlyShown}</span> search results out of {model.max} {itemPlural}...
            </h5>
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
