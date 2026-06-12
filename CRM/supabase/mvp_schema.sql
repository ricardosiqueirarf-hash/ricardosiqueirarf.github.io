-- ColorGlass CRM WhatsApp MVP
-- Rode este SQL no Supabase antes de testar o Render.
-- Usa tabelas simples e independentes do sistema principal.

create extension if not exists pgcrypto;

create table if not exists public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  wa_id text not null unique,
  name text not null,
  phone text not null,
  source text not null default 'WhatsApp direto',
  first_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_conversations (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.crm_leads(id) on delete set null,
  wa_id text not null unique,
  status text not null default 'open',
  unread_count integer not null default 0,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.crm_conversations(id) on delete cascade,
  external_message_id text unique,
  direction text not null check (direction in ('inbound', 'outbound')),
  sender_handle text,
  body text not null,
  status text not null default 'received',
  error_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_crm_conversations_last_message_at
  on public.crm_conversations(last_message_at desc);

create index if not exists idx_crm_messages_conversation_created
  on public.crm_messages(conversation_id, created_at asc);

-- Como o MVP usa SUPABASE_SERVICE_ROLE_KEY no servidor, RLS pode ficar desativado nessas tabelas.
-- Nao exponha SUPABASE_SERVICE_ROLE_KEY no frontend nem no GitHub.
