# Integracao Conta Azul

Este modulo estuda e prepara a integracao do ANODIZA com a Conta Azul.

O foco inicial e simples e objetivo:

> Quando um orcamento for aprovado no ANODIZA, comunicar para a Conta Azul quem comprou e o que foi vendido.

## Contexto da integracao

A Conta Azul deve funcionar como ERP/financeiro externo da empresa cliente do ANODIZA.

O ANODIZA nao deve depender da Conta Azul para calcular porta, produto, custo ou margem. O ANODIZA calcula e aprova. A Conta Azul recebe a venda ja consolidada.

## Fluxo ideal da fase 1

```text
Empresa conecta sua conta Conta Azul no ANODIZA
  -> ANODIZA salva tokens da empresa
  -> Usuario aprova orcamento
  -> ANODIZA monta contrato interno de venda aprovada
  -> Modulo Conta Azul cria/atualiza pessoa
  -> Modulo Conta Azul cria venda
  -> ANODIZA salva o ID externo da venda
  -> ANODIZA registra log de sucesso ou falha
```

## Dados minimos que precisam sair do ANODIZA

### Cliente / comprador

- nome;
- documento, quando existir;
- telefone, quando existir;
- email, quando existir;
- endereco, futuramente.

### Venda

- ID interno do orcamento;
- numero do pedido/orcamento;
- nome do orcamento;
- data de aprovacao;
- valor total;
- itens vendidos;
- vendedor/usuario que aprovou;
- observacoes.

### Itens vendidos

Para a primeira fase, nao e necessario mandar cada parafuso, vidro, perfil e componente.

O recomendado e enviar itens comerciais consolidados, por exemplo:

- Porta de aluminio e vidro sob medida;
- Porta deslizante sob medida;
- Estrutura de aluminio sob medida;
- Closet sob medida;
- Adega de aluminio e vidro sob medida.

O detalhamento tecnico permanece no ANODIZA.

## Decisao de produto

A integracao deve ser vendida como modulo adicional:

> Integracao Conta Azul: envie automaticamente clientes e vendas aprovadas do ANODIZA para o ERP financeiro da sua empresa.

## O que entra no MVP

1. Botao `Conectar Conta Azul` por empresa.
2. Fluxo OAuth por empresa cliente.
3. Criar/atualizar pessoa na Conta Azul.
4. Criar venda a partir de orcamento aprovado.
5. Registrar vinculo entre `orcamento_id` e `conta_azul_sale_id`.
6. Registrar logs detalhados de erro.

## O que fica para depois

1. Criar contas a receber/parcelas.
2. Consultar status financeiro.
3. Consultar notas fiscais vinculadas.
4. Baixar PDF de venda/nota.
5. Sincronizar produtos de forma mais detalhada.
6. Criar fila de retry para tentativas automaticas.

## Riscos tecnicos

- Cada empresa precisa autorizar sua propria conta Conta Azul.
- Tokens devem ser salvos por empresa, nunca globais.
- O access token expira e precisa de refresh token.
- A venda nao deve ser duplicada se o usuario clicar mais de uma vez.
- O sistema precisa salvar logs de request/response sem expor token.
- O ANODIZA deve continuar funcionando mesmo se a Conta Azul estiver fora do ar.

## Regra anti-duplicidade

Antes de criar uma venda na Conta Azul, o modulo deve verificar se ja existe mapeamento:

```text
provider = conta_azul
entity_type = orcamento
entity_id = <orcamento_id>
external_entity_type = sale
```

Se ja existir, nao cria outra venda. Apenas retorna o vinculo existente ou permite reprocessamento manual.

## Mapeamento inicial

| ANODIZA | Conta Azul | Observacao |
|---|---|---|
| clientes.nome | pessoa.nome | comprador |
| clientes.documento | pessoa.documento | CPF/CNPJ quando existir |
| clientes.email | pessoa.email | opcional |
| clientes.telefone | pessoa.telefone | opcional |
| orcamentos.id | venda.codigo externo/origem | rastreabilidade |
| orcamentos.numero_pedido | venda.numero/referencia | visivel ao usuario |
| orcamentos.valor_total | venda.valor_total | total aprovado |
| orcamento_produtos.nome | item.nome | item comercial |
| orcamento_produtos.quantidade | item.quantidade | quantidade comercial |
| orcamento_produtos.valor_unitario | item.valor_unitario | preco unitario |
| orcamento_produtos.valor_total | item.valor_total | total da linha |

## Contrato interno recomendado

Antes de pensar no payload exato da Conta Azul, o ANODIZA deve criar um contrato interno unico:

```json
{
  "empresa_id": "uuid",
  "orcamento_id": "uuid",
  "numero_pedido": "1520",
  "aprovado_em": "2026-06-23T12:00:00Z",
  "cliente": {
    "id": "uuid",
    "nome": "Cliente Exemplo",
    "documento": "",
    "email": "",
    "telefone": ""
  },
  "venda": {
    "nome": "Orcamento 1520",
    "valor_total": 4800.00,
    "observacoes": "Venda originada no ANODIZA"
  },
  "itens": [
    {
      "nome": "Porta de aluminio e vidro sob medida",
      "quantidade": 1,
      "valor_unitario": 4800.00,
      "valor_total": 4800.00
    }
  ]
}
```

A partir desse contrato, cada integracao monta seu proprio payload.

## Principio arquitetural

O ANODIZA fala assim:

```text
orcamento aprovado -> venda aprovada
```

A Conta Azul fala assim:

```text
pessoa + venda + financeiro
```

O modulo `conta_azul` e o tradutor entre essas duas linguagens.
