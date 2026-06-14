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
  check (period_end >= period_start)
);

create index if not exists service_tracking_links_client_period_idx
  on public.service_tracking_links(client_id, period_start, period_end);

alter table public.service_tracking_links enable row level security;
