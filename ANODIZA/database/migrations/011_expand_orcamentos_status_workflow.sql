-- Expande o workflow de status dos pedidos/orcamentos do ANODIZA.
-- Mantem compatibilidade com status antigos e adiciona os novos passos:
-- rascunho/orcamento -> aprovado -> producao -> separado -> entregue.

alter table public.orcamentos
  drop constraint if exists orcamentos_status_check;

alter table public.orcamentos
  add constraint orcamentos_status_check
  check (status in (
    'rascunho',
    'enviado',
    'aprovado',
    'producao',
    'separado',
    'entregue',
    'finalizado',
    'cancelado'
  ));

update public.orcamentos
set status = 'rascunho'
where status in ('orcamento', 'orçamento')
  and status not in ('rascunho', 'enviado', 'aprovado', 'producao', 'separado', 'entregue', 'finalizado', 'cancelado');

update public.orcamentos
set status = 'producao'
where status in ('em_producao', 'em_produção', 'em produção')
  and status not in ('rascunho', 'enviado', 'aprovado', 'producao', 'separado', 'entregue', 'finalizado', 'cancelado');
