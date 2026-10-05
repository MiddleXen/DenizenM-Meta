import { Metadata } from 'next';
import Link from 'next/link';
import { getMetaDocs } from '@/lib/meta-store';
import { ArrowRight, Sparkles } from 'lucide-react';
import { HomeSearch } from '@/components/HomeSearch';
import {
  CommandIllustration,
  TagIllustration,
  ObjectTypeIllustration,
  MechanismIllustration,
  EventIllustration,
  LanguageIllustration,
  ActionIllustration,
  GuideIllustration,
  DiscordIllustration,
} from '@/components/IllustratedIcons';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Home | DenizenM Meta Documentation',
  description: 'Fast, complete meta-documentation reference for Denizen commands, tags, events, mechanisms, and object types.',
};

export default async function HomePage() {
  const docs = await getMetaDocs();

  const categories = [
    {
      href: '/Docs/Commands',
      name: 'Commands',
      count: Object.keys(docs.commands).length,
      illustration: CommandIllustration,
      description: 'The core actions of scripts. Prefixed with a dash (-) to execute gameplay logic and actions.',
    },
    {
      href: '/Docs/Tags',
      name: 'Tags',
      count: Object.keys(docs.tags).length,
      illustration: TagIllustration,
      description: 'Dynamic expressions wrapped in < > to fetch data, compute math, and inspect game objects.',
    },
    {
      href: '/Docs/ObjectTypes',
      name: 'Object Types',
      count: Object.keys(docs.objectTypes).length,
      illustration: ObjectTypeIllustration,
      description: 'The core data types in Denizen including PlayerTag, LocationTag, ItemTag, and EntityTag.',
    },
    {
      href: '/Docs/Mechanisms',
      name: 'Mechanisms',
      count: Object.keys(docs.mechanisms).length,
      illustration: MechanismIllustration,
      description: 'Setters and modifiers used with adjust or inventory mechanisms to modify game objects.',
    },
    {
      href: '/Docs/Events',
      name: 'Events',
      count: Object.keys(docs.events).length,
      illustration: EventIllustration,
      description: 'Triggers that execute script containers when events occur in the world or engine.',
    },
    {
      href: '/Docs/Languages',
      name: 'Languages',
      count: Object.keys(docs.languages).length,
      illustration: LanguageIllustration,
      description: 'Language containers, script file formatting specifications, and meta definitions.',
    },
    {
      href: '/Docs/Actions',
      name: 'NPC Actions',
      count: Object.keys(docs.actions).length,
      illustration: ActionIllustration,
      description: 'Context triggers for Citizens NPCs when clicked, damaged, or navigating.',
    },
  ];

  const totalCount = docs.allObjects.length;

  return (
    <div className="w-full relative">
      {/* Hero Section */}
      <section className="relative z-50 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-12 text-center animate-fade-in-up">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-[#00bc8c] border border-emerald-500/20 mb-5 shadow-xs">
          <Sparkles className="w-3.5 h-3.5" />
          <span>DenizenM Meta Reference</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          DenizenM{' '}
          <span className="bg-gradient-to-r from-emerald-600 via-emerald-400 to-teal-400 dark:from-[#00bc8c] dark:via-[#00efb2] dark:to-teal-300 bg-clip-text text-transparent animate-shimmer">
            Documentation
          </span>
        </h1>

        <p className="mt-4 text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
          Documentation reference covering over{' '}
          <span className="font-bold text-emerald-600 dark:text-[#00bc8c]">{totalCount.toLocaleString()}</span> commands,
          tags, events, mechanisms, object types, and addon meta.
        </p>

        {/* Hero Interactive Search Bar */}
        <div className="mt-8 max-w-2xl mx-auto relative z-50">
          <HomeSearch />
        </div>
      </section>

      {/* Categories Grid */}
      <section className="relative z-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 pb-3 border-b border-slate-200 dark:border-white/10">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Meta Categories
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Browse through standard DenizenM components and addon definitions
            </p>
          </div>
          <div className="self-start sm:self-auto">
            <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10">
              {categories.length} sections &bull; {totalCount.toLocaleString()} entries
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {categories.map((cat, index) => {
            const Illustration = cat.illustration;
            const staggerClass = `stagger-${(index % 8) + 1}`;
            return (
              <Link
                key={cat.href}
                href={cat.href}
                className={`group relative p-6 rounded-2xl bg-white dark:bg-[#25282e]/90 border border-slate-200 dark:border-white/10 hover:border-emerald-500/50 dark:hover:border-[#00bc8c]/70 shadow-xs hover:shadow-2xl hover:shadow-emerald-500/10 hover:-translate-y-2 transition-all duration-300 ease-out flex flex-col justify-between no-underline hover:no-underline animate-fade-in-up ${staggerClass} overflow-hidden`}
              >
                {/* Subtle radial glow on hover */}
                <div className="category-card-glow absolute -top-12 -right-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="category-icon-box w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-transparent border border-emerald-500/20 flex items-center justify-center shadow-xs group-hover:scale-110 group-hover:rotate-1 group-hover:border-emerald-500/40 group-hover:shadow-[0_0_16px_rgba(0,188,140,0.25)] transition-all duration-300 ease-out">
                      <Illustration className="w-8 h-8" />
                    </div>
                    <span className="category-count-badge px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-emerald-400 border border-slate-200 dark:border-white/10 group-hover:bg-emerald-500/15 group-hover:border-emerald-500/40 group-hover:text-emerald-500 dark:group-hover:text-emerald-300 group-hover:shadow-[0_0_12px_rgba(0,188,140,0.25)] transition-all duration-300 no-underline">
                      {cat.count.toLocaleString()}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-[#00bc8c] transition-colors flex items-center gap-1.5 no-underline group-hover:no-underline">
                    {cat.name}
                    <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-emerald-500 dark:text-[#00bc8c]" />
                  </h3>

                  <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed no-underline group-hover:no-underline">
                    {cat.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* External Resources Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Beginner's Guide Card */}
          <div className="p-6 rounded-2xl bg-white dark:bg-[#25282e]/90 border border-slate-200 dark:border-white/10 shadow-xs flex flex-col justify-between hover:border-emerald-500/50 hover:shadow-2xl hover:shadow-emerald-500/10 hover:-translate-y-1.5 transition-all duration-300 ease-out group animate-fade-in-up stagger-7">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="guide-icon-box w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-transparent border border-emerald-500/20 flex items-center justify-center shadow-xs flex-shrink-0 group-hover:scale-110 group-hover:border-emerald-500/40 group-hover:shadow-[0_0_14px_rgba(0,188,140,0.25)] transition-all duration-300 ease-out">
                  <GuideIllustration className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-[#00bc8c] transition-colors">
                    Beginner's Guide
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Official step-by-step tutorial series
                  </p>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                If you are new to DenizenM scripting, the official guide provides step-by-step tutorials, core concepts, and script examples to help you get started.
              </p>
            </div>
            <div className="mt-5">
              <a
                href="https://guide.denizenscript.com/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-white/5 hover:bg-emerald-600 hover:text-white dark:hover:bg-[#00bc8c] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 transition-all shadow-xs hover:shadow-md hover:scale-[1.02] active:scale-95 no-underline hover:no-underline group/btn"
              >
                <span>Read the Guide</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform duration-200" />
              </a>
            </div>
          </div>

          {/* Discord Card */}
          <div className="p-6 rounded-2xl bg-white dark:bg-[#25282e]/90 border border-slate-200 dark:border-white/10 shadow-xs flex flex-col justify-between hover:border-emerald-500/50 hover:shadow-2xl hover:shadow-emerald-500/10 hover:-translate-y-1.5 transition-all duration-300 ease-out group animate-fade-in-up stagger-8">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="discord-icon-box w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/15 via-emerald-500/10 to-transparent border border-indigo-500/20 flex items-center justify-center shadow-xs flex-shrink-0 group-hover:scale-110 group-hover:border-indigo-500/40 group-hover:shadow-[0_0_14px_rgba(99,102,241,0.25)] transition-all duration-300 ease-out">
                  <DiscordIllustration className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-[#00bc8c] transition-colors">
                    Our Denizen Community
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Active community &amp; script assistance
                  </p>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Community of DenizenM developers. Chat, ask scripting questions, and get help on Discord.
              </p>
            </div>
            <div className="mt-5">
              <a
                href="https://discord.gg/F2nftfP3nq"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-white/5 hover:bg-[#5865F2] hover:text-white dark:hover:bg-[#5865F2] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 transition-all shadow-xs hover:shadow-md hover:scale-[1.02] active:scale-95 no-underline hover:no-underline group/btn"
              >
                <span>Join Discord</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform duration-200" />
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
