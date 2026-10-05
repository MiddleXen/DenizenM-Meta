import React from 'react';

/**
 * Modern illustrated vector icons with multi-layer gradients and rich styling.
 * Designed specifically for Denizen Meta Documentation categories.
 * Supports theme-adaptive coloring via CSS variables with emerald fallbacks.
 */

export function CommandIllustration({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={`illustrated-icon ${className}`.trim()} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cmd_shell" x1="4" y1="6" x2="44" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--icon-primary, #10b981)" style={{ stopColor: 'var(--icon-primary, #10b981)' }} />
          <stop offset="0.5" stopColor="var(--icon-secondary, #059669)" style={{ stopColor: 'var(--icon-secondary, #059669)' }} />
          <stop offset="1" stopColor="var(--icon-dark, #047857)" style={{ stopColor: 'var(--icon-dark, #047857)' }} />
        </linearGradient>
        <linearGradient id="cmd_screen" x1="8" y1="14" x2="40" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--icon-screen-bg, #022c22)" style={{ stopColor: 'var(--icon-screen-bg, #022c22)' }} />
          <stop offset="1" stopColor="var(--icon-screen-border, #064e3b)" style={{ stopColor: 'var(--icon-screen-border, #064e3b)' }} />
        </linearGradient>
      </defs>
      {/* Outer Terminal Shell */}
      <rect x="4" y="6" width="40" height="36" rx="8" fill="url(#cmd_shell)" stroke="var(--icon-accent, #34d399)" strokeWidth="1.5" />
      {/* Terminal Title Bar */}
      <circle cx="10" cy="11.5" r="1.75" fill="#f87171" />
      <circle cx="15.5" cy="11.5" r="1.75" fill="var(--icon-amber, #fbbf24)" />
      <circle cx="21" cy="11.5" r="1.75" fill="var(--icon-glow, #6ee7b7)" />
      {/* Inner Screen */}
      <rect x="7" y="17" width="34" height="22" rx="4" fill="url(#cmd_screen)" stroke="var(--icon-stroke-dark, #065f46)" strokeWidth="1" />
      {/* Prompt >_ in glowing accent */}
      <path d="M12 23L17 27L12 31" stroke="var(--icon-accent, #34d399)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="21" y1="31" x2="31" y2="31" stroke="var(--icon-glow, #6ee7b7)" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="21" y="23" width="12" height="2" rx="1" fill="var(--icon-primary, #10b981)" opacity="0.7" />
    </svg>
  );
}

export function TagIllustration({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={`illustrated-icon ${className}`.trim()} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="tag_grad" x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--icon-primary, #10b981)" style={{ stopColor: 'var(--icon-primary, #10b981)' }} />
          <stop offset="0.5" stopColor="var(--icon-secondary, #059669)" style={{ stopColor: 'var(--icon-secondary, #059669)' }} />
          <stop offset="1" stopColor="var(--icon-dark, #047857)" style={{ stopColor: 'var(--icon-dark, #047857)' }} />
        </linearGradient>
        <linearGradient id="tag_inner" x1="12" y1="12" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--icon-screen-bg, #0f172a)" style={{ stopColor: 'var(--icon-screen-bg, #0f172a)' }} />
          <stop offset="1" stopColor="var(--icon-screen-border, #022c22)" style={{ stopColor: 'var(--icon-screen-border, #022c22)' }} />
        </linearGradient>
      </defs>
      {/* Tag outline */}
      <path d="M6 18L18 6H38C40.2091 6 42 7.79086 42 10V38C42 40.2091 40.2091 42 38 42H18L6 30V18Z" fill="url(#tag_grad)" stroke="var(--icon-accent, #34d399)" strokeWidth="1.2" />
      {/* Tag Inner Plaque */}
      <path d="M10 20L20 10H36C37.1046 10 38 10.8954 38 12V36C38 37.1046 37.1046 38 36 38H20L10 28V20Z" fill="url(#tag_inner)" opacity="0.9" />
      {/* Tag hole */}
      <circle cx="15" cy="24" r="2.5" fill="#f8fafc" />
      {/* Inside Expression Symbol < > */}
      <path d="M22 20L18 24L22 28" stroke="var(--icon-accent, #34d399)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M30 20L34 24L30 28" stroke="var(--icon-accent, #34d399)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Diamond Gem */}
      <path d="M26 21L28.5 24L26 27L23.5 24Z" fill="var(--icon-glow, #6ee7b7)" />
    </svg>
  );
}

export function ObjectTypeIllustration({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={`illustrated-icon ${className}`.trim()} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cube_top" x1="24" y1="5" x2="24" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--icon-accent, #34d399)" style={{ stopColor: 'var(--icon-accent, #34d399)' }} />
          <stop offset="1" stopColor="var(--icon-primary, #10b981)" style={{ stopColor: 'var(--icon-primary, #10b981)' }} />
        </linearGradient>
        <linearGradient id="cube_left" x1="6" y1="17" x2="24" y2="43" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--icon-secondary, #059669)" style={{ stopColor: 'var(--icon-secondary, #059669)' }} />
          <stop offset="1" stopColor="var(--icon-dark, #047857)" style={{ stopColor: 'var(--icon-dark, #047857)' }} />
        </linearGradient>
        <linearGradient id="cube_right" x1="24" y1="17" x2="42" y2="43" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--icon-dark, #047857)" style={{ stopColor: 'var(--icon-dark, #047857)' }} />
          <stop offset="1" stopColor="var(--icon-stroke-dark, #064e3b)" style={{ stopColor: 'var(--icon-stroke-dark, #064e3b)' }} />
        </linearGradient>
      </defs>
      {/* Isometric Cube Top Face */}
      <path d="M24 6L42 16L24 26L6 16L24 6Z" fill="url(#cube_top)" />
      {/* Isometric Grid lines on top face */}
      <path d="M15 11L33 21M33 11L15 21" stroke="var(--icon-glow-soft, #a7f3d0)" strokeWidth="1" strokeOpacity="0.4" />
      {/* Isometric Left Face */}
      <path d="M6 16L24 26V42L6 32V16Z" fill="url(#cube_left)" />
      <path d="M6 24L24 34M15 21V37" stroke="var(--icon-primary, #10b981)" strokeWidth="1" strokeOpacity="0.3" />
      {/* Isometric Right Face */}
      <path d="M24 26L42 16V32L24 42V26Z" fill="url(#cube_right)" />
      <path d="M24 34L42 24M33 21V37" stroke="var(--icon-secondary, #059669)" strokeWidth="1" strokeOpacity="0.3" />
      {/* Outer Edges */}
      <path d="M24 6L42 16V32L24 42L6 32V16L24 6Z" stroke="var(--icon-stroke-dark, #065f46)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M24 26V42M24 26L6 16M24 26L42 16" stroke="var(--icon-stroke-dark, #065f46)" strokeWidth="1.5" />
    </svg>
  );
}

export function MechanismIllustration({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={`illustrated-icon ${className}`.trim()} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gear_grad1" x1="10" y1="10" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--icon-primary, #10b981)" style={{ stopColor: 'var(--icon-primary, #10b981)' }} />
          <stop offset="1" stopColor="var(--icon-dark, #047857)" style={{ stopColor: 'var(--icon-dark, #047857)' }} />
        </linearGradient>
        <linearGradient id="gear_grad2" x1="24" y1="20" x2="44" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--icon-accent, #34d399)" style={{ stopColor: 'var(--icon-accent, #34d399)' }} />
          <stop offset="1" stopColor="var(--icon-secondary, #059669)" style={{ stopColor: 'var(--icon-secondary, #059669)' }} />
        </linearGradient>
      </defs>
      {/* Big Gear */}
      <path d="M20 7H24V10.5C24.8 10.7 25.6 11 26.3 11.4L29 8.8L31.8 11.6L29.3 14.3C29.7 15 30 15.8 30.2 16.6H33.7V20.6H30.2C30 21.4 29.7 22.2 29.3 22.9L31.8 25.6L29 28.4L26.3 25.8C25.6 26.2 24.8 26.5 24 26.7V30.2H20V26.7C19.2 26.5 18.4 26.2 17.7 25.8L15 28.4L12.2 25.6L14.7 22.9C14.3 22.2 14 21.4 13.8 20.6H10.3V16.6H13.8C14 15.8 14.3 15 14.7 14.3L12.2 11.6L15 8.8L17.7 11.4C18.4 11 19.2 10.7 20 10.5V7Z" fill="url(#gear_grad1)" stroke="var(--icon-stroke-dark, #064e3b)" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="22" cy="18.6" r="4.5" fill="var(--icon-screen-bg, #0f172a)" stroke="var(--icon-glow, #6ee7b7)" strokeWidth="1.5" />
      {/* Secondary interlocking gear */}
      <path d="M33 26H36V28.5C36.6 28.7 37.2 29 37.7 29.3L39.7 27.3L41.7 29.3L39.8 31.3C40.1 31.8 40.4 32.4 40.5 33H43V36H40.5C40.4 36.6 40.1 37.2 39.8 37.7L41.7 39.7L39.7 41.7L37.7 39.8C37.2 40.1 36.6 40.4 36 40.5V43H33V40.5C32.4 40.4 31.8 40.1 31.3 39.8L29.3 41.7L27.3 39.7L29.3 37.7C29 37.2 28.7 36.6 28.5 36H26V33H28.5C28.7 32.4 29 31.8 29.3 31.3L27.3 29.3L29.3 27.3L31.3 29.3C31.8 29 32.4 28.7 33 28.5V26Z" fill="url(#gear_grad2)" stroke="var(--icon-stroke-dark, #064e3b)" strokeWidth="1" strokeLinejoin="round" />
      <circle cx="34.5" cy="34.5" r="3.2" fill="var(--icon-screen-bg, #0f172a)" stroke="var(--icon-glow-soft, #a7f3d0)" strokeWidth="1.2" />
    </svg>
  );
}

export function EventIllustration({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={`illustrated-icon ${className}`.trim()} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="event_bolt" x1="28" y1="4" x2="16" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--icon-amber, #fbbf24)" style={{ stopColor: 'var(--icon-amber, #fbbf24)' }} />
          <stop offset="0.3" stopColor="var(--icon-accent, #34d399)" style={{ stopColor: 'var(--icon-accent, #34d399)' }} />
          <stop offset="1" stopColor="var(--icon-secondary, #059669)" style={{ stopColor: 'var(--icon-secondary, #059669)' }} />
        </linearGradient>
        <radialGradient id="event_glow" cx="24" cy="24" r="18" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--icon-primary, #10b981)" style={{ stopColor: 'var(--icon-primary, #10b981)' }} stopOpacity="0.3" />
          <stop offset="1" stopColor="var(--icon-primary, #10b981)" style={{ stopColor: 'var(--icon-primary, #10b981)' }} stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Background Energy Glow */}
      <circle cx="24" cy="24" r="18" fill="url(#event_glow)" />
      {/* Radiating Energy Ring */}
      <circle cx="24" cy="24" r="15" stroke="var(--icon-accent, #34d399)" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
      {/* High-Voltage Lightning Bolt */}
      <path d="M26 4L13 24H23L19 44L35 20H25L29 4H26Z" fill="url(#event_bolt)" stroke="var(--icon-stroke-dark, #064e3b)" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Small energy spark dots */}
      <circle cx="10" cy="16" r="1.5" fill="var(--icon-accent, #34d399)" />
      <circle cx="38" cy="32" r="1.5" fill="var(--icon-amber, #fbbf24)" />
      <circle cx="34" cy="12" r="1" fill="var(--icon-glow, #6ee7b7)" />
    </svg>
  );
}

