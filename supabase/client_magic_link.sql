alter table public.client_access_credentials
  add column if not exists magic_link_hash text;

create unique index if not exists client_credentials_magic_link_idx
  on public.client_access_credentials(magic_link_hash)
  where magic_link_hash is not null;
