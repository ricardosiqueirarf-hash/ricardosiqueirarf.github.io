const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
export const API_URL = rawApiUrl.replace(/\/+$/, "");

type ApiErrorDetailItem = {
  msg?: string;
  [key: string]: unknown;
};

async function readErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) {
    return `Erro ${response.status} na API`;
  }

  try {
    const data = JSON.parse(text) as { detail?: string | ApiErrorDetailItem[]; message?: string };
    if (typeof data.detail === "string") {
      return data.detail;
    }
    if (Array.isArray(data.detail)) {
      return data.detail.map((item: ApiErrorDetailItem) => item.msg || JSON.stringify(item)).join(" | ");
    }
    if (typeof data.message === "string") {
      return data.message;
    }
    return JSON.stringify(data);
  } catch {
    return text;
  }
}

function extraHeaders() {
  const headers: Record<string, string> = {};
  if (typeof window !== "undefined") {
    const chave = window.localStorage.getItem("anodiza_chave_acesso") || "";
    if (chave) headers["X-Anodiza-Key"] = chave;
  }
  return headers;
}

function showDebugError(message: string) {
  if (typeof window !== "undefined") {
    console.error("ANODIZA API:", message);
    alert(`Erro da API: ${message}`);
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { cache: "no-store", headers: extraHeaders() });
  if (!response.ok) {
    const message = await readErrorMessage(response);
    showDebugError(message);
    throw new Error(message);
  }
  return response.json();
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...extraHeaders() },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const message = await readErrorMessage(response);
    showDebugError(message);
    throw new Error(message);
  }
  return response.json();
}
