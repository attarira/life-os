import { isSupabaseConfigured, getSupabase } from '../supabase/client';
import { storage, generateId } from '../utils';

export type AccountKind = 'asset' | 'liability';
export type AccountType = 'bank' | 'investment' | 'ppf' | 'cash' | 'liability' | 'other';

export type AccountMetadata = {
  accountNumberLast4?: string;
  notes?: string;
};

export type Account = {
  id: string;
  name: string;
  accountType: AccountType;
  kind: AccountKind;
  balance: number;
  institution?: string;
  metadata: AccountMetadata;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
  lastUpdatedAt?: string;
};

export type AccountInput = {
  name: string;
  accountType: AccountType;
  kind: AccountKind;
  balance: number;
  institution?: string;
  metadata?: AccountMetadata;
  sortOrder?: number;
};

const LOCAL_KEY = 'lifeos:accounts:v2';
const LEGACY_LOCAL_KEY = 'lifeos:accounts:v1';
const RICH_SELECT = 'id, name, type, account_type, kind, balance, institution, metadata, sort_order, created_at, updated_at, last_updated_at';
const LEGACY_SELECT = 'id, name, type, kind, balance, sort_order, created_at, updated_at';

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  bank: 'Bank Accounts',
  investment: 'Investments',
  ppf: 'PPF',
  cash: 'Cash',
  liability: 'Liabilities',
  other: 'Other Accounts',
};

export const ACCOUNT_TYPE_ORDER: AccountType[] = ['bank', 'investment', 'ppf', 'cash', 'liability', 'other'];

export const DEFAULT_ACCOUNTS: AccountInput[] = [
  { name: 'HDFC Bank Savings', institution: 'HDFC Bank', accountType: 'bank', kind: 'asset', balance: 0, sortOrder: 0 },
  { name: 'ICICI Bank Savings', institution: 'ICICI Bank', accountType: 'bank', kind: 'asset', balance: 0, sortOrder: 1 },
  { name: 'Feedaally Investments', institution: 'Feedaally', accountType: 'investment', kind: 'asset', balance: 0, sortOrder: 2 },
  { name: 'Groww Investments', institution: 'Groww', accountType: 'investment', kind: 'asset', balance: 0, sortOrder: 3 },
  { name: 'HDFC PPF', institution: 'HDFC Bank', accountType: 'ppf', kind: 'asset', balance: 0, sortOrder: 4 },
];

type LegacyAccount = {
  id: string;
  name: string;
  type?: string;
  kind: AccountKind;
  balance: number;
};

type AccountRow = {
  id: string;
  name: string;
  type?: string | null;
  account_type?: AccountType | null;
  kind: AccountKind;
  balance: number;
  institution?: string | null;
  metadata?: AccountMetadata | null;
  sort_order?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  last_updated_at?: string | null;
};

function inferAccountType(account: { type?: string | null; kind: AccountKind; name: string }): AccountType {
  const text = `${account.type ?? ''} ${account.name}`.toLowerCase();
  if (account.kind === 'liability') return 'liability';
  if (text.includes('ppf') || text.includes('provident')) return 'ppf';
  if (text.includes('invest') || text.includes('broker') || text.includes('groww') || text.includes('feedaally')) return 'investment';
  if (text.includes('saving') || text.includes('bank') || text.includes('hdfc') || text.includes('icici')) return 'bank';
  return 'other';
}

function normalizeMetadata(metadata?: AccountMetadata | null): AccountMetadata {
  return {
    accountNumberLast4: metadata?.accountNumberLast4 || undefined,
    notes: metadata?.notes || undefined,
  };
}

function rowToAccount(r: AccountRow): Account {
  return {
    id: r.id,
    name: r.name,
    accountType: r.account_type ?? inferAccountType({ type: r.type, kind: r.kind, name: r.name }),
    kind: r.kind,
    balance: Number(r.balance),
    institution: r.institution ?? undefined,
    metadata: normalizeMetadata(r.metadata),
    sortOrder: r.sort_order ?? 0,
    createdAt: r.created_at ?? undefined,
    updatedAt: r.updated_at ?? undefined,
    lastUpdatedAt: r.last_updated_at ?? r.updated_at ?? undefined,
  };
}

function inputToRow(input: AccountInput): Record<string, unknown> {
  return {
    name: input.name,
    account_type: input.accountType,
    type: input.accountType,
    kind: input.kind,
    balance: input.balance,
    institution: input.institution ?? null,
    metadata: normalizeMetadata(input.metadata),
    sort_order: input.sortOrder ?? 0,
    last_updated_at: new Date().toISOString(),
  };
}

function inputToLegacyRow(input: AccountInput): Record<string, unknown> {
  return {
    name: input.name,
    type: input.accountType,
    kind: input.kind,
    balance: input.balance,
    sort_order: input.sortOrder ?? 0,
  };
}

