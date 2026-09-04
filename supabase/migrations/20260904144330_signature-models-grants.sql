-- A migracao anterior (signature-models) criou a tabela e a policy de RLS mas
-- esqueceu de conceder os GRANTs de acesso ao papel "authenticated" - sem isso o
-- Postgres nega o acesso antes mesmo da RLS entrar em acao (erro 403 no PostgREST).
-- Mesmo padrao usado por toda tabela do baseline (ver GRANTs de service_catalog).
grant references, trigger, truncate, maintain on table public.signature_models to anon;
grant all on table public.signature_models to authenticated;
grant all on table public.signature_models to service_role;
