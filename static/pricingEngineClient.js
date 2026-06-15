// pricingEngineClient.js
// Cliente JS para a futura API oficial de cálculo no backend.
// Fase inicial: arquivo isolado, não integrado ao fluxo atual do portas.html.

const DEFAULT_API_BASE = "https://colorglass.onrender.com";

function getApiBase() {
    return window.API_BASE || DEFAULT_API_BASE;
}

function getAuthHeaders(extraHeaders = {}) {
    if (window.ColorGlassAuth && typeof window.ColorGlassAuth.authHeaders === "function") {
        return window.ColorGlassAuth.authHeaders(extraHeaders);
    }

    const token = localStorage.getItem("USER_TOKEN") || localStorage.getItem("ADMIN_TOKEN") || "";
    return token
        ? { ...extraHeaders, Authorization: `Bearer ${token}` }
        : { ...extraHeaders };
}

async function readJsonSafe(response) {
    try {
        return await response.json();
    } catch (_) {
        return {};
    }
}

export function montarPayloadCalculoPorta(porta, contextoExtra = {}) {
    return {
        porta,
        contexto: contextoExtra
    };
}

export async function calcularPortaNoBackend(porta, opcoes = {}) {
    const apiBase = opcoes.apiBase || getApiBase();
    const orcamentoUuid = opcoes.orcamentoUuid || window.ORCAMENTO_UUID || porta?.orcamento_uuid || "";

    if (!orcamentoUuid) {
        throw new Error("orcamento_uuid ausente para cálculo da porta no backend.");
    }

    const endpoint = `${apiBase}/api/orcamento/${encodeURIComponent(orcamentoUuid)}/portas/calcular`;
    const payload = montarPayloadCalculoPorta(porta, opcoes.contexto || {});

    const response = await fetch(endpoint, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload)
    });

    const data = await readJsonSafe(response);

    if (!response.ok || data?.success === false) {
        throw new Error(data?.error || `Erro HTTP ${response.status} ao calcular porta.`);
    }

    return data;
}

export async function compararCalculoLocalComBackend(porta, calculoLocal, opcoes = {}) {
    const calculoBackend = await calcularPortaNoBackend(porta, opcoes);
    const precoLocal = Number(calculoLocal?.preco_total ?? calculoLocal?.precoTotal ?? calculoLocal ?? 0);
    const precoBackend = Number(calculoBackend?.preco_total ?? calculoBackend?.precoTotal ?? 0);

    return {
        porta,
        local: calculoLocal,
        backend: calculoBackend,
        preco_local: precoLocal,
        preco_backend: precoBackend,
        diferenca: precoBackend - precoLocal,
        igual: Math.abs(precoBackend - precoLocal) < 0.01
    };
}

export default {
    montarPayloadCalculoPorta,
    calcularPortaNoBackend,
    compararCalculoLocalComBackend
};
