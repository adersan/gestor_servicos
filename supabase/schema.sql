create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;

create table if not exists public.price_tables (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  price_table_id uuid references public.price_tables(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_prices (
  service_id uuid not null references public.service_catalog(id) on delete cascade,
  price_table_id uuid not null references public.price_tables(id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 0),
  updated_at timestamptz not null default now(),
  primary key (service_id, price_table_id)
);

create table if not exists public.service_entries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  service_id uuid references public.service_catalog(id),
  service_name text not null,
  reference text,
  service_date date not null default current_date,
  amount numeric(12,2) not null check (amount >= 0),
  status text not null default 'A fazer'
    check (status in ('A fazer', 'Pronto', 'Entregue', 'Cancelado')),
  billing_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  payment_date date not null default current_date,
  amount numeric(12,2) not null check (amount > 0),
  method text,
  notes text,
  billing_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  name text not null,
  details text,
  payment_link text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  period_start date not null,
  period_end date not null,
  previous_balance numeric(12,2) not null default 0,
  services_total numeric(12,2) not null default 0,
  payments_total numeric(12,2) not null default 0,
  discounts_total numeric(12,2) not null default 0,
  total_due numeric(12,2) not null,
  status text not null default 'Aberta'
    check (status in ('Aberta', 'Parcial', 'Paga', 'Cancelada')),
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'service_entries_billing_fk'
  ) then
    alter table public.service_entries
      add constraint service_entries_billing_fk
      foreign key (billing_id) references public.billings(id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'payments_billing_fk'
  ) then
    alter table public.payments
      add constraint payments_billing_fk
      foreign key (billing_id) references public.billings(id);
  end if;
end;
$$;

create table if not exists public.client_access_credentials (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  billing_id uuid not null references public.billings(id) on delete cascade,
  identifier_hash text not null,
  password_hash text not null,
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  last_access_at timestamptz
);

create index if not exists service_entries_client_date_idx
  on public.service_entries(client_id, service_date);
create index if not exists payments_client_date_idx
  on public.payments(client_id, payment_date);
create index if not exists billings_client_period_idx
  on public.billings(client_id, period_end desc);
create unique index if not exists one_active_client_credential_idx
  on public.client_access_credentials(client_id)
  where active;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists price_tables_updated_at on public.price_tables;
create trigger price_tables_updated_at
before update on public.price_tables
for each row execute function public.set_updated_at();
drop trigger if exists clients_updated_at on public.clients;
create trigger clients_updated_at
before update on public.clients
for each row execute function public.set_updated_at();
drop trigger if exists service_catalog_updated_at on public.service_catalog;
create trigger service_catalog_updated_at
before update on public.service_catalog
for each row execute function public.set_updated_at();
drop trigger if exists service_prices_updated_at on public.service_prices;
create trigger service_prices_updated_at
before update on public.service_prices
for each row execute function public.set_updated_at();
drop trigger if exists service_entries_updated_at on public.service_entries;
create trigger service_entries_updated_at
before update on public.service_entries
for each row execute function public.set_updated_at();
drop trigger if exists payments_updated_at on public.payments;
create trigger payments_updated_at
before update on public.payments
for each row execute function public.set_updated_at();
drop trigger if exists payment_methods_updated_at on public.payment_methods;
create trigger payment_methods_updated_at
before update on public.payment_methods
for each row execute function public.set_updated_at();

alter table public.admin_users enable row level security;
alter table public.price_tables enable row level security;
alter table public.clients enable row level security;
alter table public.service_catalog enable row level security;
alter table public.service_prices enable row level security;
alter table public.service_entries enable row level security;
alter table public.payments enable row level security;
alter table public.payment_methods enable row level security;
alter table public.billings enable row level security;
alter table public.client_access_credentials enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.admin_users to authenticated;
grant select, insert, update, delete on table public.price_tables to authenticated;
grant select, insert, update, delete on table public.clients to authenticated;
grant select, insert, update, delete on table public.service_catalog to authenticated;
grant select, insert, update, delete on table public.service_prices to authenticated;
grant select, insert, update, delete on table public.service_entries to authenticated;
grant select, insert, update, delete on table public.payments to authenticated;
grant select, insert, update, delete on table public.payment_methods to authenticated;
grant select, insert, update, delete on table public.billings to authenticated;
grant select, insert, update, delete on table public.client_access_credentials to authenticated;

drop policy if exists "admin_users_admin_all" on public.admin_users;
drop policy if exists "price_tables_admin_all" on public.price_tables;
drop policy if exists "clients_admin_all" on public.clients;
drop policy if exists "service_catalog_admin_all" on public.service_catalog;
drop policy if exists "service_prices_admin_all" on public.service_prices;
drop policy if exists "service_entries_admin_all" on public.service_entries;
drop policy if exists "payments_admin_all" on public.payments;
drop policy if exists "payment_methods_admin_all" on public.payment_methods;
drop policy if exists "billings_admin_all" on public.billings;
drop policy if exists "client_credentials_admin_all" on public.client_access_credentials;

create policy "admin_users_admin_all" on public.admin_users
for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "price_tables_admin_all" on public.price_tables
for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "clients_admin_all" on public.clients
for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "service_catalog_admin_all" on public.service_catalog
for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "service_prices_admin_all" on public.service_prices
for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "service_entries_admin_all" on public.service_entries
for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "payments_admin_all" on public.payments
for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "payment_methods_admin_all" on public.payment_methods
for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "billings_admin_all" on public.billings
for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "client_credentials_admin_all" on public.client_access_credentials
for all to authenticated using (public.is_admin()) with check (public.is_admin());
