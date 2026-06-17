create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  dominio text unique,
  logo_url text,
  cor_primaria text not null default '#111827',
  cor_secundaria text not null default '#d4af37',
  status text not null default 'ativa' check (status in ('ativa', 'suspensa', 'cancelada')),
  plano text not null default 'mvp',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lojas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null,
  slug text not null,
  documento text,
  telefone text,
  email text,
  cidade text,
  estado text,
  endereco jsonb not null default '{}'::jsonb,
  status text not null default 'ativa' check (status in ('ativa', 'inativa')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lojas_empresa_slug_unique unique (empresa_id, slug)
);

create table if not exists public.usuarios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  loja_id uuid references public.lojas(id) on delete set null,
  nome text not null,
  email text not null,
  telefone text,
  senha_hash text not null,
  perfil text not null default 'vendedor' check (perfil in ('owner', 'admin', 'gerente', 'vendedor', 'producao', 'logistica', 'financeiro')),
  ativo boolean not null default true,
  ultimo_login_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint usuarios_empresa_email_unique unique (empresa_id, email)
);

create table if not exists public.orcamentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  loja_id uuid not null references public.lojas(id) on delete cascade,
  usuario_id uuid references public.usuarios(id) on delete set null,
  numero_pedido text,
  cliente_nome text not null,
  cliente_documento text,
  cliente_telefone text,
  status text not null default 'rascunho' check (status in ('rascunho', 'enviado', 'aprovado', 'producao', 'finalizado', 'cancelado')),
  valor_total numeric(12,2) not null default 0,
  dados jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orcamentos_empresa_numero_unique unique (empresa_id, numero_pedido)
);

create table if not exists public.eventos_auditoria (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete cascade,
  loja_id uuid references public.lojas(id) on delete set null,
  usuario_id uuid references public.usuarios(id) on delete set null,
  categoria text not null,
  acao text not null,
  entidade_tipo text,
  entidade_id uuid,
  resumo text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_lojas_empresa_id on public.lojas(empresa_id);
create index if not exists idx_usuarios_empresa_id on public.usuarios(empresa_id);
create index if not exists idx_usuarios_loja_id on public.usuarios(loja_id);
create index if not exists idx_orcamentos_empresa_loja on public.orcamentos(empresa_id, loja_id);
create index if not exists idx_orcamentos_status on public.orcamentos(status);
create index if not exists idx_eventos_empresa_id on public.eventos_auditoria(empresa_id);

alter table public.empresas enable row level security;
alter table public.lojas enable row level security;
alter table public.usuarios enable row level security;
alter table public.orcamentos enable row level security;
alter table public.eventos_auditoria enable row level security;
