update public.supplier_entries supplier_entry
set client_service_entry_id = null
where client_service_entry_id is not null
  and not exists (
    select 1
    from public.service_entries service_entry
    where service_entry.id = supplier_entry.client_service_entry_id
  );
