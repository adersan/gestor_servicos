alter table public.billings add column if not exists billing_number integer;

with numbered as (
  select id, row_number() over (order by created_at asc, id asc) as seq
  from public.billings
  where billing_number is null
)
update public.billings b
set billing_number = numbered.seq + coalesce((select max(billing_number) from public.billings), 0)
from numbered
where b.id = numbered.id;

create unique index if not exists billings_billing_number_idx
  on public.billings(billing_number)
  where billing_number is not null;
