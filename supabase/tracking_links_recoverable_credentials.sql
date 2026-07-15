-- Permite reexibir o link/identificador/senha de um acesso de acompanhamento ja gerado,
-- sem precisar gerar um novo. So o registro ativo (active = true) mantem esses valores;
-- ao ser substituido por um novo link do mesmo cliente, os campos abaixo sao zerados.
alter table public.service_tracking_links
  add column if not exists plain_access_code text;

alter table public.service_tracking_links
  add column if not exists plain_full_token text;

alter table public.service_tracking_links
  add column if not exists plain_identifier text;

alter table public.service_tracking_links
  add column if not exists plain_password text;

create index if not exists service_tracking_links_active_client_idx
  on public.service_tracking_links(client_id)
  where active = true;
