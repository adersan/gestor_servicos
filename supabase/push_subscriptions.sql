create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  device_label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);

create index if not exists push_subscriptions_admin_user_idx
  on public.push_subscriptions(admin_user_id);

alter table public.push_subscriptions enable row level security;

grant select, insert, update, delete
  on table public.push_subscriptions
  to authenticated;

drop policy if exists "push_subscriptions_admin_all"
  on public.push_subscriptions;

create policy "push_subscriptions_admin_all"
  on public.push_subscriptions
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create table if not exists public.push_notified_alerts (
  alert_key text primary key,
  notified_at timestamptz not null default now()
);

alter table public.push_notified_alerts enable row level security;

grant select, insert, update, delete
  on table public.push_notified_alerts
  to authenticated;

drop policy if exists "push_notified_alerts_admin_all"
  on public.push_notified_alerts;

create policy "push_notified_alerts_admin_all"
  on public.push_notified_alerts
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
