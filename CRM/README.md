# CRM ColorGlass — MVP WhatsApp

Este diretório guarda o MVP de integração do CRM com WhatsApp Cloud API oficial.

## Objetivo do MVP

- Receber mensagens do WhatsApp via webhook da Meta.
- Criar/reutilizar lead automaticamente.
- Criar/reutilizar conversa na Inbox.
- Salvar mensagens recebidas no Supabase.
- Permitir resposta pelo CRM usando WhatsApp Cloud API.
- Atualizar status básico de mensagem: enviada, entregue, lida ou falhou.

## Arquivos principais do MVP

- `docs/WHATSAPP_MVP_COLORGLASS.md`
- `src/lib/whatsapp-mvp.server.ts`
- `src/routes/api/public/whatsapp/webhook.ts`
- `src/lib/transport/adapters.ts`
- `src/lib/conversations.functions.ts`
- `.env.example`

## Variáveis necessárias no deploy

```env
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_DEFAULT_COMPANY_ID=
WHATSAPP_APP_SECRET=
WHATSAPP_GRAPH_VERSION=v23.0
```

## Webhook na Meta

Após publicar o CRM em um domínio com HTTPS, configurar na Meta:

```txt
https://SEU-DOMINIO.com/api/public/whatsapp/webhook
```

O `WHATSAPP_VERIFY_TOKEN` do ambiente precisa ser igual ao token configurado no painel da Meta.

## Observação importante

O arquivo `.env` real não deve ser versionado no GitHub porque contém chaves. Use apenas `.env.example` no repositório e configure os valores reais no ambiente de deploy.

## Status

MVP funcional em nível de código. Falta plugar credenciais reais da Meta, criar/configurar o canal WhatsApp e testar com número oficial.
