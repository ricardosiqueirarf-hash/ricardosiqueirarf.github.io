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

create or replace function public.anodiza_slugify(valor text)
returns text
language plpgsql
immutable
as $$
declare
  slug_base text;
begin
  slug_base := lower(coalesce(valor, ''));
  slug_base := translate(slug_base, 'áàãâäéèêëíìîïóòõôöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn');
  slug_base := regexp_replace(slug_base, '[^a-z0-9]+', '-', 'g');
  slug_base := regexp_replace(slug_base, '(^-|-$)', '', 'g');
  return nullif(slug_base, '');
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
  permissoes jsonb not null default '{}'::jsonb,
  ultimo_login_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint usuarios_empresa_email_unique unique (empresa_id, email)
);

alter table public.usuarios add column if not exists permissoes jsonb not null default '{}'::jsonb;

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  loja_id uuid references public.lojas(id) on delete set null,
  nome text not null,
  documento text,
  email text,
  telefone text,
  ativo boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orcamentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  loja_id uuid references public.lojas(id) on delete set null,
  usuario_id uuid references public.usuarios(id) on delete set null,
  cliente_id uuid references public.clientes(id) on delete set null,
  numero_pedido text,
  nome_orcamento text,
  cliente_nome text not null default '',
  cliente_documento text,
  cliente_telefone text,
  status text not null default 'rascunho' check (status in ('rascunho', 'enviado', 'aprovado', 'producao', 'finalizado', 'cancelado')),
  valor_total numeric(12,2) not null default 0,
  dados jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orcamentos_empresa_numero_unique unique (empresa_id, numero_pedido)
);

alter table public.orcamentos add column if not exists cliente_id uuid references public.clientes(id) on delete set null;
alter table public.orcamentos add column if not exists nome_orcamento text;
alter table public.orcamentos alter column loja_id drop not null;
alter table public.orcamentos alter column cliente_nome set default '';

