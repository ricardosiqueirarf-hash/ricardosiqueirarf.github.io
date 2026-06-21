alter table public.orcamento_produtos
add column if not exists dados jsonb not null default '{}'::jsonb;
