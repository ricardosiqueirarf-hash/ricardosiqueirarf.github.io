# Exportação de preços para o Promob

## Estrutura mínima das tabelas (base)

### materiais
Usada para insumos gerais.

| Campo | Tipo | Observações |
| --- | --- | --- |
| id | uuid | PK |
| nome | text | Nome comercial |
| tipo_medida | text | M2, ML, UN |
| custo | numeric | Custo base |
| margem | numeric | % |
| perda | numeric | % |
| preco | numeric | Preço final calculado |
| ativo | boolean | Default true |
| criado_em | timestamptz | Auditoria |

### vidros
Materiais por metro quadrado.

| Campo | Tipo | Observações |
| --- | --- | --- |
| id | uuid | PK |
| tipo | text | Ex: Reflecta prata |
| espessura | numeric | mm |
| custo | numeric | Custo base |
| margem | numeric | % |
| perda | numeric | % |
| preco | numeric | Preço final calculado |
| ativo | boolean | Default true |
| criado_em | timestamptz | Auditoria |

### perfis
Materiais por metro linear.

| Campo | Tipo | Observações |
| --- | --- | --- |
| id | uuid | PK |
| nome | text | Nome comercial |
| custo | numeric | Custo base |
| margem | numeric | % |
| perda | numeric | % |
| preco | numeric | Preço final calculado |
| tipologias | jsonb | Ligações comerciais |
| insumos | jsonb | Insumos vinculados |
| ativo | boolean | Default true |
| criado_em | timestamptz | Auditoria |

### puxadores
Materiais por unidade (ou outro tipo de medida).

| Campo | Tipo | Observações |
| --- | --- | --- |
| id | uuid | PK |
| nome | text | Nome comercial |
| tipo_medida | text | UN (ou ML quando aplicável) |
| custo | numeric | Custo base |
| margem | numeric | % |
| perda | numeric | % |
| preco | numeric | Preço final calculado |
| ativo | boolean | Default true |
| criado_em | timestamptz | Auditoria |

## Estrutura extensível (preços por tabela/cliente)

### tabelas_preco

| Campo | Tipo | Observações |
| --- | --- | --- |
| id | uuid | PK |
| codigo | text | Ex: A, B, VIP |
| descricao | text | Nome comercial |
| ativo | boolean | Default true |
| criado_em | timestamptz | Auditoria |

### clientes

| Campo | Tipo | Observações |
| --- | --- | --- |
| id | uuid | PK |
| nome | text | Razão social |
| tabela_preco_id | uuid | FK tabelas_preco |
| ativo | boolean | Default true |
| criado_em | timestamptz | Auditoria |

### precos_materiais
Armazena preços finais específicos por tabela ou cliente, mantendo o SKU estável.

| Campo | Tipo | Observações |
| --- | --- | --- |
| id | uuid | PK |
| sku | text | SKU comercial fixo |
| material_tipo | text | vidros, perfis, puxadores, materiais |
| material_id | uuid | ID da tabela de origem |
| tabela_preco_id | uuid | FK tabelas_preco (opcional) |
| cliente_id | uuid | FK clientes (opcional) |
| preco | numeric | Preço final calculado |
| ativo | boolean | Default true |
| criado_em | timestamptz | Auditoria |

## Fluxo de exportação

1. Ler preços finais das tabelas base (ou de `precos_materiais` quando houver).
2. Gerar SKU estável a partir do tipo + descrição.
3. Normalizar a unidade (M2, ML, UN).
4. Gerar CSV no formato Promob.