create table if not exists public.orcamento_produtos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  orcamento_id uuid not null references public.orcamentos(id) on delete cascade,
  nome text not null,
  quantidade numeric(12,3) not null default 1,
  valor_unitario numeric(12,2) not null default 0,
  valor_total numeric(12,2) not null default 0,
  dados jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.controle_sistema (
  id uuid primary key default gen_random_uuid(),
  chave_hash text not null unique,
  pessoa uuid not null references public.usuarios(id) on delete cascade,
  empresa uuid not null references public.empresas(id) on delete cascade,
  valido_ate timestamptz not null,
  revogado_em timestamptz,
  ultimo_uso_em timestamptz,
  ip text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.eventos_auditoria (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete cascade,
  loja_id uuid references public.lojas(id) on delete set null,
  usuario_id uuid references public.usuarios(id) on delete set null,
  categoria text,
  acao text not null,
  recurso text,
  recurso_id text,
  entidade_tipo text,
  entidade_id uuid,
  resumo text,
  antes jsonb,
  depois jsonb,
  metadata jsonb not null default '{}'::jsonb,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.eventos_auditoria alter column categoria drop not null;
alter table public.eventos_auditoria add column if not exists recurso text;
alter table public.eventos_auditoria add column if not exists recurso_id text;
alter table public.eventos_auditoria add column if not exists antes jsonb;
alter table public.eventos_auditoria add column if not exists depois jsonb;
alter table public.eventos_auditoria add column if not exists ip text;
alter table public.eventos_auditoria add column if not exists user_agent text;

create index if not exists idx_lojas_empresa_id on public.lojas(empresa_id);
create index if not exists idx_usuarios_empresa_id on public.usuarios(empresa_id);
create index if not exists idx_usuarios_loja_id on public.usuarios(loja_id);
create index if not exists idx_clientes_empresa_id on public.clientes(empresa_id);
create index if not exists idx_clientes_loja_id on public.clientes(loja_id);
create index if not exists idx_orcamentos_empresa_loja on public.orcamentos(empresa_id, loja_id);
create index if not exists idx_orcamentos_empresa_cliente on public.orcamentos(empresa_id, cliente_id);
create index if not exists idx_orcamentos_status on public.orcamentos(status);
create index if not exists idx_orcamento_produtos_empresa_orcamento on public.orcamento_produtos(empresa_id, orcamento_id);
create index if not exists idx_controle_sistema_chave_hash on public.controle_sistema(chave_hash);
create index if not exists idx_controle_sistema_empresa on public.controle_sistema(empresa);
create index if not exists idx_eventos_empresa_id on public.eventos_auditoria(empresa_id);

alter table public.empresas enable row level security;
alter table public.lojas enable row level security;
alter table public.usuarios enable row level security;
alter table public.clientes enable row level security;
alter table public.orcamentos enable row level security;
alter table public.orcamento_produtos enable row level security;
alter table public.controle_sistema enable row level security;
alter table public.eventos_auditoria enable row level security;

create or replace function public.cadastro_empresa(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  empresa_nome text := btrim(coalesce(payload->>'empresa_nome', ''));
  loja_nome text := btrim(coalesce(payload->>'loja_nome', ''));
  usuario_nome text := btrim(coalesce(payload->>'nome', ''));
  usuario_email text := lower(btrim(coalesce(payload->>'email', '')));
  usuario_senha text := coalesce(payload->>'senha', '');
  empresa_slug text;
  loja_slug text;
  empresa_reg public.empresas%rowtype;
  loja_reg public.lojas%rowtype;
  usuario_reg public.usuarios%rowtype;
begin
  if length(empresa_nome) < 2 or length(loja_nome) < 2 or length(usuario_nome) < 2 or length(usuario_email) < 3 or length(usuario_senha) < 6 then
    raise exception 'Dados de cadastro invalidos';
  end if;

  empresa_slug := public.anodiza_slugify(empresa_nome);
  if empresa_slug is null then
    empresa_slug := 'empresa';
  end if;
  while exists (select 1 from public.empresas where slug = empresa_slug) loop
    empresa_slug := empresa_slug || '-' || substr(gen_random_uuid()::text, 1, 8);
  end loop;

  loja_slug := coalesce(public.anodiza_slugify(loja_nome), 'loja');

  insert into public.empresas (nome, slug)
  values (empresa_nome, empresa_slug)
  returning * into empresa_reg;

  insert into public.lojas (empresa_id, nome, slug)
  values (empresa_reg.id, loja_nome, loja_slug)
  returning * into loja_reg;

  insert into public.usuarios (empresa_id, loja_id, nome, email, senha_hash, perfil, ativo, permissoes)
  values (empresa_reg.id, loja_reg.id, usuario_nome, usuario_email, crypt(usuario_senha, gen_salt('bf')), 'owner', true, '{}'::jsonb)
  returning * into usuario_reg;

  return jsonb_build_object(
    'empresa_slug', empresa_reg.slug,
    'usuario', jsonb_build_object(
      'id', usuario_reg.id,
      'empresa_id', usuario_reg.empresa_id,
      'loja_id', usuario_reg.loja_id,
      'nome', usuario_reg.nome,
      'email', usuario_reg.email,
      'perfil', usuario_reg.perfil,
      'permissoes', usuario_reg.permissoes
    )
  );
end;
$$;

create or replace function public.login_empresa(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  empresa_slug text := btrim(coalesce(payload->>'empresa_slug', ''));
  usuario_email text := lower(btrim(coalesce(payload->>'email', '')));
  usuario_senha text := coalesce(payload->>'senha', '');
  empresa_reg public.empresas%rowtype;
  usuario_reg public.usuarios%rowtype;
begin
  select * into empresa_reg
  from public.empresas
  where slug = empresa_slug and status = 'ativa'
  limit 1;

  if not found then
    raise exception 'Credenciais invalidas';
  end if;

  select * into usuario_reg
  from public.usuarios
  where empresa_id = empresa_reg.id
    and lower(email) = usuario_email
    and ativo = true
  limit 1;

  if not found or usuario_reg.senha_hash <> crypt(usuario_senha, usuario_reg.senha_hash) then
    raise exception 'Credenciais invalidas';
  end if;

  update public.usuarios set ultimo_login_at = now() where id = usuario_reg.id;

  return jsonb_build_object(
    'empresa_slug', empresa_reg.slug,
    'usuario', jsonb_build_object(
      'id', usuario_reg.id,
      'empresa_id', usuario_reg.empresa_id,
      'loja_id', usuario_reg.loja_id,
      'nome', usuario_reg.nome,
      'email', usuario_reg.email,
      'perfil', usuario_reg.perfil,
      'permissoes', usuario_reg.permissoes
    )
  );
end;
$$;

create or replace function public.criar_usuario_empresa(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  empresa_slug text := btrim(coalesce(payload->>'empresa_slug', ''));
  usuario_nome text := btrim(coalesce(payload->>'nome', ''));
  usuario_email text := lower(btrim(coalesce(payload->>'email', '')));
  usuario_perfil text := coalesce(nullif(btrim(payload->>'perfil'), ''), 'vendedor');
  usuario_senha text := coalesce(payload->>'senha', '');
  empresa_reg public.empresas%rowtype;
  loja_reg public.lojas%rowtype;
  usuario_reg public.usuarios%rowtype;
begin
  if usuario_perfil not in ('admin', 'gerente', 'vendedor', 'producao', 'logistica', 'financeiro') then
    raise exception 'Perfil invalido';
  end if;

  if length(usuario_nome) < 2 or length(usuario_email) < 3 or length(usuario_senha) < 6 then
    raise exception 'Dados do usuario invalidos';
  end if;

  select * into empresa_reg
  from public.empresas
  where slug = empresa_slug and status = 'ativa'
  limit 1;

  if not found then
    raise exception 'Empresa nao encontrada';
  end if;

  select * into loja_reg
  from public.lojas
  where empresa_id = empresa_reg.id
  order by created_at asc
  limit 1;

  insert into public.usuarios (empresa_id, loja_id, nome, email, senha_hash, perfil, ativo, permissoes)
  values (empresa_reg.id, loja_reg.id, usuario_nome, usuario_email, crypt(usuario_senha, gen_salt('bf')), usuario_perfil, true, '{}'::jsonb)
  returning * into usuario_reg;

  return jsonb_build_object(
    'id', usuario_reg.id,
    'empresa_id', usuario_reg.empresa_id,
    'loja_id', usuario_reg.loja_id,
    'nome', usuario_reg.nome,
    'email', usuario_reg.email,
    'perfil', usuario_reg.perfil,
    'ativo', usuario_reg.ativo,
    'permissoes', usuario_reg.permissoes
  );
end;
$$;