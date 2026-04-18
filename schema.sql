-- =============================================
-- MI REGISTRO — Schema SQL completo
-- Ejecutar en el SQL Editor de Supabase
-- =============================================

create extension if not exists "uuid-ossp";

-- =====================
-- PROFILES
-- =====================
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- =====================
-- ACCOUNTS (CUENTAS)
-- =====================
create table if not exists public.accounts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  emoji text default '💰' not null,
  color text default '#3b82f6' not null,
  description text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- =====================
-- CATEGORIES (CATEGORÍAS)
-- =====================
create table if not exists public.categories (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  icon text default '📁' not null,
  color text default '#6b7280' not null,
  type text check (type in ('income', 'expense', 'both')) default 'both' not null,
  created_at timestamptz default now() not null
);

-- =====================
-- TRANSACTIONS (MOVIMIENTOS)
-- =====================
create table if not exists public.transactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  account_id uuid references public.accounts(id) on delete cascade not null,
  category_id uuid references public.categories(id) on delete set null,
  title text not null,
  description text,
  amount decimal(12,2) not null,
  type text check (type in ('income', 'expense')) not null,
  date date default current_date not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- =====================
-- BUDGETS (PRESUPUESTOS)
-- =====================
create table if not exists public.budgets (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  account_id uuid references public.accounts(id) on delete cascade,
  category_id uuid references public.categories(id) on delete cascade,
  name text not null,
  amount decimal(12,2) not null,
  period_type text check (period_type in ('weekly', 'monthly', 'yearly', 'custom')) default 'monthly' not null,
  start_date date,
  end_date date,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- =====================
-- SAVINGS GOALS (METAS)
-- =====================
create table if not exists public.savings_goals (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  account_id uuid references public.accounts(id) on delete set null,
  name text not null,
  target_amount decimal(12,2) not null,
  current_amount decimal(12,2) default 0 not null,
  deadline date,
  emoji text default '🎯' not null,
  color text default '#10b981' not null,
  description text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- =====================
-- ROW LEVEL SECURITY
-- =====================

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.savings_goals enable row level security;

-- Profiles
create policy "profiles_select" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- Accounts
create policy "accounts_all" on public.accounts for all using (auth.uid() = user_id);

-- Categories
create policy "categories_all" on public.categories for all using (auth.uid() = user_id);

-- Transactions
create policy "transactions_all" on public.transactions for all using (auth.uid() = user_id);

-- Budgets
create policy "budgets_all" on public.budgets for all using (auth.uid() = user_id);

-- Savings goals
create policy "savings_goals_all" on public.savings_goals for all using (auth.uid() = user_id);

-- =====================
-- TRIGGERS
-- =====================

-- Auto-crear perfil al registrarse
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Actualizar updated_at automáticamente
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_accounts_updated_at
  before update on public.accounts
  for each row execute procedure public.update_updated_at_column();

create trigger update_transactions_updated_at
  before update on public.transactions
  for each row execute procedure public.update_updated_at_column();

create trigger update_budgets_updated_at
  before update on public.budgets
  for each row execute procedure public.update_updated_at_column();

create trigger update_savings_goals_updated_at
  before update on public.savings_goals
  for each row execute procedure public.update_updated_at_column();

-- =====================
-- REALTIME
-- =====================
alter publication supabase_realtime add table public.accounts;
alter publication supabase_realtime add table public.categories;
alter publication supabase_realtime add table public.transactions;
alter publication supabase_realtime add table public.budgets;
alter publication supabase_realtime add table public.savings_goals;