export function LanguageIllustration({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={`illustrated-icon ${className}`.trim()} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lang_sheet" x1="8" y1="6" x2="40" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--icon-primary, #10b981)" style={{ stopColor: 'var(--icon-primary, #10b981)' }} />
          <stop offset="0.5" stopColor="var(--icon-secondary, #059669)" style={{ stopColor: 'var(--icon-secondary, #059669)' }} />
          <stop offset="1" stopColor="var(--icon-dark, #047857)" style={{ stopColor: 'var(--icon-dark, #047857)' }} />
        </linearGradient>
        <linearGradient id="lang_inner" x1="12" y1="14" x2="36" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--icon-screen-bg, #022c22)" style={{ stopColor: 'var(--icon-screen-bg, #022c22)' }} />
          <stop offset="1" stopColor="var(--icon-screen-border, #064e3b)" style={{ stopColor: 'var(--icon-screen-border, #064e3b)' }} />
        </linearGradient>
      </defs>
      {/* Vibrant Document Sheet */}
      <path d="M10 6C8.89543 6 8 6.89543 8 8V40C8 41.1046 8.89543 42 10 42H38C39.1046 42 40 41.1046 40 40V16L30 6H10Z" fill="url(#lang_sheet)" stroke="var(--icon-accent, #34d399)" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Folded Corner */}
      <path d="M30 6V16H40L30 6Z" fill="var(--icon-glow, #6ee7b7)" stroke="var(--icon-dark, #047857)" strokeWidth="1" />
      {/* Inner Script Plaque */}
      <rect x="12" y="16" width="24" height="20" rx="3" fill="url(#lang_inner)" stroke="var(--icon-stroke-dark, #065f46)" strokeWidth="1" />
      {/* Script Lines with Denizen Indentation */}
      <rect x="15" y="19" width="10" height="2" rx="1" fill="var(--icon-accent, #34d399)" />
      <rect x="15" y="24" width="14" height="2" rx="1" fill="var(--icon-glow, #6ee7b7)" />
      <rect x="18" y="28" width="12" height="2" rx="1" fill="var(--icon-glow-soft, #a7f3d0)" />
      {/* Curly braces symbol { } */}
      <path d="M31 22C30.2 22 29.5 22.5 29.5 23.2C29.5 23.8 28.8 24.2 28 24.2C28.8 24.2 29.5 24.6 29.5 25.2C29.5 25.9 30.2 26.4 31 26.4" stroke="var(--icon-amber, #fbbf24)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function ActionIllustration({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={`illustrated-icon ${className}`.trim()} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="npc_head" x1="16" y1="8" x2="32" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--icon-accent, #34d399)" style={{ stopColor: 'var(--icon-accent, #34d399)' }} />
          <stop offset="1" stopColor="var(--icon-secondary, #059669)" style={{ stopColor: 'var(--icon-secondary, #059669)' }} />
        </linearGradient>
        <linearGradient id="npc_body" x1="12" y1="24" x2="36" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--icon-primary, #10b981)" style={{ stopColor: 'var(--icon-primary, #10b981)' }} />
          <stop offset="1" stopColor="var(--icon-dark, #047857)" style={{ stopColor: 'var(--icon-dark, #047857)' }} />
        </linearGradient>
      </defs>
      {/* NPC Head / Block character */}
      <rect x="17" y="8" width="14" height="14" rx="4" fill="url(#npc_head)" stroke="var(--icon-stroke-dark, #064e3b)" strokeWidth="1.5" />
      {/* Head details: NPC Eyes */}
      <rect x="20" y="13" width="2" height="2.5" rx="0.5" fill="var(--icon-stroke-dark, #064e3b)" />
      <rect x="26" y="13" width="2" height="2.5" rx="0.5" fill="var(--icon-stroke-dark, #064e3b)" />
      {/* Body / Torso */}
      <path d="M12 26C12 24.8954 12.8954 24 14 24H34C35.1046 24 36 24.8954 36 26V40C36 41.1046 35.1046 42 34 42H14C12.8954 42 12 41.1046 12 40V26Z" fill="url(#npc_body)" stroke="var(--icon-stroke-dark, #064e3b)" strokeWidth="1.5" />
      {/* Action target reticle on the right */}
      <circle cx="36" cy="14" r="6" stroke="var(--icon-amber, #fbbf24)" strokeWidth="1.5" strokeDasharray="2 2" />
      <circle cx="36" cy="14" r="2" fill="var(--icon-amber, #fbbf24)" />
      <path d="M36 6V10M36 18V22M28 14H32M40 14H44" stroke="var(--icon-amber, #fbbf24)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function GuideIllustration({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={`illustrated-icon ${className}`.trim()} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="book_cover" x1="6" y1="10" x2="42" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--icon-secondary, #059669)" style={{ stopColor: 'var(--icon-secondary, #059669)' }} />
          <stop offset="1" stopColor="var(--icon-stroke-dark, #064e3b)" style={{ stopColor: 'var(--icon-stroke-dark, #064e3b)' }} />
        </linearGradient>
        <linearGradient id="book_pages" x1="12" y1="12" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f8fafc" />
          <stop offset="1" stopColor="#e2e8f0" />
        </linearGradient>
      </defs>
      {/* Open Book Wings */}
      <path d="M8 38C14 36 20 37 24 39C28 37 34 36 40 38V12C34 10 28 11 24 13C20 11 14 10 8 12V38Z" fill="url(#book_cover)" stroke="var(--icon-stroke-dark, #064e3b)" strokeWidth="1.5" />
      {/* Inside Paper Pages */}
      <path d="M10 35C15 33.5 19.5 34.5 23 36V11C19.5 9.5 15 8.5 10 10V35Z" fill="url(#book_pages)" />
      <path d="M38 35C33 33.5 28.5 34.5 25 36V11C28.5 9.5 33 8.5 38 10V35Z" fill="url(#book_pages)" />
      {/* Text Lines */}
      <line x1="14" y1="16" x2="20" y2="15.5" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="14" y1="21" x2="20" y2="20.5" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="14" y1="26" x2="19" y2="25.5" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="28" y1="15.5" x2="34" y2="16" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="28" y1="20.5" x2="34" y2="21" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
      {/* Golden Bookmark Ribbon */}
      <path d="M23 11V26L24 24L25 26V11H23Z" fill="var(--icon-amber, #fbbf24)" stroke="var(--icon-amber-dark, #d97706)" strokeWidth="0.5" />
    </svg>
  );
}

/**
 * Authentic Official Discord SVG Logo with theme adaptive fill
 */
export function DiscordIllustration({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg className={`illustrated-icon discord-icon ${className}`.trim()} viewBox="0 0 127.14 96.36" fill="var(--icon-discord, #5865F2)" xmlns="http://www.w3.org/2000/svg">
      <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
    </svg>
  );
}
