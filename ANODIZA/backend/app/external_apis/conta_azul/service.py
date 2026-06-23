from app.external_apis.conta_azul.contracts import ApprovedSale, ExternalApiResult
from app.external_apis.conta_azul.mapper import to_conta_azul_customer_payload, to_conta_azul_sale_payload

PROVIDER = "conta_azul"


class ContaAzulIntegrationNotConfiguredError(RuntimeError):
    """Erro usado quando a empresa ainda nao conectou sua conta Conta Azul."""


class ContaAzulService:
    """Servico de orquestracao da integracao Conta Azul.

    Esta classe ainda nao chama a API externa. Ela define o fluxo correto para
    evitar acoplamento e duplicidade quando o cliente aprovar um orcamento.
    """

    def __init__(self, empresa_id: str):
        self.empresa_id = empresa_id

    def export_approved_sale(self, sale: ApprovedSale) -> ExternalApiResult:
        """Exporta uma venda aprovada para a Conta Azul.

        Fluxo final esperado:
        1. verificar se a empresa possui integracao ativa;
        2. verificar se o orcamento ja foi exportado;
        3. criar/atualizar pessoa na Conta Azul;
        4. criar venda na Conta Azul;
        5. salvar mapeamento externo;
        6. salvar log de sincronizacao.
        """

        customer_payload = to_conta_azul_customer_payload(sale)
        sale_payload = to_conta_azul_sale_payload(sale, conta_azul_customer_id="TO_BE_CREATED")

        return ExternalApiResult(
            success=False,
            provider=PROVIDER,
            action="export_approved_sale",
            message=(
                "Fluxo preparado. Implementar client HTTP, OAuth por empresa, "
                "persistencia de mapeamentos e logs antes de ativar em producao."
            ),
            raw_response={
                "customer_payload_preview": customer_payload,
                "sale_payload_preview": sale_payload,
            },
        )
