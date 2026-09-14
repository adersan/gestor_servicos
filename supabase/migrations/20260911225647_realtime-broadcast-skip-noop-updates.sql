-- Corrige o estouro da cota de "Mensagens em tempo real" do Supabase (plano
-- Free, 2M/mes) — 2.723.637 mensagens no ciclo 12/08-12/09/2026 (136%).
--
-- Causa raiz: upsertState() (data.js) reenvia o ARRAY INTEIRO de cada tabela
-- a cada save (criar/editar/excluir qualquer lancamento/pagamento/cobranca
-- etc), nao so o registro alterado. O Postgres executa UPDATE via
-- ON CONFLICT DO UPDATE em toda linha reenviada, mesmo quando o valor e
-- identico ao que ja estava salvo — e o trigger anterior (ver migration
-- realtime-broadcast-admin-sync) disparava em TODA execucao de UPDATE, sem
-- checar se algo realmente mudou. Hoje isso significa ~3267 disparos de
-- trigger (portanto ~3267 mensagens Realtime, vezes aparelhos conectados)
-- a cada UNICO save, mesmo quando so 1 registro mudou de verdade.
--
-- Correcao: substitui o trigger unico (INSERT OR UPDATE OR DELETE) por 3
-- triggers separados — INSERT e DELETE continuam disparando sempre (sao
-- mudancas reais), UPDATE ganha a condicao "WHEN (OLD IS DISTINCT FROM
-- NEW)" (comparacao nativa do Postgres pela linha inteira), que so deixa
-- passar quando algum campo realmente mudou. Nao precisa mudar app.js/
-- data.js — so filtra o disparo do aviso na origem.

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
    execute format('drop trigger if exists trg_notify_admin_sync on public.%I;', t);

    execute format(
      'create trigger trg_notify_admin_sync_insert after insert on public.%I for each row execute function public.notify_admin_sync();',
      t
    );
    execute format(
      'create trigger trg_notify_admin_sync_update after update on public.%I for each row when (old is distinct from new) execute function public.notify_admin_sync();',
      t
    );
    execute format(
      'create trigger trg_notify_admin_sync_delete after delete on public.%I for each row execute function public.notify_admin_sync();',
      t
    );
  end loop;
end;
$$;
