-- Troca o mecanismo de sincronizacao entre aparelhos de "Postgres Changes"
-- (replica a linha inteira, antes+depois, pra cada aparelho conectado) por
-- "Broadcast from Database": um trigger manda so um aviso minusculo
-- (nome da tabela) pelo canal Realtime. O app.js so usa o evento como
-- gatilho pra buscar tudo de novo (scheduleRealtimeSyncRefresh ja ignora
-- o conteudo do payload), entao o conteudo completo da linha nunca era
-- necessario — so estava sendo pago em Realtime Egress a toa.
--
-- Reduz o payload por evento de "linha completa de service_entries/
-- supplier_entries etc" pra poucos bytes fixos. Contexto: pico de 175MB de
-- Realtime Egress num unico dia (17/08/2026), 91% do trafego do dia.
--
-- Canal fica publico (private=false): o payload so tem o nome da tabela,
-- sem dado sensivel, entao nao precisa de autorizacao/RLS extra em
-- realtime.messages. Se um dia quiser mais rigor, da pra trocar pra
-- private=true e criar policy restrita a admin.
--
-- ATENCAO: esta migration so faz efeito de verdade quando aplicada JUNTO
-- com a troca em app.js de channel.on("postgres_changes", ...) para
-- channel.on("broadcast", { event: "admin_sync" }, ...) — ate la, o
-- app continua ouvindo postgres_changes normalmente (a publicacao so e
-- removida no fim deste arquivo).

create or replace function public.notify_admin_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object('table', tg_table_name),
    'admin_sync',
    'admin-realtime-sync',
    false
  );
  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'price_tables',
    'clients',
    'service_catalog',
    'service_prices',
    'service_entries',
    'payments',
    'payment_methods',
    'billings',
    'suppliers',
    'supplier_services',
    'supplier_entries',
    'supplier_payables',
    'supplier_payments',
    'client_service_requests',
    'client_requesters',
    'payment_links',
    'app_settings'
  ]
  loop
    execute format(
      'drop trigger if exists trg_notify_admin_sync on public.%I;',
      t
    );
    execute format(
      'create trigger trg_notify_admin_sync after insert or update or delete on public.%I for each row execute function public.notify_admin_sync();',
      t
    );
  end loop;
end;
$$;

-- Nao precisa mais dessas tabelas na publicacao supabase_realtime: o aviso
-- agora sai pelo trigger acima (realtime.send), nao pela replicacao de
-- Postgres Changes que essa publicacao alimentava.
alter publication supabase_realtime drop table
  price_tables,
  clients,
  service_catalog,
  service_prices,
  service_entries,
  payments,
  payment_methods,
  billings,
  suppliers,
  supplier_services,
  supplier_entries,
  supplier_payables,
  supplier_payments,
  client_service_requests,
  client_requesters,
  payment_links,
  app_settings;
