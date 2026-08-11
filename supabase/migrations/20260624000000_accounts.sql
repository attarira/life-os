-- ============================================================================
-- accounts — in-app finance tracker (source of truth for net worth)
-- Each row is an account/holding; net worth = Σ assets − Σ liabilities, which
-- is snapshotted into net_worth_snapshots on change.
-- ============================================================================
create table if not exists public.accounts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  type       text,                                  -- legacy label; mirrors account_type for older clients
  account_type text not null default 'other'
             check (account_type in ('bank','investment','ppf','cash','liability','other')),
  kind       text not null default 'asset' check (kind in ('asset', 'liability')),
  balance    numeric not null default 0,            -- in the app's single currency (INR)
  institution text,
  metadata   jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  last_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists accounts_user_idx on public.accounts (user_id, sort_order);
create index if not exists accounts_user_type_idx on public.accounts (user_id, account_type, sort_order);

create trigger accounts_set_updated_at before update on public.accounts
  for each row execute function public.set_updated_at();

alter table public.accounts enable row level security;
create policy accounts_owner on public.accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
