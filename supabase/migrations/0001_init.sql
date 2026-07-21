-- MoneyMakers Time — initial schema
-- Practice time tracking + retainer reconciliation for a payroll/bookkeeping firm.

-- ============================================================
-- Roles / auth helpers (same pattern as other Sparkbit apps)
-- ============================================================
create table public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'staff' check (role in ('admin', 'staff')),
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

create policy "roles readable by authenticated"
  on public.user_roles for select to authenticated using (true);
create policy "roles managed by admin"
  on public.user_roles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- Practice settings (single row)
-- ============================================================
create table public.settings (
  id boolean primary key default true check (id), -- enforce single row
  practice_name text not null default 'Money Makers',
  currency text not null default 'ZAR',
  default_hourly_rate numeric(10,2) not null default 0
);
insert into public.settings (id) values (true);

alter table public.settings enable row level security;
create policy "settings readable by authenticated"
  on public.settings for select to authenticated using (true);
create policy "settings managed by admin"
  on public.settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- Clients
-- ============================================================
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  contact_email text,
  billing_type text not null default 'retainer' check (billing_type in ('retainer', 'hourly')),
  hourly_rate numeric(10,2), -- null = use settings.default_hourly_rate
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.clients enable row level security;
create policy "clients readable by authenticated"
  on public.clients for select to authenticated using (true);
create policy "clients managed by admin"
  on public.clients for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- Retainer terms (effective-dated so fee changes keep history)
-- ============================================================
create table public.retainer_terms (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  monthly_fee numeric(10,2) not null,
  included_hours numeric(6,2), -- null = fee is "all inclusive", judge by effective rate instead
  effective_from date not null,
  effective_to date, -- null = current
  created_at timestamptz not null default now()
);

create index retainer_terms_client_idx on public.retainer_terms (client_id, effective_from desc);

alter table public.retainer_terms enable row level security;
create policy "retainers readable by authenticated"
  on public.retainer_terms for select to authenticated using (true);
create policy "retainers managed by admin"
  on public.retainer_terms for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- Work categories (seeded for a payroll practice)
-- ============================================================
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  billable_default boolean not null default true,
  sort int not null default 0
);

insert into public.categories (name, billable_default, sort) values
  ('Payroll processing', true, 1),
  ('Xero', true, 2),
  ('Documents (Word/Excel)', true, 3),
  ('Email & correspondence', true, 4),
  ('Meetings & calls', true, 5),
  ('SARS / statutory submissions', true, 6),
  ('Internal admin', false, 7);

alter table public.categories enable row level security;
create policy "categories readable by authenticated"
  on public.categories for select to authenticated using (true);
create policy "categories managed by admin"
  on public.categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- Time entries (a running timer is an entry with ended_at IS NULL)
-- ============================================================
create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  description text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  billable boolean not null default true,
  source text not null default 'timer' check (source in ('timer', 'manual', 'import')),
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at > started_at)
);

create index time_entries_client_idx on public.time_entries (client_id, started_at desc);
create index time_entries_user_idx on public.time_entries (user_id, started_at desc);
-- one running timer per user
create unique index time_entries_one_running_per_user
  on public.time_entries (user_id) where (ended_at is null);

alter table public.time_entries enable row level security;
create policy "entries readable by authenticated"
  on public.time_entries for select to authenticated using (true);
create policy "entries insert own"
  on public.time_entries for insert to authenticated
  with check (user_id = auth.uid());
create policy "entries update own or admin"
  on public.time_entries for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
create policy "entries delete own or admin"
  on public.time_entries for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ============================================================
-- Invoices actually raised (manual log now, Xero sync later)
-- ============================================================
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  period_month date not null, -- first day of the month the invoice covers
  amount_excl numeric(10,2) not null,
  xero_invoice_number text,
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid')),
  notes text,
  created_at timestamptz not null default now(),
  unique (client_id, period_month, xero_invoice_number)
);

create index invoices_client_idx on public.invoices (client_id, period_month desc);

alter table public.invoices enable row level security;
create policy "invoices readable by authenticated"
  on public.invoices for select to authenticated using (true);
create policy "invoices managed by admin"
  on public.invoices for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- Reconciliation view: per client per month —
-- hours tracked, value at rate, retainer fee, what was invoiced,
-- and the effective hourly rate the retainer works out to.
-- ============================================================
create or replace view public.monthly_client_summary
with (security_invoker = true) as
with entry_months as (
  select
    te.client_id,
    date_trunc('month', te.started_at)::date as month,
    sum(extract(epoch from (coalesce(te.ended_at, now()) - te.started_at)) / 60.0) as total_minutes,
    sum(
      case when te.billable
        then extract(epoch from (coalesce(te.ended_at, now()) - te.started_at)) / 60.0
        else 0 end
    ) as billable_minutes
  from public.time_entries te
  group by te.client_id, date_trunc('month', te.started_at)::date
),
invoice_months as (
  select client_id, period_month as month, sum(amount_excl) as invoiced_amount
  from public.invoices
  group by client_id, period_month
)
select
  c.id as client_id,
  c.name as client_name,
  c.billing_type,
  m.month,
  round(coalesce(em.total_minutes, 0) / 60.0, 2) as total_hours,
  round(coalesce(em.billable_minutes, 0) / 60.0, 2) as billable_hours,
  coalesce(c.hourly_rate, s.default_hourly_rate) as hourly_rate,
  round(coalesce(em.billable_minutes, 0) / 60.0 * coalesce(c.hourly_rate, s.default_hourly_rate), 2) as value_at_rate,
  rt.monthly_fee as retainer_fee,
  rt.included_hours as retainer_included_hours,
  case
    when coalesce(em.billable_minutes, 0) > 0 and rt.monthly_fee is not null
    then round(rt.monthly_fee / (em.billable_minutes / 60.0), 2)
  end as effective_hourly_rate,
  im.invoiced_amount,
  case
    when c.billing_type = 'retainer' and rt.monthly_fee is not null
    then round(rt.monthly_fee - coalesce(em.billable_minutes, 0) / 60.0 * coalesce(c.hourly_rate, s.default_hourly_rate), 2)
    when c.billing_type = 'hourly'
    then round(coalesce(im.invoiced_amount, 0) - coalesce(em.billable_minutes, 0) / 60.0 * coalesce(c.hourly_rate, s.default_hourly_rate), 2)
  end as variance -- positive = billed above time value, negative = under-recovering
from (
  select client_id, month from entry_months
  union
  select client_id, month from invoice_months
) m
join public.clients c on c.id = m.client_id
cross join public.settings s
left join entry_months em on em.client_id = m.client_id and em.month = m.month
left join invoice_months im on im.client_id = m.client_id and im.month = m.month
left join public.retainer_terms rt
  on rt.client_id = m.client_id
  and rt.effective_from <= m.month
  and (rt.effective_to is null or rt.effective_to >= m.month);
