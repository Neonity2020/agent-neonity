-- =====================================================
-- Kanban Board Schema (No Members)
-- =====================================================

create extension if not exists "uuid-ossp";

-- =====================================================
-- Tables
-- =====================================================

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table boards (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table columns (
  id uuid primary key default uuid_generate_v4(),
  board_id uuid not null references boards(id) on delete cascade,
  name text not null,
  color text not null default '#6b7280',
  "order" integer not null default 0,
  created_at timestamptz not null default now()
);

create table tasks (
  id uuid primary key default uuid_generate_v4(),
  board_id uuid not null references boards(id) on delete cascade,
  column_id uuid not null references columns(id) on delete cascade,
  title text not null,
  description text,
  "order" integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================
-- Indexes
-- =====================================================
create index idx_boards_owner on boards(owner_id);
create index idx_columns_board on columns(board_id);
create index idx_tasks_board on tasks(board_id);
create index idx_tasks_column on tasks(column_id);

-- =====================================================
-- RLS Helper Function
-- =====================================================
create or replace function public.is_board_owner(board_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.boards
    where id = board_uuid and owner_id = auth.uid()
  );
$$;

-- =====================================================
-- Enable RLS
-- =====================================================
alter table profiles enable row level security;
alter table boards enable row level security;
alter table columns enable row level security;
alter table tasks enable row level security;

-- =====================================================
-- RLS Policies
-- =====================================================

-- PROFILES
create policy "p_sel" on profiles for select to authenticated using (true);
create policy "p_ins" on profiles for insert to authenticated with check (auth.uid() = id);
create policy "p_upd" on profiles for update to authenticated using (auth.uid() = id);

-- BOARDS (simple owner-based access)
create policy "b_sel" on boards for select to authenticated
  using (owner_id = auth.uid());
create policy "b_ins" on boards for insert to authenticated
  with check (owner_id = auth.uid());
create policy "b_upd" on boards for update to authenticated
  using (owner_id = auth.uid());
create policy "b_del" on boards for delete to authenticated
  using (owner_id = auth.uid());

-- COLUMNS (owner of the board)
create policy "c_sel" on columns for select to authenticated
  using (public.is_board_owner(board_id));
create policy "c_ins" on columns for insert to authenticated
  with check (public.is_board_owner(board_id));
create policy "c_upd" on columns for update to authenticated
  using (public.is_board_owner(board_id));
create policy "c_del" on columns for delete to authenticated
  using (public.is_board_owner(board_id));

-- TASKS (owner of the board)
create policy "t_sel" on tasks for select to authenticated
  using (public.is_board_owner(board_id));
create policy "t_ins" on tasks for insert to authenticated
  with check (public.is_board_owner(board_id));
create policy "t_upd" on tasks for update to authenticated
  using (public.is_board_owner(board_id));
create policy "t_del" on tasks for delete to authenticated
  using (public.is_board_owner(board_id));

-- =====================================================
-- Functions & Triggers
-- =====================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger update_boards_updated_at
  before update on boards
  for each row execute function public.update_updated_at_column();

create trigger update_tasks_updated_at
  before update on tasks
  for each row execute function public.update_updated_at_column();

create trigger update_profiles_updated_at
  before update on profiles
  for each row execute function public.update_updated_at_column();
