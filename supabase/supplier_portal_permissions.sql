alter table public.supplier_portal_links
  add column if not exists can_mark_done boolean not null default false;

alter table public.supplier_portal_links
  add column if not exists can_cancel boolean not null default false;

alter table public.supplier_portal_links
  add column if not exists show_linked_notes boolean not null default false;

alter table public.supplier_portal_links
  add column if not exists show_entries boolean not null default true;

alter table public.supplier_entries
  add column if not exists last_changed_by text;

alter table public.supplier_entries
  drop constraint if exists supplier_entries_last_changed_by_check;

alter table public.supplier_entries
  add constraint supplier_entries_last_changed_by_check
  check (last_changed_by is null or last_changed_by in ('Administrador', 'Fornecedor'));
