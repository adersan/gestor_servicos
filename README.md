# Gestor de Serviços

Aplicação para administrar clientes, tabelas de preço, serviços, lançamentos,
pagamentos, cobranças e relatórios enviados por WhatsApp.

## Aplicação publicada

https://gestordeservicos.com.br (domínio Netlify original: https://gestor-servicos-adersan.netlify.app)

## Estado atual

A aplicação possui login administrativo pelo Supabase e sincroniza os dados
com o banco online. O esquema do banco está em `supabase/schema.sql`.

Além do painel administrativo, existem três portais públicos:

- `cliente.html`: portal de cobrança do cliente, com login por identificador/senha ou link mágico, atrelado a uma cobrança gerada.
- `fornecedor.html`: portal do fornecedor, com acompanhamento e confirmação de serviços conforme as permissões do link.
- `acompanhamento.html`: portal de acompanhamento do cliente em tempo real (independente de cobrança), com três abas — Serviços, Financeiro e Relatório de cobrança (esta última só aparece quando existe cobrança). O link pode ser gerado com acesso completo embutido, ou com identificador/senha que o cliente digita; sem senha, o acesso fica restrito a Serviços, sem valores.

## Executar localmente

```powershell
node server.js
```

Depois abra `http://localhost:8080`. Esse servidor só serve os arquivos estáticos; para testar as Netlify Functions (login, cobrança, portais, links de acompanhamento) de verdade, use o Netlify CLI:

```powershell
netlify login
netlify link
netlify dev
```

Se alguma função reclamar de variável de ambiente não configurada mesmo com o site linkado, confira no painel do Netlify (Site configuration > Environment variables) se cada variável tem o escopo **"Local development"** habilitado.

## Publicação

O projeto está preparado para publicação estática no Netlify por meio do
arquivo `netlify.toml`.

1. Crie um repositório no GitHub.
2. Envie este projeto.
3. No Netlify, importe o repositório.
4. Não é necessário comando de build.
5. O diretório de publicação é a raiz do projeto.

## Supabase

1. Crie um projeto no Supabase.
2. Abra o SQL Editor.
3. Execute `supabase/schema.sql`.
4. Crie seu usuário em Authentication.
5. Insira o UUID desse usuário em `admin_users`.
6. Configure `config.js` com a URL e a chave publicável do projeto.

Nunca coloque uma chave secreta ou a antiga `service_role` no navegador ou no GitHub. Ela deverá existir
somente nas variáveis protegidas das funções do Netlify.

### Variáveis protegidas do Netlify

- `SUPABASE_URL`: URL do projeto Supabase.
- `SUPABASE_SECRET_KEY`: chave secreta do Supabase. Nunca coloque esta chave em `config.js`.
- `CLIENT_PORTAL_SECRET`: texto aleatório longo usado para assinar a sessão do cliente.
- `APIBRASIL_DEVICE_TOKEN`: DeviceToken renovado da APIBrasil.
- `APIBRASIL_BEARER_TOKEN`: Bearer token renovado da APIBrasil.
- `APIBRASIL_WHATSAPP_SESSION`: nome estável da sessão, por exemplo `gestor_servicos`.
- `APIBRASIL_BASE_URL`: opcional; padrão `https://gateway.apibrasil.io/api/v2`.

Portal do cliente:

https://gestordeservicos.com.br/cliente.html

## Próximas etapas

- Integrar a API de WhatsApp de forma definitiva (hoje há uma integração experimental via APIBrasil).

## Confirmação de entrega pelo WhatsApp

O projeto inclui a função `/.netlify/functions/whatsapp-status-webhook`.
Quando a API do WhatsApp for conectada, configure no Netlify:

- `WHATSAPP_WEBHOOK_SECRET`: senha longa e exclusiva usada para autenticar o webhook.

A integração genérica aceita uma requisição `POST` com o cabeçalho:

```text
Authorization: Bearer SUA_SENHA_DO_WEBHOOK
```

Ao iniciar a sessão pela função da APIBrasil, a mesma senha é incluída
automaticamente na URL de callback porque a configuração apresentada pela
APIBrasil não oferece um campo para cabeçalhos personalizados.

No painel da APIBrasil, configure os quatro campos com a função publicada,
alterando apenas o parâmetro `event`:

```text
Mudança de conexão:
https://gestor-servicos-adersan.netlify.app/.netlify/functions/whatsapp-status-webhook?token=SEU_WHATSAPP_WEBHOOK_SECRET&event=connect

Status do dispositivo:
https://gestor-servicos-adersan.netlify.app/.netlify/functions/whatsapp-status-webhook?token=SEU_WHATSAPP_WEBHOOK_SECRET&event=status

Recebimento de mensagens:
https://gestor-servicos-adersan.netlify.app/.netlify/functions/whatsapp-status-webhook?token=SEU_WHATSAPP_WEBHOOK_SECRET&event=message

Atualização de QR Code:
https://gestor-servicos-adersan.netlify.app/.netlify/functions/whatsapp-status-webhook?token=SEU_WHATSAPP_WEBHOOK_SECRET&event=qrcode
```

O texto recebido deve conter `RECEBIDO` e o código de seis caracteres gerado
para o serviço, por exemplo: `RECEBIDO ABC123`.

### Iniciar a sessão da APIBrasil

A função administrativa `/.netlify/functions/apibrasil-whatsapp-start` usa as
credenciais protegidas do Netlify e registra automaticamente os callbacks da
APIBrasil. Exemplo de uso pelo navegador administrativo:

```js
const { data } = await window.supabaseClient.auth.getSession();
const response = await fetch("/.netlify/functions/apibrasil-whatsapp-start", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${data.session.access_token}`
  },
  body: JSON.stringify({ qrcode: true })
});
const session = await response.json();
```

Nunca grave `DeviceToken` ou Bearer token no JavaScript do navegador, no
repositório ou em `config.js`.

Antes de publicar essa funcionalidade, execute novamente
`supabase/schema.sql` no SQL Editor do Supabase para criar os campos de
confirmação.

## Baixa automática de pagamentos

A função `/.netlify/functions/payment-webhook` recebe confirmações de
pagamento e registra a baixa sem duplicar uma transação já processada.

Configure `PAYMENT_WEBHOOK_SECRET` no Netlify. O corpo esperado é:

```json
{
  "externalId": "identificador-unico-da-transacao",
  "billingId": "uuid-da-cobranca",
  "amount": 100,
  "date": "2026-06-13",
  "method": "PIX",
  "source": "Nome da API"
}
```

O cabeçalho de autenticação segue o formato
`Authorization: Bearer PAYMENT_WEBHOOK_SECRET`.
