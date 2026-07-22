alter table public.payment_links
  add column if not exists init_point text;
