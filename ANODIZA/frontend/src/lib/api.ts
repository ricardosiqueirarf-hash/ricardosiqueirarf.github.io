const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
export const API_URL = rawApiUrl.replace(/\/+$/, "");

type ApiErrorDetailItem = {
  type?: string;
  loc?: Array<string | number>;
  msg?: string;
  input?: unknown;
  ctx?: Record<string, unknown>;
  [key: string]: unknown;
};

function formatValidationError(item: ApiErrorDetailItem): string {
  const loc = Array.isArray(item.loc) ? item.loc.join(".") : "";
  const msg = item.msg || "Erro de validacao";

  if (loc) return `${loc}: ${msg}`;

  return msg;
}

async function readErrorMessage(response: Response): Promise<string> {
  const text = await response.text();

  if (!text) {
    return response.status === 403
      ? "Voce nao tem permissao para esta acao."
      : `Erro ${response.status} na API`;
  }

  try {
    const data = JSON.parse(text) as {
      detail?: string | ApiErrorDetailItem[];
      message?: string;
    };

    if (response.status === 403) return "Voce nao tem permissao para esta acao.";

    if (Array.isArray(data.detail)) {
      return data.detail.map(formatValidationError).join(" | ");
    }

    if (typeof data.detail === "string") return data.detail;
    if (typeof data.message === "string") return data.message;
    if (response.status === 401) return "Sessao invalida ou expirada.";

    return `Erro ${response.status} na API`;
  } catch {
    if (response.status === 401) return "Sessao invalida ou expirada.";
    if (response.status === 403) return "Voce nao tem permissao para esta acao.";

    return text || "Nao foi possivel concluir a operacao.";
  }
}

function extraHeaders(): HeadersInit {
  const headers: Record<string, string> = {};

  if (typeof window !== "undefined") {
    const chave = window.localStorage.getItem("anodiza_chave_acesso") || "";

    if (chave) headers["X-Anodiza-Key"] = chave;
  }

  return headers;
}

function handleAuthFailure(status: number) {
  if (status !== 401 || typeof window === "undefined") return;

  window.localStorage.removeItem("anodiza_chave_acesso");
  window.localStorage.removeItem("anodiza_usuario");

  if (!window.location.pathname.includes("/login")) {
    window.location.href = "/login";
  }
}

async function assertOk(response: Response) {
  if (response.ok) return;

  const message = await readErrorMessage(response);
  handleAuthFailure(response.status);

  throw new Error(message);
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    cache: "no-store",
    headers: extraHeaders(),
  });

  await assertOk(response);

  return response.json();
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...extraHeaders() },
    body: JSON.stringify(body),
  });

  await assertOk(response);

  return response.json();
}
