alter table public.actions add column if not exists focus_date date;
alter table public.actions add column if not exists focus_rank integer;

create index if not exists actions_focus_plan_idx
	on public.actions (user_id, focus_date, focus_rank)
	where focus_date is not null;
