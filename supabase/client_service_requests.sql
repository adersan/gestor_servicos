create table if not exists public.client_service_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  service_id uuid references public.service_catalog(id),
  service_name text not null,
  references_list jsonb not null default '[]'::jsonb,
  requested_date date not null default current_date,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  requested_by text,
  notes text,
  status text not null default 'Novo'
    check (status in ('Novo', 'Importado', 'Cancelado')),
  imported_entry_ids uuid[] not null default '{}',
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.client_service_requests add column if not exists service_id uuid references public.service_catalog(id);
alter table public.client_service_requests add column if not exists service_name text;
alter table public.client_service_requests add column if not exists references_list jsonb not null default '[]'::jsonb;
alter table public.client_service_requests add column if not exists requested_date date not null default current_date;
alter table public.client_service_requests add column if not exists amount numeric(12,2) not null default 0;
alter table public.client_service_requests add column if not exists requested_by text;
alter table public.client_service_requests add column if not exists notes text;
alter table public.client_service_requests add column if not exists status text not null default 'Novo';
alter table public.client_service_requests add column if not exists imported_entry_ids uuid[] not null default '{}';
alter table public.client_service_requests add column if not exists imported_at timestamptz;
alter table public.client_service_requests add column if not exists created_at timestamptz not null default now();
alter table public.client_service_requests add column if not exists updated_at timestamptz not null default now();

create index if not exists client_service_requests_client_status_idx
  on public.client_service_requests(client_id, status, requested_date desc);

drop trigger if exists client_service_requests_updated_at on public.client_service_requests;
create trigger client_service_requests_updated_at
before update on public.client_service_requests
for each row execute function public.set_updated_at();

alter table public.client_service_requests enable row level security;

drop policy if exists "Admin gerencia pedidos de clientes" on public.client_service_requests;
create policy "Admin gerencia pedidos de clientes"
on public.client_service_requests
for all
using (public.is_admin())
with check (public.is_admin());
