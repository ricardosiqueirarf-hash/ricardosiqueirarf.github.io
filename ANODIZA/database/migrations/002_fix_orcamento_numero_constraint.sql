alter table if exists public.orcamentos
drop constraint if exists orcamentos_empresa_numero_unique;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orcamentos_empresa_cliente_numero_unique'
      and conrelid = 'public.orcamentos'::regclass
  ) then
    alter table public.orcamentos
    add constraint orcamentos_empresa_cliente_numero_unique
    unique (empresa_id, cliente_id, numero_pedido);
  end if;
end;
$$;
