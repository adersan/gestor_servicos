alter table public.service_catalog
  add column if not exists code text;

create unique index if not exists service_catalog_code_idx
  on public.service_catalog(code)
  where code is not null and code <> '';
