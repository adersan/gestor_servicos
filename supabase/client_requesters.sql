create table if not exists public.client_requesters (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  normalized_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, normalized_name)
);

alter table public.service_entries add column if not exists requested_by text;

grant select, insert, update, delete on table public.client_requesters to authenticated;

alter table public.client_requesters enable row level security;

drop policy if exists "client_requesters_admin_all" on public.client_requesters;
create policy "client_requesters_admin_all" on public.client_requesters
for all to authenticated using (public.is_admin()) with check (public.is_admin());
