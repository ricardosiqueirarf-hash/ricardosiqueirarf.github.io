"""
Carrega integrações sem alterar diretamente os arquivos principais do sistema.

Quando o módulo api_orcamentos for importado pelo app.py, este hook instala:
- emissão automática de 2 boletos 50/50 após aprovação pelo Telegram;
- endpoints auxiliares do Asaas;
- log automático das alterações feitas no controle.html;
- log automático de criação e alteração de orçamentos.
"""

import importlib.abc
import importlib.machinery
import sys


class _OrcamentosPatchLoader(importlib.abc.Loader):
    def __init__(self, wrapped_loader):
        self.wrapped_loader = wrapped_loader

    def create_module(self, spec):
        if hasattr(self.wrapped_loader, "create_module"):
            return self.wrapped_loader.create_module(spec)
        return None

    def exec_module(self, module):
        self.wrapped_loader.exec_module(module)

        try:
            import asaas_orcamentos_patch
            asaas_orcamentos_patch.install(module)
        except Exception as exc:
            print(f"[ASAAS] Falha ao instalar integração: {exc}")

        try:
            import controle_log_patch
            controle_log_patch.install(module)
        except Exception as exc:
            print(f"[CONTROLE_LOG] Falha ao instalar integração: {exc}")

        try:
            import orcamento_crud_log_patch
            orcamento_crud_log_patch.install(module)
        except Exception as exc:
            print(f"[ORCAMENTO_LOG] Falha ao instalar integração: {exc}")


class _OrcamentosPatchFinder(importlib.abc.MetaPathFinder):
    TARGET = "api_orcamentos"

    def find_spec(self, fullname, path=None, target=None):
        if fullname != self.TARGET:
            return None

        spec = importlib.machinery.PathFinder.find_spec(fullname, path)
        if not spec or not spec.loader:
            return None

        spec.loader = _OrcamentosPatchLoader(spec.loader)
        return spec


if not any(isinstance(finder, _OrcamentosPatchFinder) for finder in sys.meta_path):
    sys.meta_path.insert(0, _OrcamentosPatchFinder())
