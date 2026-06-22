create table if not exists public.produtos_globais_empresa (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  produto_chave text not null,
  ativo boolean not null default true,
  configuracao jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, produto_chave)
);

create index if not exists idx_produtos_globais_empresa on public.produtos_globais_empresa(empresa_id, produto_chave);

alter table public.produtos_globais_empresa enable row level security;

drop policy if exists produtos_globais_empresa_service_all on public.produtos_globais_empresa;
create policy produtos_globais_empresa_service_all on public.produtos_globais_empresa
for all using (true) with check (true);

create or replace function public.set_produtos_globais_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_produtos_globais_updated_at on public.produtos_globais_empresa;
create trigger trg_produtos_globais_updated_at
before update on public.produtos_globais_empresa
for each row execute function public.set_produtos_globais_updated_at();
