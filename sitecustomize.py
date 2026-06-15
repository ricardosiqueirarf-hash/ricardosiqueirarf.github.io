"""
Fallback para garantir que a integração Asaas seja carregada se o backend iniciar a partir da raiz do repositório.
"""

import importlib.abc
import importlib.machinery
import os
import sys


ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT_DIR, "Backend")
if os.path.isdir(BACKEND_DIR) and BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)


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
            print(f"[ASAAS] Falha ao instalar integração: {exc}")


class _AsaasPatchFinder(importlib.abc.MetaPathFinder):
    TARGET = "api_orcamentos"

    def find_spec(self, fullname, path=None, target=None):
        if fullname != self.TARGET:
            return None
        spec = importlib.machinery.PathFinder.find_spec(fullname, path)
        if not spec or not spec.loader:
            return None
        spec.loader = _AsaasPatchLoader(spec.loader)
        return spec


if not any(isinstance(finder, _AsaasPatchFinder) for finder in sys.meta_path):
    sys.meta_path.insert(0, _AsaasPatchFinder())
