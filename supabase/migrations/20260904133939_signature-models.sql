create table if not exists public.signature_models (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  model_type text not null default 'font' check (model_type in ('font', 'image', 'ai')),
  font_family text not null,
  font_data text not null,
  font_mime text not null,
  style jsonb not null default '{}'::jsonb,
  is_system_model boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.signature_models enable row level security;

create policy "signature_models_admin_all" on public.signature_models
  to authenticated using (public.is_admin()) with check (public.is_admin());
