# Deploy no Render — SEFAZ Homologação

Este app é um MVP Flask para testar comunicação com a SEFAZ em homologação.

## Opção recomendada: Web Service manual

No Render:

```text
New > Web Service
Repository: ricardosiqueirarf-hash/ricardosiqueirarf.github.io
Root Directory: SEFAZ
Runtime/Language: Python 3
Build Command: pip install -r requirements.txt
Start Command: gunicorn sefaz_test_server:app
Health Check Path: /healthz
```

A documentação do Render para Flask recomenda instalar dependências com `pip install -r requirements.txt` e iniciar com Gunicorn no formato `gunicorn app:app`. Neste projeto, o módulo é `sefaz_test_server` e a variável Flask é `app`, portanto o start command fica `gunicorn sefaz_test_server:app`.

## Variáveis de ambiente

Configure no painel do Render:

```text
SEFAZ_AMBIENTE=homologacao
SEFAZ_TP_AMB=2
SEFAZ_UF=CE
SEFAZ_CUF=23
SEFAZ_STATUS_URL=<endpoint homologacao NfeStatusServico4>
SEFAZ_TEST_TOKEN=<token forte para proteger a tela>
```

Para certificado:

```text
SEFAZ_CERT_PEM_PATH=/etc/secrets/cert.pem
SEFAZ_KEY_PEM_PATH=/etc/secrets/key.pem
```

Use Secret Files do Render, ou outra forma segura de materializar os arquivos PEM no ambiente. Nunca commit certificados no GitHub.

## URLs depois do deploy

```text
/          -> tela HTML de teste
/healthz   -> health check
/api/sefaz/status/payload -> pré-visualiza SOAP
/api/sefaz/status         -> consulta status na SEFAZ
```

## Segurança mínima

- Este serviço deve ficar apenas para homologação.
- Configure `SEFAZ_TEST_TOKEN`.
- Não exponha certificado no front-end.
- Não use dados reais de cliente nesse MVP.
- Não mude `SEFAZ_TP_AMB` para produção neste projeto de teste.
