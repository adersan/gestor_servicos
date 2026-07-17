-- Acesso do fornecedor em dois niveis, no mesmo espirito do link de acompanhamento do
-- cliente: sem senha (accessCode/token_hash) fica restrito (sem financeiro, servicos sem
-- valor); com senha (identifier_hash/password_hash, digitados no portal) libera o acesso
-- completo, incluindo contas a pagar e pagamentos. Links gerados antes deste SQL continuam
-- com acesso completo sem gating (identifier_hash nulo = link "legacy").
alter table public.supplier_portal_links
  add column if not exists identifier_hash text;

alter table public.supplier_portal_links
  add column if not exists password_hash text;

alter table public.supplier_portal_links
  add column if not exists plain_access_code text;

alter table public.supplier_portal_links
  add column if not exists plain_identifier text;

alter table public.supplier_portal_links
  add column if not exists plain_password text;

create index if not exists supplier_portal_links_active_supplier_idx
  on public.supplier_portal_links(supplier_id)
  where active = true;
