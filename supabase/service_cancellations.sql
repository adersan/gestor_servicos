alter table public.service_entries
  add column if not exists cancellation_reason text;
alter table public.service_entries
  add column if not exists cancellation_original_amount numeric(12,2);

alter table public.supplier_entries
  add column if not exists cancellation_reason text;
alter table public.supplier_entries
  add column if not exists cancellation_original_amount numeric(12,2);
