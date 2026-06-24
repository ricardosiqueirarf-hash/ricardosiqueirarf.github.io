-- Estrutura base para integracoes externas do ANODIZA.
-- Exemplo inicial: Conta Azul.

create table if not exists public.empresa_api_integracoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  provider text not null,
  status text not null default 'desconectada' check (status in ('desconectada', 'conectada', 'expirada', 'erro')),
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  settings jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint empresa_api_integracoes_empresa_provider_unique unique (empresa_id, provider)
);

create table if not exists public.external_api_mappings (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  provider text not null,
  entity_type text not null,
  entity_id text not null,
  external_entity_type text not null,
  external_id text not null,
  external_reference text,
  payload_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_api_mappings_unique unique (empresa_id, provider, entity_type, entity_id, external_entity_type)
);

create table if not exists public.external_api_sync_logs (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete cascade,
  provider text not null,
  action text not null,
  status text not null check (status in ('pendente', 'sucesso', 'erro', 'ignorado')),
  entity_type text,
  entity_id text,
  external_entity_type text,
  external_id text,
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_empresa_api_integracoes_empresa on public.empresa_api_integracoes(empresa_id);
create index if not exists idx_empresa_api_integracoes_provider on public.empresa_api_integracoes(provider);

create index if not exists idx_external_api_mappings_empresa_provider on public.external_api_mappings(empresa_id, provider);
create index if not exists idx_external_api_mappings_entity on public.external_api_mappings(entity_type, entity_id);
create index if not exists idx_external_api_mappings_external on public.external_api_mappings(external_entity_type, external_id);

create index if not exists idx_external_api_sync_logs_empresa_provider on public.external_api_sync_logs(empresa_id, provider);
create index if not exists idx_external_api_sync_logs_entity on public.external_api_sync_logs(entity_type, entity_id);
create index if not exists idx_external_api_sync_logs_created_at on public.external_api_sync_logs(created_at desc);

alter table public.empresa_api_integracoes enable row level security;
alter table public.external_api_mappings enable row level security;
alter table public.external_api_sync_logs enable row level security;

drop trigger if exists set_updated_at_empresa_api_integracoes on public.empresa_api_integracoes;
create trigger set_updated_at_empresa_api_integracoes
before update on public.empresa_api_integracoes
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_external_api_mappings on public.external_api_mappings;
create trigger set_updated_at_external_api_mappings
before update on public.external_api_mappings
for each row execute function public.set_updated_at();
