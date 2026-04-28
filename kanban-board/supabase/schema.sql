-- Kanban Board Database Schema for Supabase

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create columns table
create table if not exists columns (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  color text not null default '#6b7280',
  "order" integer not null default 0,
  created_at timestamptz not null default now()
);

-- Create tasks table
create table if not exists tasks (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  column_id uuid not null references columns(id) on delete cascade,
  "order" integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create indexes for better query performance
create index if not exists idx_tasks_column_id on tasks(column_id);
create index if not exists idx_tasks_order on tasks(column_id, "order");
create index if not exists idx_columns_order on columns("order");

-- Enable Row Level Security (RLS)
alter table columns enable row level security;
alter table tasks enable row level security;

-- Create policies for public access (for development)
-- In production, you should modify these to use proper authentication
create policy "Allow public read access to columns"
  on columns for select
  to public
  using (true);

create policy "Allow public insert access to columns"
  on columns for insert
  to public
  with check (true);

create policy "Allow public update access to columns"
  on columns for update
  to public
  using (true);

create policy "Allow public delete access to columns"
  on columns for delete
  to public
  using (true);

create policy "Allow public read access to tasks"
  on tasks for select
  to public
  using (true);

create policy "Allow public insert access to tasks"
  on tasks for insert
  to public
  with check (true);

create policy "Allow public update access to tasks"
  on tasks for update
  to public
  using (true);

create policy "Allow public delete access to tasks"
  on tasks for delete
  to public
  using (true);

-- Create function to automatically update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language 'plpgsql';

-- Create trigger for tasks updated_at
drop trigger if exists update_tasks_updated_at on tasks;
create trigger update_tasks_updated_at
  before update on tasks
  for each row
  execute function update_updated_at_column();

-- Insert default columns
insert into columns (name, color, "order") values
  ('Backlog', '#6b7280', 0),
  ('To Do', '#3b82f6', 1),
  ('In Progress', '#f59e0b', 2),
  ('Done', '#22c55e', 3)
on conflict do nothing;
