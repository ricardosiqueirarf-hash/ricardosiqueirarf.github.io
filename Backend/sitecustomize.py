"""
Carrega a integração Asaas sem alterar os arquivos principais do sistema.

Quando o módulo api_orcamentos for importado pelo app.py, este hook instala:
- emissão automática de 2 boletos 50/50 após aprovação pelo Telegram;
- endpoint GET /api/orcamento/<uuid>/boletos;
- endpoint POST /api/orcamento/<uuid>/emitir-boletos-asaas;
- webhook POST /api/asaas/webhook.
"""

import importlib.abc
import importlib.machinery
import sys


class _AsaasPatchLoader(importlib.abc.Loader):
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
            # Não impede o backend de subir caso a integração Asaas tenha erro.
            print(f"[ASAAS] Falha ao instalar integração: {exc}")


class _AsaasPatchFinder(importlib.abc.MetaPathFinder):
    TARGET = "api_orcamentos"

    def find_spec(self, fullname, path=None, target=None):
        if fullname != self.TARGET:
            return None

        # Evita recursão: usa o PathFinder original diretamente.
        spec = importlib.machinery.PathFinder.find_spec(fullname, path)
        if not spec or not spec.loader:
            return None

        spec.loader = _AsaasPatchLoader(spec.loader)
        return spec


if not any(isinstance(finder, _AsaasPatchFinder) for finder in sys.meta_path):
    sys.meta_path.insert(0, _AsaasPatchFinder())