function isSchemaColumnError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const maybeError = error as { code?: string; message?: string; details?: string; hint?: string };
  const text = `${maybeError.message ?? ''} ${maybeError.details ?? ''} ${maybeError.hint ?? ''}`.toLowerCase();
  return (
    maybeError.code === '42703' ||
    maybeError.code === 'PGRST204' ||
    text.includes('column') ||
    text.includes('schema cache')
  );
}

function isMissingAccountsTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const maybeError = error as { code?: string; message?: string; details?: string; hint?: string };
  const text = `${maybeError.message ?? ''} ${maybeError.details ?? ''} ${maybeError.hint ?? ''}`.toLowerCase();
  return (
    maybeError.code === '42P01' ||
    maybeError.code === 'PGRST205' ||
    text.includes('public.accounts') ||
    text.includes("table 'accounts'") ||
    text.includes('relation "accounts" does not exist')
  );
}

function createMissingAccountsTableError(): Error {
  return new Error('Finance accounts are not set up yet. Create the Supabase accounts table, then refresh this page.');
}

function sortAccounts(accounts: Account[]): Account[] {
  return [...accounts].sort((a, b) => {
    const typeDiff = ACCOUNT_TYPE_ORDER.indexOf(a.accountType) - ACCOUNT_TYPE_ORDER.indexOf(b.accountType);
    if (typeDiff !== 0) return typeDiff;
    return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
  });
}

function migrateLocalAccounts(): Account[] {
  const current = storage.get<Account[]>(LOCAL_KEY, []);
  if (current.length) return sortAccounts(current);

  const legacy = storage.get<LegacyAccount[]>(LEGACY_LOCAL_KEY, []);
  if (legacy.length) {
    const migrated = legacy.map((account, index) => ({
      id: account.id,
      name: account.name,
      accountType: inferAccountType(account),
      kind: account.kind,
      balance: account.balance,
      institution: undefined,
      metadata: {},
      sortOrder: index,
    }));
    storage.set(LOCAL_KEY, migrated);
    return sortAccounts(migrated);
  }

  const seeded = DEFAULT_ACCOUNTS.map((account, index) => ({
    id: generateId(),
    ...account,
    metadata: account.metadata ?? {},
    sortOrder: account.sortOrder ?? index,
  }));
  storage.set(LOCAL_KEY, seeded);
  return seeded;
}

export async function listAccounts(): Promise<Account[]> {
  if (!isSupabaseConfigured) return migrateLocalAccounts();

  const sb = getSupabase();
  const { data, error } = await sb
    .from('accounts')
    .select(RICH_SELECT)
    .order('sort_order', { ascending: true });
  if (error) {
    if (isMissingAccountsTableError(error)) throw createMissingAccountsTableError();
    if (!isSchemaColumnError(error)) throw error;
    const { data: legacyData, error: legacyError } = await sb
      .from('accounts')
      .select(LEGACY_SELECT)
      .order('sort_order', { ascending: true });
    if (legacyError) {
      if (isMissingAccountsTableError(legacyError)) throw createMissingAccountsTableError();
      throw legacyError;
    }
    const legacyRows = legacyData as AccountRow[];
    if (legacyRows.length > 0) return sortAccounts(legacyRows.map(rowToAccount));

    const legacyPayload = DEFAULT_ACCOUNTS.map((account, index) => inputToLegacyRow({ ...account, sortOrder: account.sortOrder ?? index }));
    const { data: legacyInserted, error: legacyInsertError } = await sb
      .from('accounts')
      .insert(legacyPayload)
      .select(LEGACY_SELECT);
    if (legacyInsertError) {
      if (isMissingAccountsTableError(legacyInsertError)) throw createMissingAccountsTableError();
      throw legacyInsertError;
    }
    return sortAccounts((legacyInserted as AccountRow[]).map(rowToAccount));
  }

  const rows = data as AccountRow[];
  if (rows.length > 0) return sortAccounts(rows.map(rowToAccount));

  const payload = DEFAULT_ACCOUNTS.map((account, index) => inputToRow({ ...account, sortOrder: account.sortOrder ?? index }));
  const { data: inserted, error: insertError } = await sb
    .from('accounts')
    .insert(payload)
    .select(RICH_SELECT);
  if (insertError) {
    if (isMissingAccountsTableError(insertError)) throw createMissingAccountsTableError();
    if (!isSchemaColumnError(insertError)) throw insertError;
    const legacyPayload = DEFAULT_ACCOUNTS.map((account, index) => inputToLegacyRow({ ...account, sortOrder: account.sortOrder ?? index }));
    const { data: legacyInserted, error: legacyInsertError } = await sb
      .from('accounts')
      .insert(legacyPayload)
      .select(LEGACY_SELECT);
    if (legacyInsertError) {
      if (isMissingAccountsTableError(legacyInsertError)) throw createMissingAccountsTableError();
      throw legacyInsertError;
    }
    return sortAccounts((legacyInserted as AccountRow[]).map(rowToAccount));
  }
  return sortAccounts((inserted as AccountRow[]).map(rowToAccount));
}

