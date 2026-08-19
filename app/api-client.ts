export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new ApiError("El servidor devolvió una respuesta inválida", response.status, response.url);
    }
  }
  if (!response.ok) {
    const error = typeof data === "object" && data && "error" in data ? String(data.error) : `Error ${response.status}`;
    throw new ApiError(error, response.status, response.url);
  }
  return data as T;
}

export async function apiJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  return readJson<T>(await fetch(input, init));
}
