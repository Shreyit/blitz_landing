export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: "same-origin",
    cache: "no-store",
  });
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(
      "The event server is unavailable. Please try again shortly.",
    );
  }
  if (!response.ok)
    throw new Error(
      typeof payload.detail === "string"
        ? payload.detail
        : "Please check your details and try again.",
    );
  return payload as T;
}
export function command<T>(path: string, body: object) {
  return api<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
