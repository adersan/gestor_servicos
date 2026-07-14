# AGENTS.md - Gestor de Servicos

Este arquivo orienta qualquer agente/Codex que continuar o projeto. O sistema ja esta em uso real, entao mudancas devem ser pequenas, testadas localmente e publicadas em lote para economizar creditos do Netlify.

## Local Atual Do Projeto

- Projeto principal: `D:\GitHub\gestor_servicos`
- Site em producao: `https://gestordeservicos.com.br`
- Site Netlify original: `https://gestor-servicos-adersan.netlify.app`
- Banco: Supabase do projeto `tfkhhxopxupbefaaijcz`
- Branch principal: `main`

## Estado De Publicacao

- O Netlify faz deploy automaticamente quando existe `git push` para o GitHub.
- Nao publicar pequenas alteracoes isoladas sem autorizacao do usuario.
- Preferencia atual: desenvolver e testar localmente, commitar local se fizer sentido, e so dar `git push` quando o usuario autorizar um pacote.
- O projeto ja consumiu muitos creditos do Netlify por deploys frequentes. Economizar deploys e uma regra importante.

## Estrutura Principal

- `index.html`: painel administrativo principal.
- `app.js`: logica principal do admin, renderizacao das telas, lancamentos, clientes, financeiro, fornecedores e dashboard.
- `styles.css`: estilos globais do painel administrativo.
- `data.js`: camada de dados local/Supabase, sincronizacao, upsert/delete e cache local.
- `auth.js`: autenticacao administrativa com Supabase.
- `config.js`: configuracao local real com URL e anon key do Supabase. Nao commitar segredos.
- `config.example.js`: modelo seguro de configuracao.
- `server.js`: servidor local simples para desenvolvimento.
- `sw.js`: service worker/cache PWA. Atualizar versao quando publicar alteracoes de frontend.
- `manifest.webmanifest`: manifesto PWA.
- `logo.svg`, `icon-192.png`, `icon-512.png`: identidade visual/PWA.

## Portais Publicos

- `cliente.html`, `cliente.js`, `cliente.css`: portal de cobranca do cliente com credenciais/link.
- `acompanhamento.html`, `acompanhamento.js`, `acompanhamento.css`: acompanhamento de servicos pelo cliente, somente leitura e pedidos online quando permitido.
- `fornecedor.html`, `fornecedor.js`, `fornecedor.css`: portal do fornecedor, acompanhamento/confirmacao conforme permissoes do link.

## Netlify Functions

As funcoes ficam em `netlify/functions`.

- `client-login.mjs`: login temporario do cliente.
- `client-magic-login.mjs`: acesso do cliente por link assinado.
- `issue-client-access.mjs`: gera acesso/credenciais de cobranca.
- `issue-client-magic-link.mjs`: gera link direto de cobranca.
- `issue-service-tracking-link.mjs`: gera link de acompanhamento do cliente.
- `service-tracking-data.mjs`: entrega dados do acompanhamento.
- `client-service-request.mjs`: recebe pedido online do cliente.
- `admin-client-service-requests.mjs`: consulta/gestao administrativa de pedidos online.
- `issue-supplier-link.mjs`: gera link do fornecedor.
- `supplier-portal-data.mjs`: entrega dados ao portal do fornecedor.
- `supplier-portal-save.mjs`: salva alteracoes permitidas pelo fornecedor.
- `payment-webhook.mjs`: webhook de baixa automatica de pagamentos.
- `keep-alive.mjs`: manter vivo/verificacao leve.
- `apibrasil-whatsapp-*.mjs` e `whatsapp-status-webhook.mjs`: integracao experimental com APIBrasil/WhatsApp.
- `_shared/server.mjs`: helpers compartilhados de servidor/Supabase.
- `_shared/apibrasil-whatsapp.mjs`: cliente compartilhado APIBrasil.

## Supabase

SQL e migracoes ficam em `supabase`.

