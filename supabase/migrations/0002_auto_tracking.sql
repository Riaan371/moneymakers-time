-- MoneyMakers Time — automatic tracking
-- Adds tracking_rules (window title -> client/category mapping) and
-- captured_segments (raw activity from the desktop agent, awaiting review).
-- Approved segments become normal time_entries with source = 'import',
-- so the retainer dashboard needs zero changes.

-- ============================================================
-- Tracking rules — admin-managed, matched against window titles
-- ============================================================
create table public.tracking_rules (
  id uuid primary key default gen_random_uuid(),
  pattern text not null, -- substring to match, case-insensitive, against window title
  client_id uuid not null references public.clients (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  priority int not null default 0, -- higher wins when multiple rules match
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index tracking_rules_active_idx on public.tracking_rules (active, priority desc);

alter table public.tracking_rules enable row level security;
create policy "rules readable by authenticated"
  on public.tracking_rules for select to authenticated using (true);
create policy "rules managed by admin"
  on public.tracking_rules for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- Captured segments — raw output from the desktop agent
-- ============================================================
create table public.captured_segments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  window_title text not null,
  app_name text, -- e.g. chrome.exe, EXCEL.EXE
  started_at timestamptz not null,
  ended_at timestamptz not null,
  matched_rule_id uuid references public.tracking_rules (id) on delete set null,
  client_id uuid references public.clients (id) on delete set null, -- pre-filled from rule, editable in review
  category_id uuid references public.categories (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'ignored')),
  resulting_entry_id uuid references public.time_entries (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ended_at > started_at)
);

create index captured_segments_user_status_idx
  on public.captured_segments (user_id, status, started_at desc);

alter table public.captured_segments enable row level security;
create policy "segments readable by owner or admin"
  on public.captured_segments for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "segments inserted by owner"
  on public.captured_segments for insert to authenticated
  with check (user_id = auth.uid());
create policy "segments updated by owner or admin"
  on public.captured_segments for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
create policy "segments deleted by owner or admin"
  on public.captured_segments for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ============================================================
-- Auto-match: when a segment is inserted, try to assign a rule
-- (agent can also just insert raw titles and let this do the matching)
-- ============================================================
create or replace function public.match_tracking_rule()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  r record;
begin
  if new.matched_rule_id is null then
    select id, client_id, category_id into r
    from public.tracking_rules
    where active
      and new.window_title ilike '%' || pattern || '%'
    order by priority desc, length(pattern) desc
    limit 1;

    if found then
      new.matched_rule_id := r.id;
      new.client_id := coalesce(new.client_id, r.client_id);
      new.category_id := coalesce(new.category_id, r.category_id);
    end if;
  end if;
  return new;
end;
$$;

create trigger captured_segments_match_rule
  before insert on public.captured_segments
  for each row execute function public.match_tracking_rule();
