-- ============================================================================
-- finance_accounts — richer account model for the Finance dashboard.
-- Adds explicit account categories and metadata while preserving the older
-- `type` column for backward compatibility.
-- ============================================================================

create table if not exists public.accounts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name            text not null,
  type            text,
  account_type    text not null default 'other',
  kind            text not null default 'asset',
  balance         numeric not null default 0,
  institution     text,
  metadata        jsonb not null default '{}'::jsonb,
  sort_order      integer not null default 0,
  last_updated_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.accounts add column if not exists account_type text not null default 'other';
alter table public.accounts add column if not exists institution text;
alter table public.accounts add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.accounts add column if not exists last_updated_at timestamptz;

update public.accounts
set account_type = case
  when kind = 'liability' then 'liability'
  when lower(coalesce(type, '') || ' ' || name) like '%ppf%' then 'ppf'
  when lower(coalesce(type, '') || ' ' || name) like '%provident%' then 'ppf'
  when lower(coalesce(type, '') || ' ' || name) like '%invest%' then 'investment'
  when lower(coalesce(type, '') || ' ' || name) like '%broker%' then 'investment'
  when lower(coalesce(type, '') || ' ' || name) like '%groww%' then 'investment'
  when lower(coalesce(type, '') || ' ' || name) like '%feedaally%' then 'investment'
  when lower(coalesce(type, '') || ' ' || name) like '%saving%' then 'bank'
  when lower(coalesce(type, '') || ' ' || name) like '%bank%' then 'bank'
  when lower(coalesce(type, '') || ' ' || name) like '%hdfc%' then 'bank'
  when lower(coalesce(type, '') || ' ' || name) like '%icici%' then 'bank'
  else account_type
end
where account_type = 'other' or account_type is null;

update public.accounts
set type = account_type
where type is null or type in ('Savings', 'Provident Fund', 'Investment', 'Broker');

update public.accounts
set last_updated_at = coalesce(updated_at, created_at, now())
where last_updated_at is null;

do $$ begin
  alter table public.accounts
    add constraint accounts_account_type_check
    check (account_type in ('bank','investment','ppf','cash','liability','other'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.accounts
    add constraint accounts_kind_check
    check (kind in ('asset', 'liability'));
exception when duplicate_object then null; end $$;

create index if not exists accounts_user_idx on public.accounts (user_id, sort_order);
create index if not exists accounts_user_type_idx on public.accounts (user_id, account_type, sort_order);

do $$ begin
  create trigger accounts_set_updated_at before update on public.accounts
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

alter table public.accounts enable row level security;

do $$ begin
  create policy accounts_owner on public.accounts
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
