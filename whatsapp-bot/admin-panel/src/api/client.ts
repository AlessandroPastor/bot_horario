export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function apiFetch<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${ruta}`, {
    ...opciones,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(opciones.headers ?? {}) },
  });

  if (!res.ok) {
    let mensaje = `Error ${res.status}`;
    try {
      const cuerpo = (await res.json()) as { error?: string };
      if (cuerpo.error) mensaje = cuerpo.error;
    } catch {
      // sin cuerpo JSON, se queda con el mensaje genérico
    }
    throw new ApiError(res.status, mensaje);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(ruta: string) => apiFetch<T>(ruta),
  post: <T>(ruta: string, datos?: unknown) =>
    apiFetch<T>(ruta, { method: "POST", body: datos ? JSON.stringify(datos) : undefined }),
  put: <T>(ruta: string, datos: unknown) =>
    apiFetch<T>(ruta, { method: "PUT", body: JSON.stringify(datos) }),
  delete: <T>(ruta: string) => apiFetch<T>(ruta, { method: "DELETE" }),
};