- `schema.sql`: esquema base.
- `suppliers.sql`: fornecedores e servicos de fornecedor.
- `client_service_requests.sql`: pedidos online de clientes.
- `service_tracking_links.sql`: links de acompanhamento.
- `client_magic_link.sql`: links diretos de cliente.
- `service_cancellations.sql`: cancelamentos e motivos.
- `service_entry_groups.sql`: agrupamento de servico principal/complementar.
- `service_status_dates_and_supplier_whatsapp.sql`: datas de feito/entregue e campos WhatsApp fornecedor.
- `supplier_portal_permissions.sql`: permissoes do portal do fornecedor.
- `supplier_portal_show_entries.sql`: exibicao/lista para fornecedor.
- `whatsapp_sessions.sql`: sessoes WhatsApp.
- `fix_*.sql`: scripts corretivos pontuais.

Antes de alterar codigo que depende de coluna/tabela nova, criar ou atualizar o SQL correspondente e orientar o usuario a executar no Supabase.

## Variaveis De Ambiente

Variaveis secretas ficam no Netlify, nunca no frontend:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `CLIENT_PORTAL_SECRET`
- `PAYMENT_WEBHOOK_SECRET`
- `WHATSAPP_WEBHOOK_SECRET`
- `APIBRASIL_DEVICE_TOKEN`
- `APIBRASIL_BEARER_TOKEN`
- `APIBRASIL_WHATSAPP_SESSION`
- `APIBRASIL_BASE_URL` opcional

No navegador usar somente `supabaseAnonKey` em `config.js`.

## Como Rodar Localmente

Na pasta `D:\GitHub\gestor_servicos`:

```powershell
node server.js
```

Abrir:

```text
http://localhost:8080
```

Tambem pode ser usado:

```powershell
python -m http.server 8094 --directory D:\GitHub\gestor_servicos
```

## Testes E Validacao

Nao existe `package.json`. Os testes atuais sao scripts Node diretos.

Comandos recomendados antes de commit/deploy:

```powershell
node --check app.js
node --check data.js
node --check cliente.js
node --check acompanhamento.js
node --check fornecedor.js
node --check supplier.js
node tests\billing-rollover.test.mjs
node tests\reference-history.test.mjs
git diff --check
```

Se a alteracao mexer em Netlify Functions, validar tambem:

```powershell
node --check netlify\functions\nome-da-funcao.mjs
```

## Publicacao E Cache

Quando for publicar frontend:

1. Atualizar query strings em `index.html` se `app.js`, `styles.css` ou outros assets mudarem.
2. Atualizar `sw.js`:
   - nome/numero do cache;
   - lista de assets com as novas query strings.
3. Rodar validacoes.
4. Commitar.
5. So dar `git push origin main` com autorizacao do usuario.
6. Conferir producao depois do deploy.

Sem versionamento de cache, o celular pode continuar usando arquivo antigo.

## Regras De Trabalho

- Nao reverter alteracoes que nao foram feitas por voce.
- Conferir `git status -sb` antes de editar/commitar.
- Manter alteracoes pequenas e coerentes com o padrao atual.
- Evitar refatoracoes grandes enquanto o sistema esta em uso.
- Usar `apply_patch` para edicoes manuais.
- Nao gravar tokens, bearer, service role ou chaves secretas em arquivos versionados.
- Se mudar banco, documentar qual SQL deve ser executado no Supabase.
- Se a mudanca impactar celular, testar mentalmente layout responsivo e reduzir excesso visual.
- Se a mudanca impactar financeiro/cobranca, conferir pagamentos parciais, quitacao, credito e saldo anterior.

## Regras Para Codex No Terminal

Estas regras refletem o combinado com o usuario durante o desenvolvimento real do sistema.

- Trabalhar sempre a partir da pasta `D:\GitHub\gestor_servicos`.
- Antes de qualquer alteracao, rodar `git status -sb` e identificar arquivos ja modificados.
- Nao reverter, apagar ou sobrescrever mudancas existentes que nao foram feitas por voce.
- A alteracao atual em `.gitignore` nao pertence ao agente; nao incluir em commits e nao reverter sem pedido explicito.
- Fazer mudancas localmente primeiro. O sistema esta em uso real.
- Commits locais sao permitidos quando organizam bem o trabalho.
- Nao executar `git push` sem autorizacao clara do usuario.
- Quando o usuario autorizar "pode subir", publicar o lote ja commitado/validado sem pedir nova confirmacao; ainda assim, sempre perguntar antes de qualquer `git push` quando nao houver autorizacao explicita no turno.
- Cada `git push origin main` dispara deploy automatico no Netlify e consome creditos.
- Agrupar pequenas correcoes em lote antes de publicar.
- Antes de publicar frontend, atualizar versoes de cache em `index.html`, `sw.js` e no registro do service worker em `app.js` quando houver mudanca em assets cacheados.
- Depois de mudar `app.js`, normalmente atualizar:
  - `index.html`: `app.js?v=N`
  - `sw.js`: `CACHE = "gestor-servicos-vN"` e asset `app.js?v=N`
  - `app.js`: `navigator.serviceWorker.register("sw.js?v=N")`
