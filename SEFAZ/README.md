# SEFAZ — MVP de comunicação direta

Esta pasta é para um MVP de teste direto com a SEFAZ, começando pelo caminho mais seguro: consultar o status do serviço em homologação antes de tentar autorizar uma NF-e.

## Objetivo do MVP

Validar que o sistema consegue:

1. carregar o certificado digital A1 da empresa;
2. montar uma requisição SOAP compatível com NF-e 4.00;
3. comunicar com um webservice da SEFAZ em homologação;
4. registrar request/response para auditoria;
5. evoluir depois para envio de lote de NF-e em homologação.

## O que NÃO deve entrar no repositório

Nunca commitar:

- certificado `.pfx` ou `.pem`;
- senha do certificado;
- chave privada;
- XML real de cliente;
- dados reais de CPF/CNPJ sem necessidade.

Use `.env` local e mantenha os certificados fora do GitHub.

## Fluxo recomendado

### Fase 1 — Comunicação básica

Endpoint-alvo: `NfeStatusServico4`.

Motivo: testa certificado, TLS, SOAP e endpoint sem emitir nota.

Resultado esperado:

- resposta XML da SEFAZ;
- código de status;
- motivo/status textual;
- log salvo localmente.

### Fase 2 — XML de NF-e em homologação

Depois do status funcionar:

1. montar XML mínimo de NF-e a partir de um pedido de teste;
2. assinar XML com certificado A1;
3. validar XML contra XSD;
4. enviar lote para `NFeAutorizacao4` em homologação;
5. consultar recibo em `NFeRetAutorizacao4`;
6. salvar chave, protocolo, XML autorizado e retorno.

### Fase 3 — Integração com pedidos aprovados

Fluxo final:

```text
Pedido aprovado
↓
NF-e.html lista pedidos aprovados
↓
usuário escolhe pedido de teste
↓
backend gera XML em homologação
↓
SEFAZ retorna autorização/rejeição
↓
sistema salva status fiscal no pedido
```

## Arquivos desta pasta

- `.env.example`: variáveis necessárias para teste local.
- `requirements.txt`: dependências iniciais.
- `sefaz_status_test.py`: teste SOAP para consultar status do serviço.
- `payloads/status_servico_soap.xml`: template SOAP do status de serviço.
- `schemas/README.md`: local para colocar XSDs oficiais da NF-e.

## Próximo passo técnico

1. confirmar o endpoint atual de homologação da UF/autorizador usado pela empresa;
2. colocar certificado A1 localmente;
3. preencher `.env` baseado em `.env.example`;
4. rodar `python sefaz_status_test.py`;
5. só depois partir para XML de emissão.

## Observação fiscal

Este MVP é técnico. Antes de emissão real em produção, o contador precisa validar CFOP, NCM, CSOSN/CST, CRT, natureza da operação, impostos e regra de venda/instalação.
