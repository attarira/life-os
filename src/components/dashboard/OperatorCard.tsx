'use client';

import React, { useEffect, useState } from 'react';
import { getOperatorProfile, saveOperatorProfile, OperatorProfile } from '@/lib/repos/operator';
import { getStreak } from '@/lib/repos/habits';

export const HABITS_UPDATED_EVENT = 'lifeos:habits-updated';
export const OPERATOR_UPDATED_EVENT = 'lifeos:operator-updated';

const DEFAULT_PROFILE: OperatorProfile = {
  name: 'Rayaan',
  role: 'Founder',
  location: '',
  focus: 'Building an empire.',
};

export function operatorInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'OS';
}

export function OperatorCard() {
  const [profile, setProfile] = useState<OperatorProfile>(DEFAULT_PROFILE);
  const [streak, setStreak] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<OperatorProfile>(DEFAULT_PROFILE);

  useEffect(() => {
    getOperatorProfile(DEFAULT_PROFILE).then((p) => { setProfile(p); setDraft(p); }).catch(() => {});
    getStreak().then(setStreak).catch(() => {});
  }, []);

  useEffect(() => {
    const refresh = () => getStreak().then(setStreak).catch(() => {});
    window.addEventListener(HABITS_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(HABITS_UPDATED_EVENT, refresh);
  }, []);

  const save = async () => {
    const next: OperatorProfile = {
      name: draft.name.trim() || DEFAULT_PROFILE.name,
      role: draft.role.trim(),
      location: draft.location.trim(),
      focus: draft.focus.trim(),
    };
    setProfile(next);
    setEditing(false);
    await saveOperatorProfile(next);
    window.dispatchEvent(new CustomEvent(OPERATOR_UPDATED_EVENT));
  };

  const subtitle = [profile.role, profile.location].filter(Boolean).join(' · ');
  const [firstName, ...rest] = profile.name.split(/\s+/);

  return (
    <section className="relative flex flex-col overflow-hidden rounded-xl border border-[var(--op-border)] bg-[var(--op-panel)] backdrop-blur-sm">
      <header className="flex items-center justify-between gap-3 border-b border-[var(--op-border)] px-4 py-2.5">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em]">
          <span className="tabular-nums text-[var(--op-dim)]">01</span>
          <span className="text-[var(--op-dim)]">{'//'}</span>
          <span className="text-[var(--op-muted)]">Operator</span>
        </div>
        <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--op-accent)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--op-accent)] shadow-[0_0_6px_var(--op-accent)]" />
          Online
        </span>
      </header>

      <div className="p-4">
        {editing ? (
          <div className="space-y-2">
            {(['name', 'role', 'location', 'focus'] as const).map((field) => (
              <input
                key={field}
                value={draft[field]}
                onChange={(e) => setDraft((d) => ({ ...d, [field]: e.target.value }))}
                placeholder={field[0].toUpperCase() + field.slice(1)}
                className="w-full rounded-md border border-[var(--op-border)] bg-[var(--op-inset)] px-3 py-2 text-[13px] text-[var(--op-text)] placeholder:text-[var(--op-dim)] focus:border-[var(--op-border-strong)] focus:outline-none"
              />
            ))}
            <div className="flex items-center gap-2 pt-1">
              <button onClick={save} className="rounded-md bg-[var(--op-accent)] px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-[#05221a] transition-opacity hover:opacity-90">Save</button>
              <button onClick={() => { setDraft(profile); setEditing(false); }} className="rounded-md px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-[var(--op-muted)] transition-colors hover:text-[var(--op-text)]">Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--op-border-strong)] bg-gradient-to-br from-slate-700/60 to-slate-900 font-mono text-sm font-semibold text-[var(--op-sub)]">
                {operatorInitials(profile.name)}
              </div>
              <div className="min-w-0">
                <h3 className="op-serif truncate text-[18px] leading-tight text-[var(--op-text)]">
                  {firstName} {rest.length > 0 && <span className="italic font-light">{rest.join(' ')}</span>}
                </h3>
                {subtitle && (
                  <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--op-muted)]">{subtitle}</p>
                )}
              </div>
              <button
                onClick={() => { setDraft(profile); setEditing(true); }}
                className="ml-auto flex-shrink-0 rounded-md p-1.5 text-[var(--op-dim)] transition-colors hover:bg-white/[0.04] hover:text-[var(--op-text)]"
                title="Edit operator profile"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--op-border)] pt-4">
              <div className="min-w-0">
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--op-dim)]">Focus</p>
                <p className="op-serif mt-1.5 truncate text-[14px] italic text-[var(--op-sub)]" title={profile.focus}>
                  {profile.focus || '—'}
                </p>
              </div>
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--op-dim)]">Streak</p>
                <p className="mt-1 flex items-baseline gap-1.5">
                  <span className="font-mono text-2xl font-medium tabular-nums text-[var(--op-text)]">{streak}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--op-muted)]">days</span>
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
