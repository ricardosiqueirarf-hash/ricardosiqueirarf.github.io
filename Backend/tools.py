"""Wrapper de compatibilidade para importar tools.py atualizado da raiz do repositório.

Este arquivo existe porque o Render pode estar com Root Directory = Backend.
Quando isso acontece, imports como `from tools import ...` procuram primeiro dentro de
Backend. O módulo oficial atualizado fica na raiz do repositório.
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
ROOT_MODULE = ROOT_DIR / "tools.py"

root_path = str(ROOT_DIR)
if root_path in sys.path:
    sys.path.remove(root_path)
sys.path.insert(0, root_path)

spec = importlib.util.spec_from_file_location("colorglass_root_tools", ROOT_MODULE)
if spec is None or spec.loader is None:
    raise RuntimeError(f"Não foi possível carregar {ROOT_MODULE}")

_root_tools = importlib.util.module_from_spec(spec)
spec.loader.exec_module(_root_tools)

# Reexporta tudo que não é interno para manter compatibilidade com `from tools import ...`.
for _name in dir(_root_tools):
    if not _name.startswith("__"):
        globals()[_name] = getattr(_root_tools, _name)
