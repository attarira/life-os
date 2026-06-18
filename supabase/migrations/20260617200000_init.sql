-- ============================================================================
-- LifeOS — initial Supabase schema
-- Replaces the IndexedDB (tasks, memory) + localStorage persistence layers.
--
-- Conventions
--   • Every user-owned table has `user_id uuid not null default auth.uid()`
--     referencing auth.users, with a single permissive RLS policy scoped to
--     the owner (auth.uid() = user_id).
--   • Timestamps are timestamptz; "dates" used for daily/period bucketing are
--     `date`.
--   • The TS field `order` is reserved in SQL → stored as `sort_order`.
--   • The app's ROOT_TASK_ID sentinel ('root') is preserved: tasks.parent_id is
--     text so top-level tasks can use parent_id = 'root' (no FK to a real row).
--
-- Apply with:  supabase db push      (or paste into the SQL editor)
-- ============================================================================

-- ── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists pgcrypto;   -- gen_random_uuid()
-- Optional: enable pgvector if you later want server-side memory similarity
-- search. If you enable it, switch memories.embedding to vector(N) (see below).
-- create extension if not exists vector;


-- ── Shared helpers ──────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ── Enums (mirror the TypeScript unions) ────────────────────────────────────
do $$ begin
  create type public.task_status as enum ('NOT_STARTED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.task_priority as enum ('LOW', 'MEDIUM', 'HIGH');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_type as enum ('DUE_TASK', 'DAILY_SUMMARY', 'WEEKLY_SUMMARY', 'SYSTEM');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.memory_type as enum ('preference', 'task_history', 'relationship', 'fact', 'system');
exception when duplicate_object then null; end $$;


-- ============================================================================
-- tasks  (was: kanban-tasks-db / TaskStore)
-- ============================================================================
create table if not exists public.tasks (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  parent_id      text not null default 'root',           -- 'root' = top-level life area
  title          text not null,
  description    text,
  status         public.task_status   not null default 'NOT_STARTED',
  priority       public.task_priority not null default 'MEDIUM',
  sort_order     integer not null default 0,             -- TS: order
  due_date       timestamptz,
  scheduled_date timestamptz,
  completed_at   timestamptz,
  calendar_only  boolean not null default false,
  tags           text[],
  frequency      text,
  recurrence     jsonb,                                  -- { rule, daysOfWeek? }
  is_leaf        boolean,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists tasks_user_parent_idx on public.tasks (user_id, parent_id, sort_order);
create index if not exists tasks_user_status_idx on public.tasks (user_id, status);
create index if not exists tasks_user_due_idx    on public.tasks (user_id, due_date);

create trigger tasks_set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

alter table public.tasks enable row level security;
create policy tasks_owner on public.tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ============================================================================
-- memories  (was: lifeos-memory-db / MemoryStore)
-- ============================================================================
create table if not exists public.memories (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  content          text not null,
  embedding        real[],                 -- TS: number[]  (see pgvector note)
  type             public.memory_type not null,
  importance       double precision not null default 0,   -- [0.0, 1.0]
  access_count     integer not null default 0,
  source_id        text,                                   -- task id / thread id
  last_accessed_at timestamptz not null default now(),     -- TS: lastAccessedAt
  created_at       timestamptz not null default now()      -- TS: timestamp
);

create index if not exists memories_user_type_idx on public.memories (user_id, type);
create index if not exists memories_user_access_idx on public.memories (user_id, last_accessed_at desc);

alter table public.memories enable row level security;
create policy memories_owner on public.memories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- pgvector upgrade (optional): if you enable the `vector` extension above and
-- know your embedding dimension (e.g. 384), replace the embedding column and add
-- an ANN index so similarity search can run in Postgres instead of in JS:
--   alter table public.memories alter column embedding type vector(384) using embedding::vector(384);
--   create index memories_embedding_idx on public.memories
--     using hnsw (embedding vector_cosine_ops);


-- ============================================================================
-- planner_entries  (was: planner-items / planner-date)
--   The daily reset becomes a filter on entry_date = current_date.
-- ============================================================================
create table if not exists public.planner_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entry_date  date not null default current_date,
  task_id     uuid references public.tasks(id) on delete cascade,  -- null for quick items
  label       text not null,
  completed   boolean not null default false,
  start_time  time,
  end_time    time,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists planner_user_date_idx on public.planner_entries (user_id, entry_date, sort_order);

create trigger planner_set_updated_at before update on public.planner_entries
  for each row execute function public.set_updated_at();

alter table public.planner_entries enable row level security;
create policy planner_owner on public.planner_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- planner_dismissals  (was: planner-dismissed)
--   Suppresses re-adding a recurring task for the rest of a given day.
create table if not exists public.planner_dismissals (
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  task_id      uuid not null references public.tasks(id) on delete cascade,
  dismiss_date date not null default current_date,
  primary key (user_id, task_id, dismiss_date)
);

alter table public.planner_dismissals enable row level security;
create policy planner_dismissals_owner on public.planner_dismissals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ============================================================================
-- habits + habit_logs  (was: habits-defs / habits-log)
-- ============================================================================
create table if not exists public.habits (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  category   text,
  target     text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists habits_user_idx on public.habits (user_id, sort_order);

create trigger habits_set_updated_at before update on public.habits
  for each row execute function public.set_updated_at();

alter table public.habits enable row level security;
create policy habits_owner on public.habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- One row per (habit, day) the habit was completed.
create table if not exists public.habit_logs (
  user_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  habit_id  uuid not null references public.habits(id) on delete cascade,
  log_date  date not null,
  completed boolean not null default true,
  primary key (habit_id, log_date)
);

create index if not exists habit_logs_user_date_idx on public.habit_logs (user_id, log_date);

alter table public.habit_logs enable row level security;
create policy habit_logs_owner on public.habit_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ============================================================================
-- goals  (was: goals)
--   period_key is the ISO week ('2026-W24') or month ('2026-06') bucket.
-- ============================================================================
create table if not exists public.goals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  period     text not null check (period in ('week', 'month')),
  period_key text not null,
  text       text not null,
  done       boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists goals_user_period_idx on public.goals (user_id, period, period_key, sort_order);

create trigger goals_set_updated_at before update on public.goals
  for each row execute function public.set_updated_at();

alter table public.goals enable row level security;
create policy goals_owner on public.goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ============================================================================
-- meals  (was: nutrition)
-- ============================================================================
create table if not exists public.meals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  meal_date  date not null default current_date,
  name       text not null,
  kcal       integer not null default 0,
  protein    integer not null default 0,
  carbs      integer not null default 0,
  fat        integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists meals_user_date_idx on public.meals (user_id, meal_date);

alter table public.meals enable row level security;
create policy meals_owner on public.meals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ============================================================================
-- net_worth_snapshots  (was: dashboard networth + KanbanBoard finance:netWorth)
--   Unified: net worth = assets - liabilities. The dashboard's simple single
--   value maps to assets = value, liabilities = 0. One snapshot per day.
-- ============================================================================
create table if not exists public.net_worth_snapshots (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  snapshot_date date not null,
  assets        numeric not null default 0,
  liabilities   numeric not null default 0,
  created_at    timestamptz not null default now(),
  unique (user_id, snapshot_date)
);

create index if not exists networth_user_date_idx on public.net_worth_snapshots (user_id, snapshot_date);

alter table public.net_worth_snapshots enable row level security;
create policy networth_owner on public.net_worth_snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ============================================================================
-- subscriptions  (was: finance:subscriptions)
-- ============================================================================
create table if not exists public.subscriptions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name           text not null,
  cost           numeric not null default 0,
  billing        text not null default 'monthly' check (billing in ('monthly', 'yearly')),
  active         boolean not null default true,
  category       text not null default 'other'
                   check (category in ('entertainment','utilities','productivity','health','other')),
  payment_method text,
  due_date       text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists subscriptions_user_idx on public.subscriptions (user_id);

create trigger subscriptions_set_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

alter table public.subscriptions enable row level security;
create policy subscriptions_owner on public.subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ============================================================================
-- birthdays  (was: birthdays)
-- ============================================================================
create table if not exists public.birthdays (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  month_day  text not null,            -- 'MM-DD'
  created_at timestamptz not null default now()
);

create index if not exists birthdays_user_idx on public.birthdays (user_id);

alter table public.birthdays enable row level security;
create policy birthdays_owner on public.birthdays
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ============================================================================
-- notifications  (was: notifications)
-- ============================================================================
create table if not exists public.notifications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title           text not null,
  message         text not null,
  type            public.notification_type not null,
  read            boolean not null default false,
  related_task_id uuid references public.tasks(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
create policy notifications_owner on public.notifications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ============================================================================
-- visited_regions  (was: life-os-visited-regions)
-- ============================================================================
create table if not exists public.visited_regions (
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  region_type text not null check (region_type in ('world', 'usa', 'india')),
  visited     text[] not null default '{}',
  current     text,
  updated_at  timestamptz not null default now(),
  primary key (user_id, region_type)
);

create trigger visited_regions_set_updated_at before update on public.visited_regions
  for each row execute function public.set_updated_at();

alter table public.visited_regions enable row level security;
create policy visited_regions_owner on public.visited_regions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ============================================================================
-- user_settings  (key → jsonb singletons)
--   Houses the small one-off slices so we don't need a table each:
--     'operator_profile'    -> { name, role, location, focus }
--     'currency'            -> "USD"
--     'travel_mode'         -> true/false
--     'bank_balances'       -> { hdfcSavings, hdfcPpf, fidaAliInvestments, growwInvestments }
--     'last_daily_summary'  -> "2026-06-17"
--     'last_weekly_summary' -> "2026-W24"
--     'notified_due_tasks'  -> ["taskId", ...]
--     'chat_history'        -> [ ...messages ]
--     'file_system'         -> [ ...notes nodes ]   (normalize into its own table later)
--     'assistant_debug'     -> true/false
-- ============================================================================
create table if not exists public.user_settings (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key        text not null,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

create trigger user_settings_set_updated_at before update on public.user_settings
  for each row execute function public.set_updated_at();

alter table public.user_settings enable row level security;
create policy user_settings_owner on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ============================================================================
-- Notes
--   • Auto-backups (lifeos:autoBackups / lastBackupDate) are intentionally NOT
--     migrated — Postgres is now the source of truth. Keep JSON export instead.
--   • The legacy 'lifeos:dashboard-pages:v1' key is superseded by file_system.
-- ============================================================================
