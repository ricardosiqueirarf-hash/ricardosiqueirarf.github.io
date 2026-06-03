"""Wrapper de compatibilidade para importar supabase_service.py atualizado da raiz.

Evita que deploys com Root Directory = Backend usem um supabase_service.py antigo
sem as funções de consulta somente leitura usadas por tools.py.
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
ROOT_MODULE = ROOT_DIR / "supabase_service.py"

root_path = str(ROOT_DIR)
if root_path in sys.path:
    sys.path.remove(root_path)
sys.path.insert(0, root_path)

spec = importlib.util.spec_from_file_location("colorglass_root_supabase_service", ROOT_MODULE)
if spec is None or spec.loader is None:
    raise RuntimeError(f"Não foi possível carregar {ROOT_MODULE}")

_root_supabase_service = importlib.util.module_from_spec(spec)
spec.loader.exec_module(_root_supabase_service)

for _name in dir(_root_supabase_service):
    if not _name.startswith("__"):
        globals()[_name] = getattr(_root_supabase_service, _name)
