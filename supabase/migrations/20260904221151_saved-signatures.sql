-- Galeria "Minhas assinaturas": guarda o resultado final (ja limpo/transparente) de
-- "Digitalizar assinatura" e "Gerar com IA", pra reutilizar depois sem repetir o
-- processamento. Diferente de signature_models (que sao modelos de ESTILO pra
-- renderizar QUALQUER texto novo via fonte) - aqui cada linha e uma imagem final unica,
-- pronta pra carimbar em documentos.
create table if not exists public.saved_signatures (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source text not null default 'digitized' check (source in ('digitized', 'generated')),
  image_data text not null,
  image_mime text not null default 'image/png',
  thumbnail_data text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.saved_signatures enable row level security;
create policy "saved_signatures_admin_all" on public.saved_signatures
  to authenticated using (public.is_admin()) with check (public.is_admin());

grant references, trigger, truncate, maintain on table public.saved_signatures to anon;
grant all on table public.saved_signatures to authenticated;
grant all on table public.saved_signatures to service_role;
