"""
pricing_engine.py
Motor oficial de cálculo de portas da ColorGlass.

Fase inicial: arquivo isolado, sem alterar rotas existentes.
A ideia é usar este módulo depois em uma API oficial de cálculo, por exemplo:
POST /api/orcamento/<orcamento_uuid>/portas/calcular

Este arquivo não acessa Flask, Supabase nem request diretamente.
Ele recebe dados brutos e listas de materiais já carregadas pelo backend.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional
import unicodedata
import re


Number = float | int


def to_number(value: Any, fallback: float = 0.0) -> float:
    if value is None or value == "":
        return fallback
    try:
        if isinstance(value, str):
            value = value.replace(",", ".")
        return float(value)
    except (TypeError, ValueError):
        return fallback


def normalize_text(value: Any) -> str:
    return str(value or "").strip()


def find_by_id(items: List[Dict[str, Any]], item_id: Any) -> Optional[Dict[str, Any]]:
    if not item_id:
        return None
    target = str(item_id)
    for item in items or []:
        if str(item.get("id")) == target:
            return item
    return None


def normalize_tag_value(value: Any) -> str:
    text = str(value or "").strip().lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return text.strip()


def normalize_material_key(value: Any) -> str:
    text = str(value if value is not None else "")
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = text.upper()
    text = re.sub(r"[^A-Z0-9]+", "", text)
    return text.strip()


def extract_material_reference(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, dict):
        return str(
            value.get("nome")
            or value.get("name")
            or value.get("id")
            or value.get("codigo")
            or value.get("codigo_interno")
            or ""
        )
    return str(value)


def find_profile_material(reference: Any, materials: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not materials:
        return None

    original = normalize_text(extract_material_reference(reference))
    if not original:
        return None

    for material in materials:
        if (
            normalize_text(material.get("nome")) == original
            or normalize_text(material.get("id")) == original
            or normalize_text(material.get("codigo")) == original
            or normalize_text(material.get("codigo_interno")) == original
        ):
            return material

    key = normalize_material_key(original)
    if not key:
        return None

    for material in materials:
        if (
            normalize_material_key(material.get("nome")) == key
            or normalize_material_key(material.get("id")) == key
            or normalize_material_key(material.get("codigo")) == key
            or normalize_material_key(material.get("codigo_interno")) == key
        ):
            return material

    for material in materials:
        name_key = normalize_material_key(material.get("nome"))
        if name_key and (key in name_key or name_key in key):
            return material

    return None


def get_profile_materials(profile: Optional[Dict[str, Any]], materials: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    references = profile.get("insumos", []) if isinstance(profile, dict) else []
    if not isinstance(references, list):
        references = []

    found = []
    for reference in references:
        material = find_profile_material(reference, materials)
        if material:
            found.append(material)
    return found


@dataclass
class DoorMeasurements:
    largura_mm: float
    altura_mm: float
    largura_m: float
    altura_m: float
    area: float
    perimetro: float

    def to_dict(self) -> Dict[str, float]:
        return asdict(self)


@dataclass
class ComponentLine:
    categoria: str
    nome: str
    quantidade: float
    unidade: str
    unitario: float
    total: float
    formula: str = ""
    item: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def calculate_measurements(door: Dict[str, Any]) -> DoorMeasurements:
    data = door.get("dados") or door
    largura_mm = to_number(data.get("largura") or door.get("largura"), 0)
    altura_mm = to_number(data.get("altura") or door.get("altura"), 0)
    largura_m = largura_mm / 1000
    altura_m = altura_mm / 1000
    return DoorMeasurements(
        largura_mm=largura_mm,
        altura_mm=altura_mm,
        largura_m=largura_m,
        altura_m=altura_m,
        area=largura_m * altura_m,
        perimetro=2 * (largura_m + altura_m),
    )


def calculate_material_quantity(material: Dict[str, Any], measurements: DoorMeasurements, context: Dict[str, Any] | None = None) -> float:
    context = context or {}
    tipo = material.get("tipo_medida")
    if tipo == "metro_linear":
        if isinstance(context.get("comprimento_m"), (int, float)):
            return float(context["comprimento_m"])
        if context.get("base") == "largura":
            return measurements.largura_m
        return measurements.perimetro
    if tipo == "m2":
        return measurements.area
    if tipo == "unidade":
        return 1
    return 0


def calculate_material_total(material: Dict[str, Any], measurements: DoorMeasurements, context: Dict[str, Any] | None = None) -> Dict[str, Any]:
    quantity = calculate_material_quantity(material, measurements, context)
    return {
        "material": material,
        "quantidade": quantity,
        "total": to_number(material.get("preco"), 0) * quantity,
    }


def calculate_selected_track_length(track_selection: Dict[str, Any], measurements: DoorMeasurements, door_type: str, data: Dict[str, Any]) -> float:
    if door_type == "deslizante":
        upper_gap_m = to_number(data.get("vao_trilhos_superior"), 0) / 1000
        lower_gap_m = to_number(data.get("vao_trilhos_inferior"), 0) / 1000
        if track_selection.get("posicao") == "superior":
            return measurements.largura_m + upper_gap_m
        if track_selection.get("posicao") == "inferior":
            return measurements.largura_m + lower_gap_m
    return measurements.largura_m


def get_selected_tracks(door: Dict[str, Any], context: Dict[str, Any]) -> List[Dict[str, Any]]:
    data = door.get("dados") or {}
    materials = context.get("insumos") or context.get("todosInsumos") or []
    references = [
        {"posicao": "superior", "label": "superior", "referencia": data.get("trilhos_superior")},
        {"posicao": "inferior", "label": "inferior", "referencia": data.get("trilhos_inferior")},
    ]

    tracks = []
    for item in references:
        if not item.get("referencia"):
            continue
        material = find_profile_material(item["referencia"], materials)
        if material:
            tracks.append({**item, "material": material})
    return tracks


def get_handle_data(door: Dict[str, Any], context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    data = door.get("dados") or {}
    handle_id = data.get("puxador")
    if not handle_id or handle_id == "sem_puxador":
        return None

    handles = context.get("puxadores") or context.get("todosPuxadores") or []
    handle = find_by_id(handles, handle_id)
    if not handle:
        return None

    measure_type = handle.get("tipo_medida")
    handle_size_mm = to_number(data.get("medida_puxador"), 0)
    quantity = handle_size_mm / 1000 if measure_type == "metro_linear" else 1

    return {
        "puxador": handle,
        "tipo_medida": measure_type,
        "quantidade": quantity,
        "medida_puxador_mm": handle_size_mm,
    }


def get_matching_tag(door: Dict[str, Any], context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    data = door.get("dados") or {}
    profile = find_by_id(context.get("perfis") or context.get("todosPerfis") or [], data.get("perfil"))
    glass = find_by_id(context.get("vidros") or context.get("todosVidros") or [], data.get("vidro"))
    tags = context.get("tags") or context.get("todasTags") or []

    if not profile or not glass or not isinstance(tags, list):
        return None

    profile_id = str(profile.get("id"))
    glass_id = str(glass.get("id"))
    thickness = normalize_text(glass.get("espessura"))
    glass_type = glass.get("tipo")
    glass_keys = [
        " - ".join(filter(None, [str(glass_type or ""), thickness])),
        " ".join(filter(None, [str(glass_type or ""), thickness])),
        " ".join(filter(None, [str(glass_type or ""), f"{thickness}mm" if thickness else ""])),
        str(glass_type or ""),
    ]
    glass_keys = [normalize_tag_value(key) for key in glass_keys if key]

    for tag in tags:
        raw_profiles = str(tag.get("perfis")) if tag.get("perfis") is not None else ""
        raw_glasses = str(tag.get("vidros")) if tag.get("vidros") is not None else ""
        tag_array = tag.get("tags") if isinstance(tag.get("tags"), list) else []
        tag_array = [normalize_tag_value(value) for value in tag_array]

        matches_profiles = raw_profiles == profile_id if raw_profiles else True
        normalized_glasses = normalize_tag_value(raw_glasses)
        matches_glasses = raw_glasses == glass_id or normalized_glasses in glass_keys if raw_glasses else True

        strong_match = bool(raw_profiles or raw_glasses) and matches_profiles and matches_glasses
        weak_match = profile_id in tag_array and (glass_id in tag_array or any(key in tag_array for key in glass_keys))

        if strong_match or weak_match:
            return tag

    return None


def calculate_applied_tag(tag: Optional[Dict[str, Any]], measurements: DoorMeasurements) -> Optional[Dict[str, Any]]:
    if not tag or not tag.get("valor"):
        return None

    quantity = 0.0
    if tag.get("medida") == "m2":
        quantity = measurements.area
    elif tag.get("medida") == "perimetro":
        quantity = measurements.perimetro
    elif tag.get("medida") == "unidade":
        quantity = 1.0

    if not quantity:
        return None

    unit_value = to_number(tag.get("valor"), 0)
    return {"tag": tag, "quantidade": quantity, "total": unit_value * quantity}


def calculate_door_components(door: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
    data = door.get("dados") or {}
    door_type = door.get("tipo") or data.get("tipo") or ""
    measurements = calculate_measurements(door)

    profiles = context.get("perfis") or context.get("todosPerfis") or []
    glasses = context.get("vidros") or context.get("todosVidros") or []
    systems = context.get("sistemas") or context.get("sistemasLista") or []
    materials = context.get("insumos") or context.get("todosInsumos") or []

    profile = find_by_id(profiles, data.get("perfil"))
    glass = find_by_id(glasses, data.get("vidro"))
    system = find_by_id(systems, data.get("sistemas"))
    extra_value = to_number(data.get("valor_adicional"), 0)

    lines: List[ComponentLine] = []

    if profile:
        lines.append(ComponentLine(
            categoria="perfil",
            item=profile,
            nome=f"Perfil ({profile.get('nome')})",
            quantidade=measurements.perimetro,
            unidade="m",
            unitario=to_number(profile.get("preco"), 0),
            total=to_number(profile.get("preco"), 0) * measurements.perimetro,
            formula=f"2 × ({measurements.largura_m:.3f} + {measurements.altura_m:.3f})",
        ))

    if glass:
        suffix = f" {glass.get('espessura')}mm" if glass.get("espessura") else ""
        lines.append(ComponentLine(
            categoria="vidro",
            item=glass,
            nome=f"Vidro ({glass.get('tipo')}{suffix})",
            quantidade=measurements.area,
            unidade="m²",
            unitario=to_number(glass.get("preco"), 0),
            total=to_number(glass.get("preco"), 0) * measurements.area,
            formula=f"{measurements.largura_m:.3f} × {measurements.altura_m:.3f}",
        ))

    for material in get_profile_materials(profile, materials):
        calc = calculate_material_total(material, measurements)
        unit = "m" if material.get("tipo_medida") == "metro_linear" else ("m²" if material.get("tipo_medida") == "m2" else "un")
        lines.append(ComponentLine(
            categoria="insumo_perfil",
            item=material,
            nome=f"Insumo do perfil ({material.get('nome')})",
            quantidade=calc["quantidade"],
            unidade=unit,
            unitario=to_number(material.get("preco"), 0),
            total=calc["total"],
            formula="perímetro da porta" if unit == "m" else "1 unidade por porta",
        ))

    if door_type in {"deslizante", "correr"}:
        if system:
            lines.append(ComponentLine(
                categoria="sistema",
                item=system,
                nome=f"Sistema ({system.get('nome')})",
                quantidade=1,
                unidade="un",
                unitario=to_number(system.get("preco"), 0),
                total=to_number(system.get("preco"), 0),
                formula="1 sistema por porta",
            ))

        for track in get_selected_tracks(door, context):
            material = track["material"]
            length_m = calculate_selected_track_length(track, measurements, door_type, data)
            calc = calculate_material_total(material, measurements, {"comprimento_m": length_m, "base": "largura"})
            unit = "m" if material.get("tipo_medida") == "metro_linear" else ("m²" if material.get("tipo_medida") == "m2" else "un")
            lines.append(ComponentLine(
                categoria=f"trilho_{track.get('posicao')}",
                item=material,
                nome=f"Trilho {track.get('label')} ({material.get('nome')})",
                quantidade=calc["quantidade"],
                unidade=unit,
                unitario=to_number(material.get("preco"), 0),
                total=calc["total"],
                formula="largura da porta" if unit == "m" else "1 unidade por porta",
            ))

    handle_data = get_handle_data(door, context)
    if handle_data:
        handle = handle_data["puxador"]
        unit = "m" if handle_data["tipo_medida"] == "metro_linear" else "un"
        lines.append(ComponentLine(
            categoria="puxador",
            item=handle,
            nome=f"Puxador ({handle.get('nome')})",
            quantidade=handle_data["quantidade"],
            unidade=unit,
            unitario=to_number(handle.get("preco"), 0),
            total=to_number(handle.get("preco"), 0) * handle_data["quantidade"],
            formula="medida do puxador ÷ 1000" if unit == "m" else "1 unidade por porta",
        ))

    applied_tag = calculate_applied_tag(get_matching_tag(door, context), measurements)
    if applied_tag:
        tag = applied_tag["tag"]
        unit = "m²" if tag.get("medida") == "m2" else ("m" if tag.get("medida") == "perimetro" else "un")
        lines.append(ComponentLine(
            categoria="tag",
            item=tag,
            nome="Tag aplicada",
            quantidade=applied_tag["quantidade"],
            unidade=unit,
            unitario=to_number(tag.get("valor"), 0),
            total=applied_tag["total"],
            formula="regra da tag aplicada",
        ))

    if extra_value > 0:
        lines.append(ComponentLine(
            categoria="adicional",
            item=None,
            nome="Valor adicional",
            quantidade=1,
            unidade="un",
            unitario=extra_value,
            total=extra_value,
            formula="valor manual",
        ))

    return {
        "tipo": door_type,
        "medidas": measurements.to_dict(),
        "perfil": profile,
        "vidro": glass,
        "sistema": system,
        "linhas": [line.to_dict() for line in lines],
    }


def calculate_door_price(door: Dict[str, Any], context: Dict[str, Any]) -> float:
    quantity = to_number(door.get("quantidade") or (door.get("dados") or {}).get("quantidade"), 1) or 1
    components = calculate_door_components(door, context)
    unit_total = sum(to_number(line.get("total"), 0) for line in components["linhas"])
    return unit_total * quantity


def calculate_door(door: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
    quantity = to_number(door.get("quantidade") or (door.get("dados") or {}).get("quantidade"), 1) or 1
    components = calculate_door_components(door, context)
    unit_total = sum(to_number(line.get("total"), 0) for line in components["linhas"])
    total = unit_total * quantity

    return {
        "success": True,
        "tipo": components["tipo"],
        "quantidade": quantity,
        "medidas": components["medidas"],
        "componentes": components["linhas"],
        "preco_unitario": unit_total,
        "preco_total": total,
        "referencias": {
            "perfil": components["perfil"],
            "vidro": components["vidro"],
            "sistema": components["sistema"],
        },
    }
