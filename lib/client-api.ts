export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({ error: "Request failed" }))) as {
      error?: string;
    };
    throw new Error(payload.error ?? `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}
