alter table public.clients add column if not exists billing_frequency text not null default 'semanal';
alter table public.clients drop constraint if exists clients_billing_frequency_check;
alter table public.clients add constraint clients_billing_frequency_check
  check (billing_frequency in ('semanal', 'quinzenal', 'mensal'));
