alter table public.eventos_auditoria alter column categoria drop not null;
alter table public.eventos_auditoria add column if not exists recurso text;
alter table public.eventos_auditoria add column if not exists recurso_id text;
alter table public.eventos_auditoria add column if not exists antes jsonb;
alter table public.eventos_auditoria add column if not exists depois jsonb;
alter table public.eventos_auditoria add column if not exists ip text;
alter table public.eventos_auditoria add column if not exists user_agent text;
