from typing import Any

from app.external_apis.conta_azul.client import criar_venda, obter_ou_criar_pessoa, proximo_numero_venda
from app.external_apis.conta_azul.contracts import ApprovedSale, ExternalApiResult
from app.external_apis.conta_azul.mapper import (
    build_approved_sale_contract,
    to_conta_azul_person_payload,
    to_conta_azul_sale_payload,
)
from app.external_apis.conta_azul.repository import (
    PROVIDER,
    access_token_da_integracao,
    buscar_integracao,
    buscar_mapping,
    registrar_log,
    salvar_mapping,
    settings_da_integracao,
)
from app.repositories import pedidos_repo


class ContaAzulIntegrationNotConfiguredError(RuntimeError):
    """Erro usado quando a empresa ainda nao conectou sua conta Conta Azul."""


class ContaAzulService:
    """Servico de orquestracao da integracao Conta Azul por empresa.

    Modelo inspirado na integracao Asaas antiga, mas com uma diferenca central:
    as credenciais e configuracoes pertencem a cada empresa cliente do ANODIZA.
    """

    def __init__(self, empresa_id: str):
        self.empresa_id = empresa_id

    def status(self) -> dict[str, Any]:
        integracao = buscar_integracao(self.empresa_id)
        settings = settings_da_integracao(integracao)
        return {
            "provider": PROVIDER,
            "configured": bool(integracao),
            "connected": bool(integracao and integracao.get("status") == "conectada" and access_token_da_integracao(integracao)),
            "status": (integracao or {}).get("status") or "desconectada",
            "has_access_token": bool(access_token_da_integracao(integracao)),
            "has_default_item_id": bool(settings.get("default_item_id")),
            "settings": {
                "default_item_id": settings.get("default_item_id") or "",
                "tipo_pagamento": settings.get("tipo_pagamento") or "SEM_PAGAMENTO",
                "opcao_condicao_pagamento": settings.get("opcao_condicao_pagamento") or "À vista",
            },
        }

    def _get_active_integration(self) -> tuple[str, dict[str, Any]]:
        integracao = buscar_integracao(self.empresa_id)
        if not integracao or integracao.get("status") != "conectada":
            raise ContaAzulIntegrationNotConfiguredError("Conta Azul nao conectada para esta empresa.")
        access_token = access_token_da_integracao(integracao)
        if not access_token:
            raise ContaAzulIntegrationNotConfiguredError("Access token da Conta Azul ausente para esta empresa.")
        settings = settings_da_integracao(integracao)
        if not settings.get("default_item_id"):
            raise ContaAzulIntegrationNotConfiguredError(
                "default_item_id nao configurado. Cadastre um produto/servico padrao na Conta Azul e salve o ID na integracao."
            )
        return access_token, settings

    def build_sale_from_orcamento(self, orcamento_id: str) -> ApprovedSale:
        orcamento = pedidos_repo.buscar(self.empresa_id, orcamento_id)
        if not orcamento:
            raise ValueError("Orcamento nao encontrado para exportar para Conta Azul.")
        if str(orcamento.get("status") or "") != "aprovado":
            raise ValueError("Somente orcamentos aprovados devem ser exportados para Conta Azul.")
        linhas = pedidos_repo.listar_linhas(self.empresa_id, orcamento_id, limit=5000, offset=0)
        return build_approved_sale_contract(orcamento, linhas)

    def export_orcamento(self, orcamento_id: str) -> ExternalApiResult:
        sale = self.build_sale_from_orcamento(orcamento_id)
        return self.export_approved_sale(sale)

    def export_approved_sale(self, sale: ApprovedSale) -> ExternalApiResult:
        """Exporta uma venda aprovada para a Conta Azul.

        Fluxo:
        1. verifica integracao ativa da empresa;
        2. evita duplicidade de venda;
        3. cria/obtem pessoa na Conta Azul;
        4. cria venda na Conta Azul;
        5. salva mapeamentos e log.
        """

        existente = buscar_mapping(self.empresa_id, "orcamento", sale.orcamento_id, "sale")
        if existente:
            return ExternalApiResult(
                success=True,
                provider=PROVIDER,
                action="export_approved_sale",
                external_id=str(existente.get("external_id") or ""),
                message="Orcamento ja exportado para Conta Azul. Nenhuma venda duplicada foi criada.",
                raw_response={"mapping": existente},
            )

        access_token, settings = self._get_active_integration()
        request_log: dict[str, Any] = {}

        try:
            pessoa_mapping = buscar_mapping(self.empresa_id, "cliente", sale.cliente.id, "person") if sale.cliente.id else None
            if pessoa_mapping:
                pessoa = {"id": pessoa_mapping.get("external_id")}
            else:
                pessoa_payload = to_conta_azul_person_payload(sale)
                request_log["person_payload"] = pessoa_payload
                pessoa = obter_ou_criar_pessoa(access_token, pessoa_payload)
                pessoa_id = str(pessoa.get("id") or "")
                if not pessoa_id:
                    raise ValueError("Conta Azul nao retornou ID da pessoa.")
                if sale.cliente.id:
                    salvar_mapping(
                        self.empresa_id,
                        entity_type="cliente",
                        entity_id=sale.cliente.id,
                        external_entity_type="person",
                        external_id=pessoa_id,
                        external_reference=sale.cliente.documento or sale.cliente.nome,
                        payload_snapshot=pessoa,
                    )

            pessoa_id = str(pessoa.get("id") or "")
            numero_venda = proximo_numero_venda(access_token)
            venda_payload = to_conta_azul_sale_payload(
                sale,
                conta_azul_customer_id=pessoa_id,
                conta_azul_item_id=str(settings["default_item_id"]),
                numero_venda=numero_venda,
                tipo_pagamento=str(settings.get("tipo_pagamento") or "SEM_PAGAMENTO"),
                opcao_condicao_pagamento=str(settings.get("opcao_condicao_pagamento") or "À vista"),
            )
            request_log["sale_payload"] = venda_payload
            venda = criar_venda(access_token, venda_payload)
            venda_id = str(venda.get("id") or venda.get("id_legado") or "")
            if not venda_id:
                raise ValueError("Conta Azul nao retornou ID da venda.")

            salvar_mapping(
                self.empresa_id,
                entity_type="orcamento",
                entity_id=sale.orcamento_id,
                external_entity_type="sale",
                external_id=venda_id,
                external_reference=sale.numero_pedido,
                payload_snapshot=venda,
            )
            registrar_log(
                self.empresa_id,
                action="export_approved_sale",
                status="sucesso",
                entity_type="orcamento",
                entity_id=sale.orcamento_id,
                external_entity_type="sale",
                external_id=venda_id,
                request_payload=request_log,
                response_payload={"person": pessoa, "sale": venda},
            )
            return ExternalApiResult(
                success=True,
                provider=PROVIDER,
                action="export_approved_sale",
                external_id=venda_id,
                message="Venda exportada para Conta Azul com sucesso.",
                raw_response={"person": pessoa, "sale": venda},
            )
        except Exception as exc:
            registrar_log(
                self.empresa_id,
                action="export_approved_sale",
                status="erro",
                entity_type="orcamento",
                entity_id=sale.orcamento_id,
                request_payload=request_log,
                error_message=str(exc),
            )
            raise
