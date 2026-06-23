# APIs externas do ANODIZA

Esta pasta concentra os modulos de integracao com APIs externas usadas pelas empresas que contratarem o ANODIZA.

O objetivo desta camada nao e substituir o nucleo do sistema. O nucleo do ANODIZA continua sendo orcamento tecnico, produtos, clientes, lojas, usuarios, aprovacao e producao. Esta pasta apenas comunica eventos relevantes para sistemas externos.

## Regra principal

Cada integracao deve ser um modulo independente.

Exemplo:

```text
external_apis/
  conta_azul/
  asaas/
  whatsapp/
  nfe/
  bancos/
```

Cada modulo deve ter seus proprios contratos, mapeadores, cliente HTTP, servico e documentacao.

## Fluxo padrao

```text
Evento interno do ANODIZA
  -> contrato interno padronizado
  -> mapper da integracao
  -> chamada para API externa
  -> salvamento de vinculo externo
  -> log de sincronizacao
```

## O que nao deve ficar aqui

- Calculo de porta.
- Calculo de custo.
- Regra de margem.
- Regra de producao.
- Cadastro principal de cliente.
- Regra comercial do ANODIZA.

Essas regras pertencem ao core do sistema.

## O que deve ficar aqui

- Autenticacao com APIs externas.
- Conversao de dados internos para payload externo.
- Envio de vendas, clientes, cobrancas ou notas.
- Consulta de status externo.
- Logs de sincronizacao.
- Tratamento de erro de integracao.

## Primeiro modulo estudado

O primeiro modulo e `conta_azul`, com foco em comunicar:

1. quem comprou;
2. o que foi vendido;
3. quanto foi vendido;
4. qual orcamento do ANODIZA originou a venda;
5. quais parcelas/recebiveis devem ser gerados depois.
