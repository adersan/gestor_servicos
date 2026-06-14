create table if not exists public.whatsapp_sessions (
  session text primary key,
  status text not null default 'starting',
  message text,
  qr_code text,
  updated_at timestamptz not null default now()
);

alter table public.whatsapp_sessions enable row level security;

grant select, insert, update, delete
  on table public.whatsapp_sessions
  to authenticated;

drop policy if exists "whatsapp_sessions_admin_all"
  on public.whatsapp_sessions;

create policy "whatsapp_sessions_admin_all"
  on public.whatsapp_sessions
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
