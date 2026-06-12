# WhatsApp MVP — ColorGlass CRM

Este MVP integra o CRM com a WhatsApp Cloud API oficial da Meta.

## O que faz

1. Recebe mensagens pelo webhook da Meta.
2. Cria ou reutiliza um lead com origem WhatsApp direto.
3. Cria ou reutiliza uma conversa na Inbox do CRM.
4. Permite responder pelo CRM usando a API oficial do WhatsApp.

Nao usa Baileys, Venom, QR Code ou automacao de WhatsApp Web.

## Variaveis de ambiente

Configure no ambiente de deploy, nao no GitHub:

```env
WHATSAPP_ACCESS_TOKEN=<valor_real_no_deploy>
WHATSAPP_PHONE_NUMBER_ID=<valor_real_no_deploy>
WHATSAPP_VERIFY_TOKEN=<valor_real_no_deploy>
WHATSAPP_DEFAULT_COMPANY_ID=<valor_real_no_deploy>
WHATSAPP_APP_SECRET=<valor_real_no_deploy>
WHATSAPP_GRAPH_VERSION=v23.0
```

## Canal no banco

O webhook tenta achar um canal ativo com o ID do numero configurado no canal WhatsApp.

SQL exemplo, substituindo os valores manualmente no Supabase:

```sql
insert into public.channels (company_id, kind, name, status, config)
values (
  '<UUID_DA_EMPRESA_COLORGLASS>',
  'whatsapp',
  'WhatsApp ColorGlass',
  'active',
  jsonb_build_object('phone_number_id', '<PHONE_NUMBER_ID>')
);
```

Se a empresa padrao estiver configurada no ambiente e nenhum canal existir, o webhook tenta criar o canal automaticamente.

## URL do webhook na Meta

Depois do deploy com HTTPS, configure na Meta:

```txt
https://SEU-DOMINIO.com/api/public/whatsapp/webhook
```

O token de verificacao do painel da Meta deve ser igual ao valor configurado no ambiente do deploy.

## Limitacoes do MVP

- Envia texto livre apenas dentro da janela de atendimento do WhatsApp.
- Para iniciar conversa ativa fora da janela de atendimento, precisa template aprovado na Meta.
- Recebe midia como placeholder textual; ainda nao baixa imagem ou documento.
