create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null,
  descricao text not null default '',
  categorias_aplicaveis jsonb not null default '[]'::jsonb,
  ativo boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tags_empresa_nome_unique unique (empresa_id, nome)
);

create table if not exists public.material_tags (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  material_id uuid not null references public.materiais(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint material_tags_unique unique (empresa_id, material_id, tag_id)
);

create table if not exists public.tag_regras (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null,
  descricao text not null default '',
  categoria_a text not null,
  tag_ids_a jsonb not null default '[]'::jsonb,
  categoria_b text not null,
  tag_ids_b jsonb not null default '[]'::jsonb,
  operador text not null default 'contem_todas' check (operador in ('contem_todas', 'contem_qualquer')),
  cobranca_nome text not null default '',
  unidade_calculo text not null default 'unidade' check (unidade_calculo in ('unidade', 'metro_linear', 'metro_quadrado', 'kit', 'par')),
  valor_unitario numeric(12,2) not null default 0,
  ativo boolean not null default true,
  configuracao jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tag_regras_empresa_nome_unique unique (empresa_id, nome),
  constraint tag_regras_categoria_a_check check (categoria_a in ('perfil', 'vidro', 'puxador', 'insumo', 'trilho', 'componente', 'outro')),
  constraint tag_regras_categoria_b_check check (categoria_b in ('perfil', 'vidro', 'puxador', 'insumo', 'trilho', 'componente', 'outro'))
);

create index if not exists idx_tags_empresa on public.tags(empresa_id);
create index if not exists idx_material_tags_empresa_material on public.material_tags(empresa_id, material_id);
create index if not exists idx_material_tags_empresa_tag on public.material_tags(empresa_id, tag_id);
create index if not exists idx_tag_regras_empresa on public.tag_regras(empresa_id);

alter table public.tags enable row level security;
alter table public.material_tags enable row level security;
alter table public.tag_regras enable row level security;

drop trigger if exists set_tags_updated_at on public.tags;
create trigger set_tags_updated_at
before update on public.tags
for each row execute function public.set_updated_at();

drop trigger if exists set_tag_regras_updated_at on public.tag_regras;
create trigger set_tag_regras_updated_at
before update on public.tag_regras
for each row execute function public.set_updated_at();
