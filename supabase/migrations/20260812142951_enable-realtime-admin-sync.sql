-- Habilita replicacao Realtime (Postgres Changes) nas tabelas usadas pelo painel
-- administrativo (mesma lista de tabelas de window.dataStore.fetchAll em data.js),
-- para o app.js poder ouvir mudancas de outros aparelhos e atualizar sozinho
-- (substitui o gatilho manual/gate de 20h por atualizacao quase instantanea).
alter publication supabase_realtime add table
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