- Rodar validacoes antes de commit/deploy:
  - `node --check app.js`
  - `node --check data.js`
  - `node --check cliente.js`
  - `node --check acompanhamento.js`
  - `node --check fornecedor.js`
  - `node --check supplier.js`
  - `node tests\billing-rollover.test.mjs`
  - `node tests\reference-history.test.mjs`
  - `git diff --check`
- Se a mudanca envolver Netlify Functions, rodar `node --check` na funcao alterada.
- Se a mudanca exigir banco, criar/atualizar arquivo SQL em `supabase` e avisar o usuario exatamente qual script executar no Supabase.
- Nunca colocar secrets no codigo:
  - Supabase service role/secret key
  - Bearer token
  - Device token
  - Webhook secret
  - Chaves de API
- Secrets devem ficar somente nas variaveis de ambiente do Netlify.
- Evitar comandos destrutivos como `git reset --hard`, `git checkout --`, `rm`/`Remove-Item` sem pedido explicito e confirmacao.
- Preferir patches pequenos e revisar o diff antes de commitar.
- Ao final, informar:
  - arquivos alterados;
  - testes executados;
  - se foi publicado ou ficou apenas local;
  - se existe alguma pendencia de SQL/cache/deploy.

### Publicacao

Fluxo recomendado quando o usuario disser claramente "pode subir":

1. Rodar `git status -sb`.
2. Confirmar que apenas arquivos do lote serao commitados.
3. Atualizar cache se necessario.
4. Rodar testes e `git diff --check`.
5. Fazer commit com mensagem objetiva.
6. Executar `git push origin main`.
7. Aguardar o Netlify publicar.
8. Verificar `https://gestordeservicos.com.br` e confirmar se a versao nova apareceu.

### Git No Windows

Se `git` nao estiver no PATH no terminal, usar o Git do GitHub Desktop:

```powershell
C:\Users\aders\AppData\Local\GitHubDesktop\app-3.5.8\resources\app\git\cmd\git.exe
```

Exemplo:

```powershell
C:\Users\aders\AppData\Local\GitHubDesktop\app-3.5.8\resources\app\git\cmd\git.exe status -sb
```

## Fluxos Importantes Do Sistema

### Cliente

- Cadastro, tabelas, servicos, lancamentos e pedidos online ficam agrupados no menu `Clientes`.
- A ordem desejada do submenu de clientes e: `Lancamento`, `Pedido on-line`, `Cadastro`, `Servicos`.
- Lancamentos da tela de cliente devem priorizar a semana operacional atual, mas busca por referencia/placa deve poder localizar em todo o historico.
- Servicos complementares ficam vinculados ao servico principal. No resumo, complementares nao contam como servicos principais, mas seu valor aparece separado.

### Financeiro

- Pagamentos podem ocorrer antes ou depois da geracao da cobranca.
- Pagamentos ja abatidos/vinculados nao devem ficar editaveis.
- Cobrancas podem estar abertas, parciais, quitadas ou canceladas.
- Ao gerar cobranca, pagamentos do periodo devem abater a cobranca.
- Se pagamento passar do valor devido, tratar como credito para abater futuramente.
- O resumo financeiro deve evitar mostrar pagamento atrasado como credito indevido da semana atual.

### Fornecedor

- Fornecedores possuem cadastro, servicos, lancamentos, pagamentos, relatorios e portal proprio.
- Servico de fornecedor pode ser gerado a partir de lancamento do cliente ou lancamento direto.
- Status do fornecedor pode avancar automaticamente quando o servico do cliente vira `Feito` ou `Entregue`, mas pode ser ajustado manualmente.
- Ao excluir ou cancelar servico do cliente, perguntar o que fazer com fornecedores vinculados.
- Registrar datas de `Feito` e `Entregue` quando status muda.

### Portais

