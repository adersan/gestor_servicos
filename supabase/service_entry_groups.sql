alter table public.service_entries
  add column if not exists service_group_id uuid;

alter table public.service_entries
  add column if not exists primary_entry_id uuid;

alter table public.service_entries
  add column if not exists is_secondary boolean not null default false;
