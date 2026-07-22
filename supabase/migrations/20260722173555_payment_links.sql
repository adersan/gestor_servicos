create table if not exists public.payment_links (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  amount numeric(10,2) not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  payment_id uuid references public.payments(id) on delete set null,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists payment_links_status_idx on public.payment_links(status);
create index if not exists payment_links_client_idx on public.payment_links(client_id);

alter table public.payment_links enable row level security;

grant select, insert, update, delete
  on table public.payment_links
  to authenticated;

drop policy if exists "payment_links_admin_all" on public.payment_links;

create policy "payment_links_admin_all"
  on public.payment_links
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
