alter table public.service_entries
  add column if not exists done_at timestamptz;

alter table public.supplier_entries
  add column if not exists done_at timestamptz,
  add column if not exists delivered_at timestamptz;

alter table public.suppliers
  add column if not exists whatsapp_destination text not null default 'individual',
  add column if not exists whatsapp_group_name text;

alter table public.suppliers
  drop constraint if exists suppliers_whatsapp_destination_check;
alter table public.suppliers
  add constraint suppliers_whatsapp_destination_check
  check (whatsapp_destination in ('individual', 'group'));

alter table public.supplier_entries
  drop constraint if exists supplier_entries_status_check;
alter table public.supplier_entries
  add constraint supplier_entries_status_check
  check (status in ('A fazer', 'Feito', 'Entregue', 'Cancelado'));

create or replace function public.set_service_status_dates()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'A fazer' then
    new.done_at := null;
    new.delivered_at := null;
  elsif new.status in ('Pronto', 'Feito') then
    new.done_at := coalesce(new.done_at, now());
    new.delivered_at := null;
  elsif new.status = 'Entregue' then
    new.done_at := coalesce(new.done_at, now());
    new.delivered_at := coalesce(new.delivered_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists service_entries_status_dates on public.service_entries;
create trigger service_entries_status_dates
before insert or update of status on public.service_entries
for each row execute function public.set_service_status_dates();

drop trigger if exists supplier_entries_status_dates on public.supplier_entries;
create trigger supplier_entries_status_dates
before insert or update of status on public.supplier_entries
for each row execute function public.set_service_status_dates();

update public.service_entries
set done_at = coalesce(done_at, updated_at, created_at)
where status in ('Pronto', 'Entregue') and done_at is null;

update public.supplier_entries
set done_at = coalesce(done_at, updated_at, created_at)
where status in ('Feito', 'Entregue') and done_at is null;

update public.supplier_entries
set delivered_at = coalesce(delivered_at, updated_at, created_at)
where status = 'Entregue' and delivered_at is null;
