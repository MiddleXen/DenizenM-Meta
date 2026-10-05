import React from 'react';
import Link from 'next/link';
import { MessageSquare, BookOpen } from 'lucide-react';

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="w-full border-t border-slate-200/80 dark:border-[#444444] bg-white/50 dark:bg-[#1a1a1a]/80 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand & Info */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white">
                DenizenM Meta
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#00bc8c]/10 text-[#00bc8c] dark:text-[#00bc8c] font-semibold border border-[#00bc8c]/20">
                v2.0
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md leading-relaxed">
              Fast, high-performance meta-documentation explorer for DenizenM script commands, tags, events, mechanisms, and object types.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-500">
              Documentation sourced from{' '}
              <a
                href="https://github.com/Energobro/DenizenM-Tjtoxshpilivili1"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-[#00bc8c] transition-colors"
              >
                DenizenM-Tjtoxshpilivili1
              </a>{' '}
              &amp;{' '}
              <a
                href="https://github.com/Energobro/DenizenM-Core"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-[#00bc8c] transition-colors"
              >
                DenizenM-Core
              </a>.
            </p>
          </div>

          {/* Quick Docs Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-slate-200">
              Documentation
            </h4>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <li>
                <Link href="/Docs/Commands" className="hover:text-[#00bc8c] transition-colors">
                  Commands
                </Link>
              </li>
              <li>
                <Link href="/Docs/Tags" className="hover:text-[#00bc8c] transition-colors">
                  Tags
                </Link>
              </li>
              <li>
                <Link href="/Docs/Events" className="hover:text-[#00bc8c] transition-colors">
                  Events
                </Link>
              </li>
              <li>
                <Link href="/Docs/Mechanisms" className="hover:text-[#00bc8c] transition-colors">
                  Mechanisms
                </Link>
              </li>
              <li>
                <Link href="/Docs/ObjectTypes" className="hover:text-[#00bc8c] transition-colors">
                  Object Types
                </Link>
              </li>
            </ul>
          </div>

          {/* Community & Repos */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-slate-200">
              Community &amp; Source
            </h4>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <li>
                <a
                  href="https://discord.gg/F2nftfP3nq"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 hover:text-[#00bc8c] transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-[#00bc8c]" />
                  Our Denizen Community
                </a>
              </li>
              <li>
                <a
                  href="https://guide.denizenscript.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 hover:text-[#00bc8c] transition-colors"
                >
                  <BookOpen className="w-3.5 h-3.5 text-[#00bc8c]" />
                  Beginner&apos;s Guide
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/MiddleXen/Denizen-Meta-Website"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 hover:text-[#00bc8c] transition-colors"
                >
                  <GithubIcon className="w-3.5 h-3.5" />
                  GitHub Repository
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
