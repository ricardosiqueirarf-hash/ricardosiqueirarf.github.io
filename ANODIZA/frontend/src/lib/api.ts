const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
export const API_URL = rawApiUrl.replace(/\/+$/, "");

async function readErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) {
    return `Erro ${response.status} na API`;
  }

  try {
    const data = JSON.parse(text);
    if (typeof data.detail === "string") {
      return data.detail;
    }
    if (Array.isArray(data.detail)) {
      return data.detail.map((item) => item.msg || JSON.stringify(item)).join(" | ");
    }
    if (typeof data.message === "string") {
      return data.message;
    }
    return JSON.stringify(data);
  } catch {
    return text;
  }
}

function showDebugError(message: string) {
  if (typeof window !== "undefined") {
    console.error("ANODIZA API:", message);
    alert(`Erro da API: ${message}`);
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { cache: "no-store" });
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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const message = await readErrorMessage(response);
    showDebugError(message);
    throw new Error(message);
  }
  return response.json();
}
