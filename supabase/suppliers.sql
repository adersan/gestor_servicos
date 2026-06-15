create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  document text,
  notes text,
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists one_default_supplier_idx
  on public.suppliers ((is_default))
  where is_default and active;

create table if not exists public.supplier_services (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  code text,
  name text not null,
  default_cost numeric(12,2) not null default 0 check (default_cost >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists supplier_service_code_idx
  on public.supplier_services(supplier_id, code)
  where code is not null and active;

create table if not exists public.supplier_payables (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id),
  period_start date not null,
  period_end date not null,
  total_due numeric(12,2) not null default 0 check (total_due >= 0),
  status text not null default 'Aberta'
    check (status in ('Aberta', 'Parcial', 'Paga', 'Cancelada')),
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create table if not exists public.supplier_entries (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id),
  supplier_service_id uuid references public.supplier_services(id),
  client_id uuid references public.clients(id),
  client_service_entry_id uuid references public.service_entries(id) on delete set null,
  payable_id uuid references public.supplier_payables(id) on delete set null,
  service_date date not null,
  service_name text not null,
  reference text,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  status text not null default 'A fazer'
    check (status in ('A fazer', 'Feito', 'Cancelado')),
  source text not null default 'Direto'
    check (source in ('Cliente', 'Direto', 'Fornecedor')),
  notes text,
  last_changed_by text check (last_changed_by is null or last_changed_by in ('Administrador', 'Fornecedor')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists supplier_entries_supplier_date_idx
  on public.supplier_entries(supplier_id, service_date desc);
create index if not exists supplier_entries_payable_idx
  on public.supplier_entries(payable_id);

create table if not exists public.supplier_payments (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id),
  payable_id uuid references public.supplier_payables(id) on delete set null,
  payment_date date not null,
  amount numeric(12,2) not null check (amount > 0),
  method text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists supplier_payments_payable_idx
  on public.supplier_payments(payable_id);

create table if not exists public.supplier_portal_links (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  token_hash text not null unique,
  period_start date not null,
  period_end date not null,
  can_edit boolean not null default false,
  can_mark_done boolean not null default false,
  can_cancel boolean not null default false,
  show_linked_notes boolean not null default false,
  active boolean not null default true,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_access_at timestamptz,
  check (period_end >= period_start)
);

create index if not exists supplier_portal_supplier_period_idx
  on public.supplier_portal_links(supplier_id, period_start, period_end);

drop trigger if exists suppliers_updated_at on public.suppliers;
create trigger suppliers_updated_at before update on public.suppliers
for each row execute function public.set_updated_at();
drop trigger if exists supplier_services_updated_at on public.supplier_services;
create trigger supplier_services_updated_at before update on public.supplier_services
for each row execute function public.set_updated_at();
drop trigger if exists supplier_entries_updated_at on public.supplier_entries;
create trigger supplier_entries_updated_at before update on public.supplier_entries
for each row execute function public.set_updated_at();
drop trigger if exists supplier_payables_updated_at on public.supplier_payables;
create trigger supplier_payables_updated_at before update on public.supplier_payables
for each row execute function public.set_updated_at();
drop trigger if exists supplier_payments_updated_at on public.supplier_payments;
create trigger supplier_payments_updated_at before update on public.supplier_payments
for each row execute function public.set_updated_at();

alter table public.suppliers enable row level security;
alter table public.supplier_services enable row level security;
alter table public.supplier_entries enable row level security;
alter table public.supplier_payables enable row level security;
alter table public.supplier_payments enable row level security;
alter table public.supplier_portal_links enable row level security;

grant select, insert, update, delete on table public.suppliers to authenticated;
grant select, insert, update, delete on table public.supplier_services to authenticated;
grant select, insert, update, delete on table public.supplier_entries to authenticated;
grant select, insert, update, delete on table public.supplier_payables to authenticated;
grant select, insert, update, delete on table public.supplier_payments to authenticated;
grant select, insert, update, delete on table public.supplier_portal_links to authenticated;
grant all privileges on table public.suppliers to service_role;
grant all privileges on table public.supplier_services to service_role;
grant all privileges on table public.supplier_entries to service_role;
grant all privileges on table public.supplier_payables to service_role;
grant all privileges on table public.supplier_payments to service_role;
grant all privileges on table public.supplier_portal_links to service_role;

drop policy if exists "suppliers_admin_all" on public.suppliers;
drop policy if exists "supplier_services_admin_all" on public.supplier_services;
drop policy if exists "supplier_entries_admin_all" on public.supplier_entries;
drop policy if exists "supplier_payables_admin_all" on public.supplier_payables;
drop policy if exists "supplier_payments_admin_all" on public.supplier_payments;
drop policy if exists "supplier_portal_links_admin_all" on public.supplier_portal_links;

create policy "suppliers_admin_all" on public.suppliers
for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "supplier_services_admin_all" on public.supplier_services
for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "supplier_entries_admin_all" on public.supplier_entries
for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "supplier_payables_admin_all" on public.supplier_payables
for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "supplier_payments_admin_all" on public.supplier_payments
for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "supplier_portal_links_admin_all" on public.supplier_portal_links
for all to authenticated using (public.is_admin()) with check (public.is_admin());