export async function addAccount(input: AccountInput, sortOrder = 0): Promise<Account> {
  const payload = { ...input, sortOrder: input.sortOrder ?? sortOrder };
  if (!isSupabaseConfigured) {
    const accounts = migrateLocalAccounts();
    const now = new Date().toISOString();
    const account: Account = {
      id: generateId(),
      ...payload,
      metadata: payload.metadata ?? {},
      sortOrder: payload.sortOrder ?? accounts.length,
      createdAt: now,
      updatedAt: now,
      lastUpdatedAt: now,
    };
    storage.set(LOCAL_KEY, sortAccounts([...accounts, account]));
    return account;
  }

  const { data, error } = await getSupabase()
    .from('accounts')
    .insert(inputToRow(payload))
    .select(RICH_SELECT)
    .single();
  if (error) {
    if (isMissingAccountsTableError(error)) throw createMissingAccountsTableError();
    if (!isSchemaColumnError(error)) throw error;
    const { data: legacyData, error: legacyError } = await getSupabase()
      .from('accounts')
      .insert(inputToLegacyRow(payload))
      .select(LEGACY_SELECT)
      .single();
    if (legacyError) {
      if (isMissingAccountsTableError(legacyError)) throw createMissingAccountsTableError();
      throw legacyError;
    }
    return rowToAccount(legacyData as AccountRow);
  }
  return rowToAccount(data as AccountRow);
}

export async function updateAccount(id: string, patch: Partial<AccountInput>): Promise<Account> {
  if (!isSupabaseConfigured) {
    const now = new Date().toISOString();
    const accounts = migrateLocalAccounts();
    let updated: Account | undefined;
    const next = accounts.map((account) => {
      if (account.id !== id) return account;
      updated = {
        ...account,
        ...patch,
        metadata: patch.metadata ? normalizeMetadata(patch.metadata) : account.metadata,
        sortOrder: patch.sortOrder ?? account.sortOrder,
        updatedAt: now,
        lastUpdatedAt: now,
      };
      return updated;
    });
    storage.set(LOCAL_KEY, sortAccounts(next));
    if (!updated) throw new Error('Account not found.');
    return updated;
  }

  const row: Record<string, unknown> = { last_updated_at: new Date().toISOString() };
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.accountType !== undefined) {
    row.account_type = patch.accountType;
    row.type = patch.accountType;
  }
  if (patch.kind !== undefined) row.kind = patch.kind;
  if (patch.balance !== undefined) row.balance = patch.balance;
  if (patch.institution !== undefined) row.institution = patch.institution || null;
  if (patch.metadata !== undefined) row.metadata = normalizeMetadata(patch.metadata);
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;

  const { data, error } = await getSupabase()
    .from('accounts')
    .update(row)
    .eq('id', id)
    .select(RICH_SELECT)
    .single();
  if (error) {
    if (isMissingAccountsTableError(error)) throw createMissingAccountsTableError();
    if (!isSchemaColumnError(error)) throw error;
    const legacyPatch: Record<string, unknown> = {};
    if (patch.name !== undefined) legacyPatch.name = patch.name;
    if (patch.accountType !== undefined) legacyPatch.type = patch.accountType;
    if (patch.kind !== undefined) legacyPatch.kind = patch.kind;
    if (patch.balance !== undefined) legacyPatch.balance = patch.balance;
    if (patch.sortOrder !== undefined) legacyPatch.sort_order = patch.sortOrder;
    const { data: legacyData, error: legacyError } = await getSupabase()
      .from('accounts')
      .update(legacyPatch)
      .eq('id', id)
      .select(LEGACY_SELECT)
      .single();
    if (legacyError) {
      if (isMissingAccountsTableError(legacyError)) throw createMissingAccountsTableError();
      throw legacyError;
    }
    return rowToAccount(legacyData as AccountRow);
  }
  return rowToAccount(data as AccountRow);
}

export async function removeAccount(id: string): Promise<void> {
  if (!isSupabaseConfigured) {
    const accounts = migrateLocalAccounts();
    storage.set(LOCAL_KEY, accounts.filter((a) => a.id !== id));
    return;
  }
  const { error } = await getSupabase().from('accounts').delete().eq('id', id);
  if (error) {
    if (isMissingAccountsTableError(error)) throw createMissingAccountsTableError();
    throw error;
  }
}
