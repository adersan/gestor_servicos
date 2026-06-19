alter table public.supplier_portal_links
  add column if not exists show_entries boolean not null default true;
