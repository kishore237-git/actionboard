create table if not exists public.actions (
	id text primary key,
	user_id uuid references auth.users(id) not null,
	title text not null default '',
	category text not null default 'work',
	importance integer not null default 2,
	urgency integer not null default 2,
	notes text not null default '',
	project text not null default '',
	hashtags text[] not null default '{}',
	due_date timestamptz,
	focus_date date,
	focus_rank integer,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	completed boolean not null default false,
	deleted_at timestamptz,
	icon text
);

alter table public.actions add column if not exists project text not null default '';
alter table public.actions add column if not exists hashtags text[] not null default '{}';
alter table public.actions add column if not exists focus_date date;
alter table public.actions add column if not exists focus_rank integer;

create index if not exists actions_updated_at_idx on public.actions (updated_at desc);
create index if not exists actions_category_idx on public.actions (category);
create index if not exists actions_project_idx on public.actions (project);
create index if not exists actions_completed_idx on public.actions (completed);
create index if not exists actions_user_id_idx on public.actions (user_id);
create index if not exists actions_focus_plan_idx on public.actions (user_id, focus_date, focus_rank) where focus_date is not null;

alter table public.actions enable row level security;

-- deny anonymous access completely
revoke all on table public.actions from anon;

grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.actions to authenticated;

drop policy if exists "Users can view their own actions" on public.actions;
drop policy if exists "Users can insert their own actions" on public.actions;
drop policy if exists "Users can update their own actions" on public.actions;
drop policy if exists "Users can delete their own actions" on public.actions;

create policy "Users can view their own actions"
	on public.actions for select
	using (auth.uid() = user_id);

create policy "Users can insert their own actions"
	on public.actions for insert
	with check (auth.uid() = user_id);

create policy "Users can update their own actions"
	on public.actions for update
	using (auth.uid() = user_id)
	with check (auth.uid() = user_id);

create policy "Users can delete their own actions"
	on public.actions for delete
	using (auth.uid() = user_id);