-- Mesmo bug corrigido em signature_models (20260904144330): a migracao que criou
-- app_settings (20260725003247) definiu a tabela e a policy de RLS mas nao concedeu
-- GRANT ao papel "authenticated" - o Postgres nega o acesso com 403 antes da RLS
-- entrar em acao (visto no console do usuario), o que impedia a sincronizacao do
-- "Periodo padrao" entre aparelhos de funcionar desde a criacao da tabela.
grant references, trigger, truncate, maintain on table public.app_settings to anon;
grant all on table public.app_settings to authenticated;
grant all on table public.app_settings to service_role;
