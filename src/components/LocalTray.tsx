'use client';

import React from 'react';
import Link from 'next/link';

/**
 * LocalTray – renders page-specific tool buttons.
 *
 * Each page can define its own local tray items that appear
 * alongside (to the left of) the GlobalTray.
 */

export type LocalTrayItem =
  | { type: 'link'; href: string; external?: boolean; label: string; icon: React.ReactNode }
  | { type: 'button'; onClick: () => void; label: string; icon: React.ReactNode; badge?: string };

export function LocalTray({ items }: { items: LocalTrayItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="flex items-center gap-1 border-r border-slate-700/50 pr-2 mr-1">
      {items.map((item, idx) => {
        if (item.type === 'link') {
          if (item.external) {
            return (
              <a
                key={idx}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                title={item.label}
              >
                {item.icon}
              </a>
            );
          }
          return (
            <Link
              key={idx}
              href={item.href}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 font-medium transition-colors"
              title={item.label}
            >
              {item.icon}
              <span className="text-[13px] hidden sm:inline">{item.label}</span>
            </Link>
          );
        }

        // type === 'button'
        return (
          <button
            key={idx}
            onClick={item.onClick}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors flex items-center gap-1.5"
            title={item.label}
          >
            {item.icon}
            {item.badge && (
              <span className="text-[10px] font-semibold bg-slate-800 text-slate-400 rounded-full px-1.5 py-0.5">{item.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Pre-built local tray configs ──

const CAREER_LINKS = {
  linkedin: 'https://www.linkedin.com/in/attarira',
  github: 'https://github.com/attarira',
  resume: 'https://docs.google.com/document/d/1gnqkl4Q5bSDd1YFLqFO8K6SPooKS-xUT/edit',
};

export const CAREER_TRAY_ITEMS: LocalTrayItem[] = [
  {
    type: 'link',
    href: CAREER_LINKS.linkedin,
    external: true,
    label: 'LinkedIn',
    icon: (
      <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M20.45 20.45h-3.554v-5.568c0-1.328-.026-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.94v5.665H9.354V9h3.414v1.561h.049c.476-.9 1.637-1.85 3.37-1.85 3.603 0 4.263 2.372 4.263 5.457v6.282zM5.337 7.433a2.063 2.063 0 01-2.062-2.062 2.063 2.063 0 112.062 2.062zM7.116 20.45H3.558V9h3.558v11.45zM22.225 0H1.771C.792 0 0 .774 0 1.727v20.546C0 23.226.792 24 1.771 24h20.451C23.2 24 24 23.226 24 22.273V1.727C24 .774 23.2 0 22.225 0z" />
      </svg>
    ),
  },
  {
    type: 'link',
    href: CAREER_LINKS.github,
    external: true,
    label: 'GitHub',
    icon: (
      <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 .5C5.73.5.5 5.74.5 12.02c0 5.11 3.29 9.44 7.86 10.97.58.1.79-.25.79-.56 0-.27-.01-1-.01-1.96-3.2.7-3.88-1.55-3.88-1.55-.52-1.33-1.27-1.68-1.27-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.02 1.75 2.68 1.25 3.33.96.1-.74.4-1.25.73-1.54-2.56-.29-5.26-1.28-5.26-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.18 1.18a11.1 11.1 0 012.9-.39c.99 0 1.99.13 2.9.39 2.2-1.49 3.17-1.18 3.17-1.18.64 1.59.24 2.77.12 3.06.74.81 1.18 1.84 1.18 3.1 0 4.42-2.7 5.4-5.28 5.68.41.36.78 1.07.78 2.16 0 1.56-.02 2.82-.02 3.2 0 .31.21.67.8.56 4.56-1.53 7.85-5.86 7.85-10.97C23.5 5.74 18.27.5 12 .5z" />
      </svg>
    ),
  },
  {
    type: 'link',
    href: CAREER_LINKS.resume,
    external: true,
    label: 'Resume',
    icon: (
      <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 3h6l4 4v14H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 3v4h4" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6M9 17h6M9 9h3" />
      </svg>
    ),
  },
];

export const RECREATION_TRAY_ITEMS: LocalTrayItem[] = [
  {
    type: 'link',
    href: '/recreation/map',
    external: false,
    label: 'Travel Map',
    icon: (
      <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
  },
];
