update public.payment_links
set status = 'cancelled'
where status = 'pending';