- Cliente e fornecedor veem apenas o que o link/token permite.
- Links devem ser somente leitura salvo permissoes explicitas, especialmente no fornecedor.
- Alteracoes feitas pelo fornecedor devem ficar marcadas para o administrador identificar.

## Observacoes Recentes

- Ha uma alteracao preexistente em `.gitignore`; nao reverter sem pedido explicito.
- Publicado: botao `Voltar para Feito`, busca por digitacao (datalist) em todos os modais com lista que podiam crescer, e correcao do rodape fixo do modal de lancamento no mobile. Regra adotada: todo modal com lista que pode crescer deve permitir digitar para buscar, sem excecao.
- Publicado: portal de acompanhamento (`acompanhamento.html`/`.js`/`.css`) virou uma area de 3 abas — Servicos, Financeiro (tempo real, mesmo sem cobranca gerada) e Relatorio de cobranca (so aparece quando existe cobranca do cliente). Helpers `billingOpenAmount`/`selectBillingPaymentMethods` extraidos para `_shared/server.mjs` e reaproveitados por `client-statement.mjs`. O `cliente.html`/`.js`/`.css` (login por cobranca) nao foi alterado.
- Publicado e testado pelo usuario em producao: link de acompanhamento com dois niveis de acesso. Sem senha: so aba Servicos, sem valores, mas pode fazer pedido. Com senha: acesso completo aos itens escolhidos na geracao do link (abas Financeiro/Relatorio de cobranca e quais servicos do catalogo ficam visiveis). Admin escolhe no `trackingDialog` entre "link com senha embutida" (URL com parametro `full=`, entra direto sem tela de escolha) ou "gerar identificador/senha para digitar" (com botoes de copiar) — so esse segundo modo mostra a tela de escolha de verdade. Tela de entrada mostra so os dois botoes ("Entrar sem senha"/"Entrar com senha"); a caixa de identificador/senha so aparece ao clicar em "Entrar com senha". Links gerados antes dessa mudanca continuam abrindo direto, sem tela de escolha (`linkMode` distingue "legacy" de "gated"). O backend zera os valores (`amount`) na resposta quando o acesso e restrito, em vez de confiar so na tela pra esconder (evita ver preco pelo DevTools). Novo helper `resolveTrackingTier` em `_shared/server.mjs`, testado em `tests/tracking-tier.test.mjs`. Novas colunas em `service_tracking_links` (`identifier_hash`, `password_hash`, `full_token_hash`, `full_show_financial`, `full_show_billing`, `visible_service_ids`) — SQL ja executado no Supabase pelo usuario.
- Para testar as Netlify Functions localmente (o `node server.js` so serve estatico), usar `netlify dev` (via `netlify-cli`, `netlify link` feito na pasta do projeto). Atencao: se a funcao reclamar de variavel de ambiente nao configurada mesmo com o site linkado, verificar no painel do Netlify (Site configuration > Environment variables) se cada variavel tem o escopo "Local development" habilitado — sem isso o `netlify dev` nao consegue ler as variaveis mesmo que `netlify env:list` mostre elas configuradas.
- Ainda nao publicado: modal de lancamento (`#serviceDialog`) ganhou um fluxo de perguntas por etapa no mobile/tablet, so para lancamento novo (inclusive "Importar pedido") — editar um lancamento existente continua abrindo o formulario completo de uma vez, como sempre. No desktop nada mudou. Cada etapa e um agrupamento do mesmo DOM/campos de sempre (`.wizard-step` em `index.html`), sem novo caminho de salvamento: os botoes Sim/Nao (solicitante, complementares, fornecedor), Hoje/Amanha/Outra data e os 3 botoes de Situacao so manipulam os inputs reais e disparam `change`, reaproveitando `toggleServiceRequesterSection`/`toggleAdditionalServices`/o listener de `hasSupplierService` em `supplier.js` que ja existiam. Nenhum botao de escolha avanca sozinho — sempre exige toque em "Continuar" (so o Sim revela campo novo foca nele; Nao/Hoje/Amanha/Situacao movem o foco pro Continuar, pra Enter do teclado fisico avancar direto). Etapa final mostra um resumo em cards (label+valor, borda e fundo clarinho) e aciona o mesmo `form.requestSubmit(button[value="default"])` do submit de sempre (`app.js`, controlador perto de `openEntryForm`, funcoes `setServiceWizardMode`/`goToServiceWizardStep`/`validateServiceWizardStep`/`renderServiceWizardSummary`/`syncServiceWizardChoiceSelection`). Botao X do `#serviceDialog` ganhou fechamento explicito (`closeServiceDialog`) por nao fechar de forma confiavel so com o `method="dialog"` nativo dentro do fluxo do wizard. Especificacao completa (medidas exatas de CSS, logica de cada etapa) documentada pelo usuario em `LANCAR-MOVEL.md` na raiz do projeto (nao versionado). Breakpoint mobile do `styles.css` (o unico bloco `@media`) e dos `matchMedia` em `app.js` foi ampliado de `700px` para `1024px` a pedido do usuario, pra cobrir tablets e celular deitado — testado e aprovado pelo usuario em tablet e celular deitado.
- Ainda nao publicado: corrigido um bug em que dialogs pequenos (ex.: `#deleteServiceDialog`) colapsavam no mobile/tablet (altura de um botao, conteudo sumindo) — a regra `dialog[open]:not(.wide-dialog)`/`dialog form` no `@media` de `styles.css` usava `max-height:100%` no form contra um `dialog` sem `height` explicita (so `max-height`), o que e ambiguo para resolucao de porcentagem; trocado para layout flexbox (`display:flex;flex-direction:column` no dialog, `flex:1 1 auto;min-height:0` no form), que resolve isso de forma robusta pra qualquer dialog, nao so o do wizard. Etapa Data do wizard: removido o botao "Amanha" (so Hoje/Outra data) e o campo de data nao abre mais o seletor nativo sozinho ao entrar na etapa — so quando o usuario toca "Outra data" ou toca no proprio campo (`firstVisibleServiceField` em `app.js` ignora `type=date` no auto-foco). Etapa Placa/referencia agora exige pelo menos uma referencia antes de avancar (Enter ou Continuar), mas Enter com o campo vazio ainda avanca se ja existir alguma na lista. Etapas Servico, Complementares e Fornecedor ganharam um seletor de botoes paginado, ordenado pelos itens mais usados no historico (`catalogUsagePickerItems` em `app.js`; `pickerSuppliers`/`pickerServicesForSupplier` novos em `window.supplierModule`) — tocar num botao ainda nao adicionado ja adiciona direto (usa preco sugerido/custo auto-preenchido); tocar num ja adicionado remove. Ver bullet mais recente abaixo pra contagem de passos/pagina atualizada (esses numeros mudaram depois desta nota).
- Ainda nao publicado: modal de lancamento do fornecedor foi dividido em duas etapas (Fornecedor = so nome, nova etapa Servico do fornecedor = so o servico+custo+lista) — total agora 10 passos, com pulo automatico da etapa "Servico do fornecedor" (avancar e voltar) quando a resposta for "Nao" (`goToServiceWizardStep` calcula direcao e pula o passo 8 se `hasSupplierService` desmarcado). Pickers (Servico, Complementares, Fornecedor, Servico do fornecedor) agora mostram 6 itens por pagina (`WIZARD_PICKER_PAGE_SIZE`) e o campo de digitar/buscar fica escondido por padrao (`wizard-picker-search-field hidden`, so existe em modo wizard — `setServiceWizardMode` reexibe esses campos quando o wizard esta desligado, senao quebraria o formulario desktop/edicao), revelado por um novo botao "Buscar" entre "Voltar" (renome de "Anterior") e "Mais" na barra de paginacao (`data-picker-search`), ou automaticamente quando a validacao falha (`revealPickerSearchField`). Atencao: como o proprio wizard-nav (barra fixa embaixo) tambem tem um botao "Voltar" (etapa anterior), ficam dois "Voltar" na tela ao mesmo tempo com significados diferentes — decisao do usuario, so documentando.
- Ainda nao publicado, em andamento: usuario pediu pra levar o modelo de etapas (wizard) do `#serviceDialog` para TODOS os modais do sistema no mobile/tablet. Plano de fases salvo (rollout dialog a dialog, testando antes de avançar).
  - **Controlador generico**: `createDialogWizard(config)` em `app.js` — navegacao entre etapas com pulo condicional, barra de progresso, foco, botoes de escolha curta genericos via `data-choice-for` (no container) + `data-choice-value` (no botao) — funciona tanto pra campo select/texto (`.value`) quanto checkbox (`.checked`, valor "1"/"0"), e botao Hoje/Outra data via `data-date-choice`. Cada dialog convertido chama `createDialogWizard({...})` uma vez e `algumWizard.activate(condicao)` antes do `showModal()`. SEM tocar no codigo especifico ja existente do `serviceDialog` (continua com suas proprias funcoes, nao foi migrado — zero risco pro que ja estava aprovado). Duas regras CSS genericas (`.wizard-mode .wizard-step label`/`input,select,textarea` e `.wizard-mode .dialog-actions,.dialog-form-actions`) foram adicionadas AO LADO das regras especificas de `#serviceForm` (nao substituindo — cuidado ao mexer aqui, remover a regra especifica de `#serviceForm` quebraria a especificidade CSS e faria `#serviceDialog label{gap:5px}` ganhar de volta).
  - **Picker generalizado**: `createDialogWizard` ganhou suporte a picker (cards com paginacao Voltar/Buscar/Mais, igual ao `serviceDialog`) via `config.pickers = { chave: { searchField, idField, items(form), onApply(form) } }`. Cada wizard instancia tem sua PROPRIA pagina de picker (nao compartilha estado global com o `serviceDialog`). Deteccao de "etapa com picker" (pra nao roubar foco/teclado) e automatica: se a etapa tem um `.wizard-picker[data-picker]` no DOM, conta como picker step sem precisar configurar `isPickerStep`. Corrigido tambem nessa passada: o botao Voltar da 1a etapa so procurava `[data-close-dialog]`, mas os dialogs de fornecedor usam `[data-close-supplier-dialog]` — agora procura os dois.
  - **Convertidos e testados/aprovados pelo usuario**: `paymentDialog` (Registrar pagamento, 6 passos), `billingDialog` (Gerar cobrança, 5 passos), `paymentMethodDialog` (Nova forma de pagamento, 6 passos), `supplierDialog` (Novo fornecedor, 8 passos), `supplierEntryDialog` (Lançamento direto do fornecedor, 8 passos, Fornecedor/Serviço com picker de cards), `supplierPayableDialog` (Gerar conta a pagar, 5 passos: Fornecedor (picker)/Período/Link semanal (Sim-Não)/Lista detalhada (Sim-Não)/Confirmação; sem distincao novo/editar, wizard ativa so pelo tamanho da tela), e o Bucket B inteiro: `supplierServiceDialog` (Servico do fornecedor avulso, 5 passos, picker `supplierServiceForm`), `billingBatchDialog` (Gerar cobranca para todos, 4 passos), `supplierPaymentDialog` (Pagar fornecedor, 5 passos), `catalogDialog` (Servico e precos, 4 passos: Codigo/Nome/Precos agrupados numa etapa so/Confirmacao).
  - **Deixados de fora do rollout, de proposito**: `clientRequesterDialog` (gerenciador de lista viva de solicitantes, nao é um formulario sequencial pergunta-a-pergunta) e `whatsappDialog` (fluxo assincrono de conexao com status/QR code ao vivo, formulario nem usa `method="dialog"`) — nenhum dos dois se encaixa no modelo de wizard "responde e fecha".
  - **Fase 4, convertidos, aguardando teste do usuario**: `trackingDialog` (Acompanhamento do cliente, 8 passos: Cliente/Período/Validade/Permitir pedidos (Sim-Não)/Acesso completo embutido-ou-digitado (radio nativo, sem virar botao por causa de RadioNodeList nao ter dispatchEvent)/Abas visiveis/Serviços visiveis/Confirmação — o painel de credenciais (`trackingAccessResult`) fica dentro da propria etapa de Confirmação e so aparece quando o modo "digitado" gera identificador/senha, sem fechar o dialog); `supplierAccessDialog` (Link do fornecedor, 9 passos: Fornecedor (picker)/Período/Validade/4 perguntas Sim-Não (lançar e alterar, marcar feito, cancelar, observações de vínculo)/Lista detalhada/Confirmação — o painel de link gerado tambem fica dentro da etapa de Confirmação, dialog nunca fecha sozinho). `clientDialog` (tem abas, decidir depois se vale trocar por etapas) fica por ultimo/a combinar.
