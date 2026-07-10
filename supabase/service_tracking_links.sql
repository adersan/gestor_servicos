create table if not exists public.service_tracking_links (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  token_hash text not null unique,
  period_start date not null,
  period_end date not null,
  active boolean not null default true,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_access_at timestamptz,
  allow_requests boolean not null default false,
  show_amounts boolean not null default true,
  check (period_end >= period_start)
);

alter table public.service_tracking_links
  add column if not exists allow_requests boolean not null default false;

alter table public.service_tracking_links
  add column if not exists show_amounts boolean not null default true;

alter table public.service_tracking_links
  add column if not exists identifier_hash text;

alter table public.service_tracking_links
  add column if not exists password_hash text;

alter table public.service_tracking_links
  add column if not exists full_token_hash text;

alter table public.service_tracking_links
  add column if not exists full_show_financial boolean not null default true;

alter table public.service_tracking_links
  add column if not exists full_show_billing boolean not null default true;

alter table public.service_tracking_links
  add column if not exists visible_service_ids uuid[] not null default '{}';

create index if not exists service_tracking_links_client_period_idx
  on public.service_tracking_links(client_id, period_start, period_end);

create unique index if not exists service_tracking_links_full_token_idx
  on public.service_tracking_links(full_token_hash)
  where full_token_hash is not null;

alter table public.service_tracking_links enable row level security;
