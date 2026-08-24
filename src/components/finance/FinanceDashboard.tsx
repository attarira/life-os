'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Account,
  AccountInput,
  AccountKind,
  AccountType,
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPE_ORDER,
  addAccount,
  listAccounts,
  removeAccount,
  updateAccount,
} from '@/lib/repos/accounts';
import { snapshotNetWorth } from '@/lib/repos/networth';

type AccountDraft = {
  name: string;
  accountType: AccountType;
  kind: AccountKind;
  balance: string;
  institution: string;
  accountNumberLast4: string;
  notes: string;
};

const EMPTY_DRAFT: AccountDraft = {
  name: '',
  accountType: 'bank',
  kind: 'asset',
  balance: '',
  institution: '',
  accountNumberLast4: '',
  notes: '',
};

const ACCOUNT_TYPE_OPTIONS: { value: AccountType; label: string }[] = [
  { value: 'bank', label: 'Bank' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'investment', label: 'Investment' },
  { value: 'retirement', label: 'Retirement' },
  { value: 'loan', label: 'Loan' },
  { value: 'mortgage', label: 'Mortgage' },
  { value: 'cash', label: 'Cash' },
  { value: 'other_asset', label: 'Other Asset' },
];

function formatINR(value: number, fractionDigits = 0): string {
  return `₹${value.toLocaleString('en-IN', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}

function formatTimestamp(value?: string): string {
  if (!value) return 'Not updated yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not updated yet';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function accountToDraft(account: Account): AccountDraft {
  return {
    name: account.name,
    accountType: account.accountType,
    kind: account.kind,
    balance: String(account.balance),
    institution: account.institution ?? '',
    accountNumberLast4: account.metadata.accountNumberLast4 ?? '',
    notes: account.metadata.notes ?? '',
  };
}

function draftToInput(draft: AccountDraft, sortOrder?: number): AccountInput {
  const accountType = draft.accountType;
  return {
    name: draft.name.trim(),
    accountType,
    kind: draft.kind,
    balance: Number(draft.balance.replace(/,/g, '')) || 0,
    institution: draft.institution.trim() || undefined,
    metadata: {
      accountNumberLast4: draft.accountNumberLast4.trim() || undefined,
      notes: draft.notes.trim() || undefined,
    },
    sortOrder,
  };
}

function accountTypeTone(type: AccountType): string {
  switch (type) {
    case 'bank':
      return 'bg-sky-400/10 text-sky-200 border-sky-300/20';
    case 'credit_card':
      return 'bg-rose-400/10 text-rose-200 border-rose-300/20';
    case 'investment':
      return 'bg-[var(--op-accent-dim)] text-[var(--op-accent)] border-[var(--op-accent)]/20';
    case 'retirement':
      return 'bg-violet-400/10 text-violet-200 border-violet-300/20';
    case 'loan':
      return 'bg-orange-400/10 text-orange-200 border-orange-300/20';
    case 'mortgage':
      return 'bg-fuchsia-400/10 text-fuchsia-200 border-fuchsia-300/20';
    case 'cash':
      return 'bg-amber-400/10 text-amber-200 border-amber-300/20';
    default:
      return 'bg-slate-400/10 text-slate-200 border-slate-300/20';
  }
}

export function FinanceDashboard({ embedded = false }: { embedded?: boolean }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [draft, setDraft] = useState<AccountDraft>(EMPTY_DRAFT);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      setAccounts(await listAccounts());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load financial accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const totals = useMemo(() => {
    const assets = accounts.filter((a) => a.kind === 'asset').reduce((sum, account) => sum + account.balance, 0);
    const liabilities = accounts.filter((a) => a.kind === 'liability').reduce((sum, account) => sum + account.balance, 0);
    return { assets, liabilities, netAssets: assets - liabilities };
  }, [accounts]);

  const grouped = useMemo(() => {
    return ACCOUNT_TYPE_ORDER.map((type) => ({
      type,
      accounts: accounts.filter((account) => account.accountType === type),
    })).filter((group) => group.accounts.length > 0);
  }, [accounts]);

  const persistSnapshot = async (nextAccounts: Account[]) => {
    const assets = nextAccounts.filter((a) => a.kind === 'asset').reduce((sum, account) => sum + account.balance, 0);
    const liabilities = nextAccounts.filter((a) => a.kind === 'liability').reduce((sum, account) => sum + account.balance, 0);
    await snapshotNetWorth(assets, liabilities).catch(() => {});
  };

  const openCreate = () => {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
    setFormError(null);
    setEditorOpen(true);
  };

  const openEdit = (account: Account) => {
    setEditing(account);
    setDraft(accountToDraft(account));
    setFormError(null);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditing(null);
    setDraft(EMPTY_DRAFT);
    setFormError(null);
  };

  const saveAccount = async () => {
    if (!draft.name.trim()) return;
    setSaving(true);
    setError(null);
    setFormError(null);
    setNotice(null);
    const accountName = draft.name.trim();
    try {
      if (editing) {
        const updated = await updateAccount(editing.id, draftToInput(draft, editing.sortOrder));
        const next = accounts.map((account) => (account.id === editing.id ? updated : account));
        setAccounts(next);
        await persistSnapshot(next);
        setNotice(`${updated.name} updated.`);
      } else {
        const created = await addAccount(draftToInput(draft, accounts.length), accounts.length);
        const next = [...accounts, created];
        setAccounts(next);
        await persistSnapshot(next);
        setNotice(`${created.name} added.`);
      }
      closeEditor();
    } catch (err) {
      const message = err instanceof Error ? err.message : `Could not save ${accountName}.`;
      setFormError(message);
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const deleteAccount = async (account: Account) => {
    const confirmed = window.confirm(`Remove ${account.name}?`);
    if (!confirmed) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const next = accounts.filter((item) => item.id !== account.id);
      setAccounts(next);
      await removeAccount(account.id);
      await persistSnapshot(next);
      setNotice(`${account.name} removed.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove account.');
      refresh();
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full rounded-lg border border-[var(--op-border)] bg-[var(--op-inset)] px-3 py-2 text-sm text-[var(--op-text)] placeholder:text-[var(--op-dim)] focus:border-[var(--op-border-strong)] focus:outline-none';
  const statCls = 'rounded-xl border border-[var(--op-border)] bg-[var(--op-panel)] p-4';

  return (
    <div className={`op min-h-full text-[var(--op-text)] ${embedded ? '' : 'bg-[var(--op-bg)]'}`}>
      <div className={embedded ? 'space-y-4' : 'mx-auto max-w-[1400px] space-y-5 px-4 py-5 sm:px-6 lg:px-8'}>
        <div className="flex flex-col gap-4 border-b border-[var(--op-border)] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--op-dim)]">Finance</p>
            <h1 className="op-serif mt-1 text-3xl text-[var(--op-text)]">Financial accounts</h1>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--op-accent)] px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[#05221a] transition-opacity hover:opacity-90 disabled:opacity-50"
            disabled={saving}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add account
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className={statCls}>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--op-dim)]">Total assets</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--op-accent)]">{formatINR(totals.assets)}</p>
          </div>
          <div className={statCls}>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--op-dim)]">Liabilities</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-rose-300">{formatINR(totals.liabilities)}</p>
          </div>
          <div className={statCls}>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--op-dim)]">Net financial assets</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--op-text)]">{formatINR(totals.netAssets)}</p>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        {notice && (
          <div className="rounded-xl border border-[var(--op-accent)]/20 bg-[var(--op-accent-dim)] px-4 py-3 text-sm text-[var(--op-accent)]">
            {notice}
          </div>
        )}

        {loading ? (
          <div className="rounded-xl border border-[var(--op-border)] bg-[var(--op-panel)] p-8 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--op-muted)]">
            Loading accounts...
          </div>
        ) : accounts.length === 0 ? (
          <div className="rounded-xl border border-[var(--op-border)] bg-[var(--op-panel)] p-8 text-center">
            <p className="text-sm text-[var(--op-muted)]">No financial accounts yet.</p>
            <button onClick={openCreate} className="mt-4 rounded-lg border border-[var(--op-border-strong)] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--op-text)] hover:bg-white/[0.04]">
              Add first account
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {grouped.map((group) => {
              const groupTotal = group.accounts.reduce((sum, account) => sum + (account.kind === 'liability' ? -account.balance : account.balance), 0);
              return (
                <section key={group.type} className="rounded-xl border border-[var(--op-border)] bg-[var(--op-panel)]">
                  <div className="flex flex-col gap-2 border-b border-[var(--op-border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.16em] ${accountTypeTone(group.type)}`}>
                        {ACCOUNT_TYPE_LABELS[group.type]}
                      </span>
                      <span className="font-mono text-[10px] text-[var(--op-dim)]">{group.accounts.length} account{group.accounts.length === 1 ? '' : 's'}</span>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-[var(--op-text)]">{formatINR(groupTotal)}</span>
                  </div>
                  <div className="grid grid-cols-1 divide-y divide-[var(--op-border)] lg:grid-cols-2 lg:divide-x lg:divide-y-0">
                    {group.accounts.map((account) => (
                      <article key={account.id} className="group flex flex-col gap-4 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h2 className="truncate text-base font-semibold text-[var(--op-text)]">{account.name}</h2>
                            <p className="mt-1 text-xs text-[var(--op-muted)]">
                              {account.institution || ACCOUNT_TYPE_LABELS[account.accountType]}
                              {account.metadata.accountNumberLast4 ? ` · ending ${account.metadata.accountNumberLast4}` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                            <button onClick={() => openEdit(account)} className="rounded-md p-2 text-[var(--op-dim)] hover:bg-white/[0.04] hover:text-[var(--op-text)]" title="Edit account">
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                              </svg>
                            </button>
                            <button onClick={() => deleteAccount(account)} className="rounded-md p-2 text-[var(--op-dim)] hover:bg-white/[0.04] hover:text-rose-300" title="Remove account">
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673A2.25 2.25 0 0 1 15.916 21H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        <div className="flex items-end justify-between gap-3">
                          <div>
                            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--op-dim)]">Current value</p>
                            <p className={`mt-1 text-2xl font-semibold tabular-nums ${account.kind === 'liability' ? 'text-rose-300' : 'text-[var(--op-text)]'}`}>
                              {formatINR(account.balance)}
                            </p>
                          </div>
                          <p className="text-right font-mono text-[10px] text-[var(--op-dim)]">Updated<br />{formatTimestamp(account.lastUpdatedAt)}</p>
                        </div>
                        {account.metadata.notes && (
                          <p className="rounded-lg bg-[var(--op-inset)] px-3 py-2 text-xs text-[var(--op-muted)]">{account.metadata.notes}</p>
                        )}
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-xl border border-[var(--op-border-strong)] bg-[var(--op-panel-solid)] p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <h2 className="op-serif text-xl text-[var(--op-text)]">{editing ? 'Edit account' : 'Add account'}</h2>
              <button onClick={closeEditor} className="rounded-md p-2 text-[var(--op-muted)] hover:bg-white/[0.04] hover:text-[var(--op-text)]">
                <svg className="h-4 w-4" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="space-y-1.5 sm:col-span-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--op-dim)]">Account name</span>
                <input autoFocus value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} className={inputCls} placeholder="HDFC Bank Savings" />
              </label>
              <label className="space-y-1.5">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--op-dim)]">Type</span>
                <select value={draft.accountType} onChange={(e) => setDraft((d) => ({ ...d, accountType: e.target.value as AccountType }))} className={inputCls}>
                  {ACCOUNT_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--op-dim)]">Asset class</span>
                <select value={draft.kind} onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value as AccountKind }))} className={inputCls}>
                  <option value="asset">Asset</option>
                  <option value="liability">Liability</option>
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--op-dim)]">Institution</span>
                <input value={draft.institution} onChange={(e) => setDraft((d) => ({ ...d, institution: e.target.value }))} className={inputCls} placeholder="HDFC Bank" />
              </label>
              <label className="space-y-1.5">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--op-dim)]">Balance / value</span>
                <input value={draft.balance} onChange={(e) => setDraft((d) => ({ ...d, balance: e.target.value.replace(/[^0-9.,-]/g, '') }))} inputMode="decimal" className={inputCls} placeholder="0" />
              </label>
              <label className="space-y-1.5">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--op-dim)]">Last 4</span>
                <input value={draft.accountNumberLast4} onChange={(e) => setDraft((d) => ({ ...d, accountNumberLast4: e.target.value.replace(/\D/g, '').slice(0, 4) }))} inputMode="numeric" className={inputCls} placeholder="Optional" />
              </label>
              <label className="space-y-1.5 sm:col-span-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--op-dim)]">Notes</span>
                <textarea value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} rows={3} className={`${inputCls} resize-none`} placeholder="Optional metadata for future analytics" />
              </label>
            </div>

            {formError && (
              <div className="mt-4 rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">
                {formError}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={closeEditor} className="rounded-md px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-[var(--op-muted)] hover:text-[var(--op-text)]">Cancel</button>
              <button onClick={saveAccount} disabled={saving || !draft.name.trim()} className="rounded-md bg-[var(--op-accent)] px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-[#05221a] hover:opacity-90 disabled:opacity-40">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
