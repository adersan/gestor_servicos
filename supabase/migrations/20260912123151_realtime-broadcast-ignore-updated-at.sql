-- Corrige um furo na migration anterior (realtime-broadcast-skip-noop-updates):
-- 12 das 17 tabelas monitoradas ja tinham um trigger BEFORE UPDATE anterior
-- e independente (set_updated_at(), preexistente ao projeto de sync) que
-- seta NEW.updated_at = now() em TODO update, incondicionalmente. Como esse
-- trigger roda antes do nosso, quando "WHEN (OLD.* IS DISTINCT FROM NEW.*)"
-- avaliava a linha, o updated_at ja tinha mudado — entao a linha inteira
-- sempre parecia diferente, mesmo sem nenhuma mudanca de dado real. Isso
-- inclui as duas maiores tabelas do sistema (service_entries,
-- supplier_entries), explicando por que o volume de mensagens continuou
-- alto mesmo so abrindo o sistema e gerando um relatorio (sem editar nada).
--
-- Correcao: a condicao passa a ignorar a coluna updated_at na comparacao,
-- via jsonb menos a chave (to_jsonb(old) - 'updated_at' <> ...). Aplicado
-- de forma uniforme nas 17 tabelas — nas que nao tem essa coluna, remover
-- uma chave inexistente do jsonb e inofensivo, entao nao precisa distinguir.
-- (to_jsonb, nao row_to_jsonb: dentro do WHEN de um trigger, row_to_jsonb(old)
-- falha com "function row_to_jsonb(<tabela>) does not exist" — o parametro
-- "record" dele nao resolve a coercao implicita do tipo composto da tabela
-- nesse contexto restrito; to_jsonb(anyelement) resolve normalmente.)

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
    execute format('drop trigger if exists trg_notify_admin_sync_update on public.%I;', t);
    execute format(
      $f$create trigger trg_notify_admin_sync_update after update on public.%I for each row when ((to_jsonb(old) - 'updated_at') is distinct from (to_jsonb(new) - 'updated_at')) execute function public.notify_admin_sync();$f$,
      t
    );
  end loop;
end;
$$;
