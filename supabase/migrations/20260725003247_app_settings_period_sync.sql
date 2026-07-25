-- Tabela de configuracoes compartilhadas do sistema (uma unica linha, id fixo "default").
-- Primeiro uso: sincronizar o periodo padrao (semana/mes, dia de inicio/fim) entre
-- todos os aparelhos, ja que antes ficava so no localStorage de cada um.
create table if not exists public.app_settings (
  id text primary key default 'default',
  period_mode text not null default 'week',
  week_start_day integer not null default 0,
  week_end_day integer not null default 5,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

create policy "app_settings_admin_all" on public.app_settings
  for all
  using (is_admin())
  with check (is_admin());
