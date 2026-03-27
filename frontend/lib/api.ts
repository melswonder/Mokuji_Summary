import type {
  Book,
  ProviderStatus,
  SessionState,
  SettingsState,
  Summary,
  Thread,
} from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || data.error || "Request failed");
  }
  return data as T;
}

export function getApiBase() {
  return API_BASE;
}

export async function inspectBook(url: string, providerId: string) {
  return request<{ book: Book }>("/api/v1/books/inspect", {
    method: "POST",
    body: JSON.stringify({ url, provider_id: providerId }),
  });
}

export async function fetchBooks() {
  return request<{ books: Book[] }>("/api/v1/books");
}

export async function fetchBook(bookId: string) {
  return request<{ book: Book }>(`/api/v1/books/${bookId}`);
}

export async function deleteBook(bookId: string) {
  return request<{ ok: boolean }>(`/api/v1/books/${bookId}`, {
    method: "DELETE",
  });
}

export async function fetchThread(bookId: string, chapterId: string, providerId: string) {
  const params = new URLSearchParams({
    chapter_id: chapterId,
    provider_id: providerId,
  });
  return request<{ thread: Thread }>(`/api/v1/books/${bookId}/threads?${params.toString()}`);
}

export async function sendMessage(bookId: string, chapterId: string, providerId: string, content: string) {
  return request<{ thread: Thread }>(`/api/v1/books/${bookId}/threads/messages`, {
    method: "POST",
    body: JSON.stringify({
      chapter_id: chapterId,
      provider_id: providerId,
      content,
    }),
  });
}

export async function generateSummary(bookId: string, providerId: string) {
  return request<{ summary: Summary }>(`/api/v1/books/${bookId}/summary`, {
    method: "POST",
    body: JSON.stringify({ provider_id: providerId }),
  });
}

export async function fetchProviders() {
  return request<{ providers: ProviderStatus[] }>("/api/v1/providers");
}

export async function fetchSession() {
  return request<{ session: SessionState; oauth: { google_configured: boolean } }>("/api/v1/session");
}

export async function fetchSettings() {
  return request<{ settings: SettingsState }>("/api/v1/settings");
}

export async function saveSettings(payload: Partial<SettingsState>) {
  return request<{ settings: SettingsState }>("/api/v1/settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function disconnectGoogle() {
  return request<{ ok: boolean }>("/api/v1/auth/google/disconnect", {
    method: "POST",
    body: JSON.stringify({}),
  });
}
