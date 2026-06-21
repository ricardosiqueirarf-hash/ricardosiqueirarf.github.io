create table if not exists public.materiais (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  categoria text not null default 'insumo' check (categoria in ('perfil', 'vidro', 'puxador', 'insumo', 'trilho', 'componente', 'outro')),
  nome text not null,
  codigo text not null default '',
  unidade text not null default 'unidade' check (unidade in ('unidade', 'metro_linear', 'metro_quadrado', 'kit', 'par')),
  custo_unitario numeric(12,2) not null default 0,
  margem_percentual numeric(8,2) not null default 0,
  perda_percentual numeric(8,2) not null default 0,
  preco_unitario numeric(12,2) not null default 0,
  ativo boolean not null default true,
  configuracao jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint materiais_empresa_categoria_nome_unique unique (empresa_id, categoria, nome)
);

create index if not exists idx_materiais_empresa_categoria on public.materiais(empresa_id, categoria);
create index if not exists idx_materiais_empresa_ativo on public.materiais(empresa_id, ativo);

alter table public.materiais enable row level security;

drop trigger if exists set_materiais_updated_at on public.materiais;
create trigger set_materiais_updated_at
before update on public.materiais
for each row execute function public.set_updated_at();
