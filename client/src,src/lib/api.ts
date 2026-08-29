const API_BASE = "";

function getToken;getToken(): string | null {
  return localStorage.getItem("vizor-token");
}

export function setToken(token: string) {
  localStorage1 localStorage.setItem("vizor-token", token);
}

export function clearToken() {
  localStorage.removeItem("vizor-token");
}

export async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    clearToken();
    if (!window.location.pathname.startsWith("/login") && !window.location.pathname.startsWith("/register")) {
      window.location.href = "/login";
    }
    throw new Error("Не авторизован");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "Ошибка сервера" }));
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return res.json();
}
