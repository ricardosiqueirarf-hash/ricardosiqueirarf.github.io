create table if not exists public.produtos_configuraveis (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null,
  descricao text not null default '',
  ativo boolean not null default true,
  configuracao jsonb not null default '{"campos": [], "componentes": []}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint produtos_configuraveis_empresa_nome_unique unique (empresa_id, nome)
);

create index if not exists idx_produtos_configuraveis_empresa on public.produtos_configuraveis(empresa_id);
create index if not exists idx_produtos_configuraveis_empresa_ativo on public.produtos_configuraveis(empresa_id, ativo);

alter table public.produtos_configuraveis enable row level security;

drop trigger if exists set_produtos_configuraveis_updated_at on public.produtos_configuraveis;
create trigger set_produtos_configuraveis_updated_at
before update on public.produtos_configuraveis
for each row execute function public.set_updated_at();
