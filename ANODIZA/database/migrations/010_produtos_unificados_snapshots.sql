-- Evolucao incremental para unificar produtos locais/globais, adicionar versoes e preparar snapshots completos.
-- Esta migration nao remove nem quebra produtos_configuraveis/produtos_globais_empresa.
-- O backend pode continuar usando as tabelas antigas enquanto migra gradualmente para as novas.

create table if not exists public.produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text not null default '',
  empresa_id uuid references public.empresas(id) on delete cascade,
  is_global boolean not null default false,
  origem_produto_id uuid references public.produtos(id) on delete set null,
  status text not null default 'ativo' check (status in ('rascunho', 'ativo', 'inativo', 'arquivado')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint produtos_escopo_check check (
    (is_global = true and empresa_id is null)
    or
    (is_global = false and empresa_id is not null)
  )
);

create unique index if not exists produtos_local_empresa_nome_unique
on public.produtos (empresa_id, lower(nome))
where is_global = false;

create unique index if not exists produtos_global_nome_unique
on public.produtos (lower(nome))
where is_global = true;

create index if not exists idx_produtos_empresa on public.produtos(empresa_id);
create index if not exists idx_produtos_global_status on public.produtos(is_global, status);
create index if not exists idx_produtos_origem on public.produtos(origem_produto_id);

create table if not exists public.produto_versoes (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos(id) on delete cascade,
  numero_versao integer not null,
  configuracao jsonb not null default '{}'::jsonb,
  status text not null default 'rascunho' check (status in ('rascunho', 'publicada', 'arquivada')),
  created_by uuid references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint produto_versoes_produto_numero_unique unique (produto_id, numero_versao)
);

create unique index if not exists produto_versoes_publicada_unica
on public.produto_versoes(produto_id)
where status = 'publicada';

create index if not exists idx_produto_versoes_produto_status on public.produto_versoes(produto_id, status);

create table if not exists public.empresa_produtos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  produto_id uuid not null references public.produtos(id) on delete cascade,
  ativo boolean not null default true,
  configuracao_override jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint empresa_produtos_empresa_produto_unique unique (empresa_id, produto_id)
);

create index if not exists idx_empresa_produtos_empresa on public.empresa_produtos(empresa_id, ativo);
create index if not exists idx_empresa_produtos_produto on public.empresa_produtos(produto_id);

alter table public.orcamento_produtos
  add column if not exists produto_id uuid references public.produtos(id) on delete set null,
  add column if not exists produto_versao_id uuid references public.produto_versoes(id) on delete set null,
  add column if not exists produto_origem text check (produto_origem in ('global', 'local', 'manual')),
  add column if not exists calculo_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists configuracao_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists materiais_snapshot jsonb not null default '[]'::jsonb,
  add column if not exists custo_total numeric(12,2),
  add column if not exists margem_total numeric(12,2),
  add column if not exists margem_percentual numeric(8,2);

create index if not exists idx_orcamento_produtos_produto on public.orcamento_produtos(produto_id);
create index if not exists idx_orcamento_produtos_produto_versao on public.orcamento_produtos(produto_versao_id);
create index if not exists idx_orcamento_produtos_origem on public.orcamento_produtos(produto_origem);

-- Campos de ponte para migrar produtos_configuraveis sem quebrar o MVP atual.
alter table public.produtos_configuraveis
  add column if not exists produto_id uuid references public.produtos(id) on delete set null,
  add column if not exists produto_versao_id uuid references public.produto_versoes(id) on delete set null;

create index if not exists idx_produtos_configuraveis_produto_id on public.produtos_configuraveis(produto_id);

-- Backfill inicial: cada produto_configuravel local vira produto unificado local + versao 1 publicada.
insert into public.produtos (id, nome, descricao, empresa_id, is_global, status, metadata, created_at, updated_at)
select
  gen_random_uuid(),
  pc.nome,
  pc.descricao,
  pc.empresa_id,
  false,
  case when pc.ativo then 'ativo' else 'inativo' end,
  jsonb_build_object('legacy_produtos_configuraveis_id', pc.id),
  pc.created_at,
  pc.updated_at
from public.produtos_configuraveis pc
where pc.produto_id is null
  and not exists (
    select 1
    from public.produtos p
    where p.is_global = false
      and p.empresa_id = pc.empresa_id
      and lower(p.nome) = lower(pc.nome)
  );

update public.produtos_configuraveis pc
set produto_id = p.id
from public.produtos p
where pc.produto_id is null
  and p.is_global = false
  and p.empresa_id = pc.empresa_id
  and lower(p.nome) = lower(pc.nome);

insert into public.produto_versoes (produto_id, numero_versao, configuracao, status, published_at, metadata, created_at)
select
  pc.produto_id,
  1,
  pc.configuracao,
  'publicada',
  coalesce(pc.updated_at, pc.created_at, now()),
  jsonb_build_object('legacy_produtos_configuraveis_id', pc.id),
  pc.created_at
from public.produtos_configuraveis pc
where pc.produto_id is not null
  and pc.produto_versao_id is null
  and not exists (
    select 1 from public.produto_versoes pv
    where pv.produto_id = pc.produto_id and pv.numero_versao = 1
  );

update public.produtos_configuraveis pc
set produto_versao_id = pv.id
from public.produto_versoes pv
where pc.produto_versao_id is null
  and pv.produto_id = pc.produto_id
  and pv.numero_versao = 1;

alter table public.produtos enable row level security;
alter table public.produto_versoes enable row level security;
alter table public.empresa_produtos enable row level security;

drop policy if exists produtos_service_all on public.produtos;
create policy produtos_service_all on public.produtos for all using (true) with check (true);

drop policy if exists produto_versoes_service_all on public.produto_versoes;
create policy produto_versoes_service_all on public.produto_versoes for all using (true) with check (true);

drop policy if exists empresa_produtos_service_all on public.empresa_produtos;
create policy empresa_produtos_service_all on public.empresa_produtos for all using (true) with check (true);

drop trigger if exists set_produtos_updated_at on public.produtos;
create trigger set_produtos_updated_at
before update on public.produtos
for each row execute function public.set_updated_at();

drop trigger if exists set_empresa_produtos_updated_at on public.empresa_produtos;
create trigger set_empresa_produtos_updated_at
before update on public.empresa_produtos
for each row execute function public.set_updated_at();
