import { Metadata } from 'next';
import Link from 'next/link';
import { getMetaDocs } from '@/lib/meta-store';
import {
  Terminal,
  Code2,
  Boxes,
  Sliders,
  Zap,
  Globe,
  Bot,
  BookOpen,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { HomeSearch } from '@/components/HomeSearch';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Home | DenizenM Meta Documentation',
  description: 'Fast, complete meta-documentation reference for Denizen commands, tags, events, mechanisms, and object types.',
};

function DiscordIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

function GithubIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

export default async function HomePage() {
  const docs = await getMetaDocs();

  const categories = [
    {
      href: '/Docs/Commands',
      name: 'Commands',
      tag: 'CMD',
      count: Object.keys(docs.commands).length,
      icon: Terminal,
      color: 'emerald',
      iconBoxStyle: 'bg-emerald-500/10 text-emerald-500 dark:text-[#00bc8c] border-emerald-500/25',
      badgeStyle: 'text-emerald-600 dark:text-[#00bc8c] bg-emerald-500/10 border-emerald-500/20',
      hoverBorder: 'hover:border-emerald-500/50 hover:shadow-[0_8px_30px_rgba(0,188,140,0.12)]',
      hoverText: 'group-hover:text-emerald-500 dark:group-hover:text-[#00bc8c]',
      description: 'Executable actions in scripts. Prefixed with a dash (-) to execute gameplay logic, manipulate entities, and control flow.',
    },
    {
      href: '/Docs/Tags',
      name: 'Tags',
      tag: 'TAG',
      count: Object.keys(docs.tags).length,
      icon: Code2,
      color: 'sky',
      iconBoxStyle: 'bg-sky-500/10 text-sky-500 dark:text-sky-400 border-sky-500/25',
      badgeStyle: 'text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/20',
      hoverBorder: 'hover:border-sky-500/50 hover:shadow-[0_8px_30px_rgba(14,165,233,0.12)]',
      hoverText: 'group-hover:text-sky-500 dark:group-hover:text-sky-400',
      description: 'Dynamic expressions wrapped in < > used to read object properties, compute math, and inspect game state in real time.',
    },
    {
      href: '/Docs/ObjectTypes',
      name: 'Object Types',
      tag: 'TYPE',
      count: Object.keys(docs.objectTypes).length,
      icon: Boxes,
      color: 'violet',
      iconBoxStyle: 'bg-violet-500/10 text-violet-500 dark:text-violet-400 border-violet-500/25',
      badgeStyle: 'text-violet-600 dark:text-violet-400 bg-violet-500/10 border-violet-500/20',
      hoverBorder: 'hover:border-violet-500/50 hover:shadow-[0_8px_30px_rgba(139,92,246,0.12)]',
      hoverText: 'group-hover:text-violet-500 dark:group-hover:text-violet-400',
      description: 'Core data representations including PlayerTag, LocationTag, ItemTag, EntityTag, and WorldTag structures.',
    },
    {
      href: '/Docs/Mechanisms',
      name: 'Mechanisms',
      tag: 'MECH',
      count: Object.keys(docs.mechanisms).length,
      icon: Sliders,
      color: 'amber',
      iconBoxStyle: 'bg-amber-500/10 text-amber-500 dark:text-amber-400 border-amber-500/25',
      badgeStyle: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20',
      hoverBorder: 'hover:border-amber-500/50 hover:shadow-[0_8px_30px_rgba(245,158,11,0.12)]',
      hoverText: 'group-hover:text-amber-500 dark:group-hover:text-amber-400',
      description: 'Setters and modifiers used with adjust or inventory mechanisms to modify attributes and game objects.',
    },
    {
      href: '/Docs/Events',
      name: 'Events',
      tag: 'EVENT',
      count: Object.keys(docs.events).length,
      icon: Zap,
      color: 'rose',
      iconBoxStyle: 'bg-rose-500/10 text-rose-500 dark:text-rose-400 border-rose-500/25',
      badgeStyle: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20',
      hoverBorder: 'hover:border-rose-500/50 hover:shadow-[0_8px_30px_rgba(244,63,94,0.12)]',
      hoverText: 'group-hover:text-rose-500 dark:group-hover:text-rose-400',
      description: 'Triggers that execute script containers when events occur in the Minecraft world or Bukkit/Paper engine.',
    },
    {
      href: '/Docs/Languages',
      name: 'Languages',
      tag: 'LANG',
      count: Object.keys(docs.languages).length,
      icon: Globe,
      color: 'blue',
      iconBoxStyle: 'bg-blue-500/10 text-blue-500 dark:text-blue-400 border-blue-500/25',
      badgeStyle: 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20',
      hoverBorder: 'hover:border-blue-500/50 hover:shadow-[0_8px_30px_rgba(59,130,246,0.12)]',
      hoverText: 'group-hover:text-blue-500 dark:group-hover:text-blue-400',
      description: 'Script file formatting specifications, language container definitions, and meta documentation guides.',
    },
    {
      href: '/Docs/Actions',
      name: 'NPC Actions',
      tag: 'NPC',
      count: Object.keys(docs.actions).length,
      icon: Bot,
      color: 'teal',
      iconBoxStyle: 'bg-teal-500/10 text-teal-500 dark:text-teal-400 border-teal-500/25',
      badgeStyle: 'text-teal-600 dark:text-teal-400 bg-teal-500/10 border-teal-500/20',
      hoverBorder: 'hover:border-teal-500/50 hover:shadow-[0_8px_30px_rgba(20,184,166,0.12)]',
      hoverText: 'group-hover:text-teal-500 dark:group-hover:text-teal-400',
      description: 'Context triggers for Citizens NPCs firing on player clicks, damage, movement, and navigation.',
    },
  ];

  const totalCount = docs.allObjects.length;

  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-14 pb-10 text-center">
        {/* Main Title: Restored authentic DenizenM Documentation */}
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.15]">
          DenizenM{' '}
          <span className="text-emerald-500 dark:text-[#00bc8c]">
            Documentation
          </span>
        </h1>

        <p className="mt-4 text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Documentation reference covering over{' '}
          <span className="font-bold text-emerald-600 dark:text-[#00bc8c]">{totalCount.toLocaleString()}</span> commands,
          tags, events, mechanisms, object types, and addon meta.
        </p>

        {/* Hero Search Bar with Dynamic Recent Searches */}
        <div className="mt-8 max-w-2xl mx-auto">
          <HomeSearch />
        </div>
      </section>

      {/* Categories Grid (Without the strange top border line) */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 mb-5">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Categories
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Explore script actions, expressions, data types, and engine hooks
            </p>
          </div>
          <span className="inline-flex items-center text-xs font-mono font-medium px-2.5 py-1 rounded-md bg-white dark:bg-[#0c0e14] text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-white/[0.08] self-start sm:self-auto shadow-2xs">
            {categories.length} Sections &bull; {totalCount.toLocaleString()} Entries
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <Link
                key={cat.href}
                href={cat.href}
                className={`group relative p-5 rounded-xl bg-white dark:bg-[#0c0e14]/90 border border-slate-200/80 dark:border-white/[0.07] ${cat.hoverBorder} transition-all duration-200 flex flex-col justify-between no-underline hover:no-underline shadow-xs hover:-translate-y-1`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3.5">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${cat.iconBoxStyle} shadow-2xs transition-transform duration-200 group-hover:scale-105`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded border inline-flex items-center justify-center leading-none ${cat.badgeStyle}`}>
                        {cat.tag}
                      </span>
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-50 dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-white/10 inline-flex items-center justify-center leading-none">
                        {cat.count.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <h3 className={`text-base font-bold text-slate-900 dark:text-white ${cat.hoverText} transition-colors flex items-center justify-between`}>
                    <span>{cat.name}</span>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-all" />
                  </h3>

                  <p className="mt-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                    {cat.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs font-medium text-slate-400 dark:text-slate-500">
                  <span className={`${cat.hoverText} transition-colors`}>Browse {cat.name}</span>
                  <span className="font-mono text-[11px]">&rarr;</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* External Resources Section (Seamless dark cards) */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4.5">
          {/* Beginner's Guide Card */}
          <a
            href="https://guide.denizenscript.com/"
            target="_blank"
            rel="noreferrer"
            className="p-5 rounded-xl bg-white dark:bg-[#0c0e14]/90 border border-slate-200/80 dark:border-white/[0.07] hover:border-emerald-500/50 hover:shadow-[0_8px_30px_rgba(0,188,140,0.12)] transition-all duration-200 flex flex-col justify-between group no-underline hover:no-underline shadow-xs hover:-translate-y-1"
          >
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 dark:text-[#00bc8c] border border-emerald-500/25 flex items-center justify-center shadow-2xs">
                  <BookOpen className="w-5 h-5" />
                </div>
                <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 dark:group-hover:text-[#00bc8c] transition-colors" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-emerald-500 dark:group-hover:text-[#00bc8c] transition-colors">
                Beginner&apos;s Guide
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Step-by-step tutorial series covering script containers, tag syntax, events, and script structures.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-[#00bc8c]">
              <span>Read Official Guide</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </a>

          {/* Discord Community Card */}
          <a
            href="https://discord.gg/F2nftfP3nq"
            target="_blank"
            rel="noreferrer"
            className="p-5 rounded-xl bg-white dark:bg-[#0c0e14]/90 border border-slate-200/80 dark:border-white/[0.07] hover:border-[#5865F2]/50 hover:shadow-[0_8px_30px_rgba(88,101,242,0.15)] transition-all duration-200 flex flex-col justify-between group no-underline hover:no-underline shadow-xs hover:-translate-y-1"
          >
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#5865F2]/10 text-[#5865F2] border border-[#5865F2]/25 flex items-center justify-center shadow-2xs">
                  <DiscordIcon className="w-5 h-5" />
                </div>
                <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-[#5865F2] transition-colors" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-[#5865F2] transition-colors">
                Denizen Community Discord
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Chat with scriptwriters, ask questions, debug scripts, and get real-time assistance on Discord.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs font-semibold text-[#5865F2]">
              <span>Join Discord</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </a>

          {/* GitHub Source Repositories Card */}
          <a
            href="https://github.com/Energobro/DenizenM-Tjtoxshpilivili1"
            target="_blank"
            rel="noreferrer"
            className="p-5 rounded-xl bg-white dark:bg-[#0c0e14]/90 border border-slate-200/80 dark:border-white/[0.07] hover:border-slate-400 dark:hover:border-slate-500 hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] transition-all duration-200 flex flex-col justify-between group no-underline hover:no-underline shadow-xs hover:-translate-y-1"
          >
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <div className="w-10 h-10 rounded-xl bg-slate-500/10 text-slate-700 dark:text-slate-200 border border-slate-500/25 flex items-center justify-center shadow-2xs">
                  <GithubIcon className="w-5 h-5" />
                </div>
                <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white transition-colors" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-slate-700 dark:group-hover:text-white transition-colors">
                Open Source Repositories
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Source code for the documentation explorer, compiler, meta scraper, and Denizen addons.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>View on GitHub</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </a>
        </div>
      </section>
    </div>
  );
}
