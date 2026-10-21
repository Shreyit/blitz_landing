export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

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
    throw new ApiError(
      "The event server is unavailable. Please try again shortly.",
      response.status,
    );
  }
  if (!response.ok)
    throw new ApiError(
      typeof payload.detail === "string"
        ? payload.detail
        : "Please check your details and try again.",
      response.status,
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
