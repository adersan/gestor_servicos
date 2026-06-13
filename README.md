# Gestor de Serviços

Aplicação para administrar clientes, tabelas de preço, serviços, lançamentos,
pagamentos, cobranças e relatórios enviados por WhatsApp.

## Aplicação publicada

https://gestor-servicos-adersan.netlify.app

## Estado atual

A aplicação possui login administrativo pelo Supabase e sincroniza os dados
com o banco online. O esquema do banco está em `supabase/schema.sql`.

## Executar localmente

```powershell
node server.js
```

Depois abra `http://localhost:8080`.

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

Portal do cliente:

https://gestor-servicos-adersan.netlify.app/cliente.html

## Próximas etapas

- Trocar `localStorage` pelo Supabase.
- Criar login administrativo.
- Criar portal do cliente com credenciais temporárias.
- Gerar PDF no servidor.
- Integrar a API de WhatsApp.
- Importar os dados da planilha.
