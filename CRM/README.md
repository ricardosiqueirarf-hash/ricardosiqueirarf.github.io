# ColorGlass CRM WhatsApp MVP

MVP executavel para Render com:

- Webhook oficial da WhatsApp Cloud API.
- Criacao automatica de lead quando chega mensagem nova.
- Criacao automatica de conversa.
- Inbox web simples para visualizar conversas.
- Resposta pelo navegador usando WhatsApp Cloud API.
- Registro de mensagens no Supabase.

## Arquivos essenciais

```txt
CRM/
  package.json
  server.js
  public/index.html
  supabase/mvp_schema.sql
  .env.example
  render.yaml
```

Os arquivos antigos em `src/` foram mantidos como referencia do CRM maior, mas este MVP executavel no Render usa `server.js` e `public/index.html`.

## Deploy no Render

Configurar como Web Service:

```txt
Root Directory: CRM
Build Command: npm install
Start Command: npm start
```

Variaveis de ambiente obrigatorias:

```env
NODE_VERSION=22
CRM_ACCESS_PASSWORD=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_APP_SECRET=
WHATSAPP_GRAPH_VERSION=v23.0
```

`CRM_ACCESS_PASSWORD` protege a tela e as APIs internas. Use uma senha simples para MVP.

## Banco Supabase

Antes de testar, rode no Supabase:

```txt
CRM/supabase/mvp_schema.sql
```

Isso cria:

```txt
crm_leads
crm_conversations
crm_messages
```

## Webhook da Meta

Depois que o Render gerar a URL, configure na Meta:

```txt
https://SEU-APP.onrender.com/api/public/whatsapp/webhook
```

O Verify Token deve ser igual ao valor de `WHATSAPP_VERIFY_TOKEN` no Render.

## Teste rapido

Acesse:

```txt
https://SEU-APP.onrender.com/health
```

Se retornar `ok: true`, o servidor subiu.

Depois acesse:

```txt
https://SEU-APP.onrender.com
```

Digite a senha configurada em `CRM_ACCESS_PASSWORD` e use a Inbox.

## Importante

Nao coloque `.env` real no GitHub. Configure chaves reais somente no painel do Render.
