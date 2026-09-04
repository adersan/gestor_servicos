-- Suporte a job assincrono pro "Gerar com IA (experimental)": a geracao de imagem na
-- OpenAI costuma passar do limite de 60s de uma function sincrona da Netlify. O id e
-- gerado pelo proprio navegador (crypto.randomUUID()) e enviado pra function em segundo
-- plano (generate-handwriting-background.mjs, ate 15min de limite); o navegador consulta
-- o status aqui (handwriting-job-status.mjs) ate ficar pronto ou dar erro.
create table if not exists public.handwriting_jobs (
  id uuid primary key,
  status text not null default 'pending' check (status in ('pending', 'done', 'error')),
  result_image_base64 text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.handwriting_jobs enable row level security;
create policy "handwriting_jobs_admin_all" on public.handwriting_jobs
  to authenticated using (public.is_admin()) with check (public.is_admin());

grant references, trigger, truncate, maintain on table public.handwriting_jobs to anon;
grant all on table public.handwriting_jobs to authenticated;
grant all on table public.handwriting_jobs to service_role;
