-- Normaliza service_entries complementares (is_secondary = true) cujo primary_entry_id
-- aponta para um lancamento que ja foi excluido. Mesmo efeito que o app.js ja faz quando o
-- usuario exclui o principal SEM marcar "excluir complementares tambem": desvincula o
-- complementar, que passa a ser um lancamento proprio, independente.
-- Causa raiz (corrigida em data.js/upsertState): uma falha de sincronizacao numa tabela SEM
-- relacao nenhuma podia abortar a funcao inteira antes do desvinculo chegar a ser gravado.
update public.service_entries
set
  primary_entry_id = null,
  is_secondary = false,
  service_group_id = null,
  notes = case
    when notes is null or notes = '' then 'Serviço de origem excluído'
    when notes ilike '%Serviço de origem excluído%' then notes
    else notes || ' · Serviço de origem excluído'
  end
where is_secondary = true
  and primary_entry_id is not null
  and not exists (
    select 1 from public.service_entries primary_entry
    where primary_entry.id = service_entries.primary_entry_id
  );
