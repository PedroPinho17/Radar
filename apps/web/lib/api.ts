/**
 * Cliente HTTP do frontend para a API Nest (`/api/...`).
 * Usa cookies de sessão (`credentials: 'same-origin'`).
 */

/** Erro com código HTTP (0 = sem rede). */
export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/**
 * Faz um pedido à API e devolve o JSON tipado.
 * @param path Caminho sem o prefixo `/api` (ex. `'/profile'`)
 * @param init Opções de `fetch`; usa `json` para enviar um corpo JSON
 * @throws {ApiError} se a rede falhar ou a resposta não for 2xx
 */
export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      credentials: 'same-origin',
      ...rest,
      headers: json !== undefined ? { 'Content-Type': 'application/json', ...rest.headers } : rest.headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError('Sem ligação ao servidor. Verifica a internet e tenta outra vez.', 0);
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const msg = Array.isArray(data?.message) ? data.message.join(' ') : data?.message;
    const fallback =
      res.status === 429 ? 'Demasiados pedidos. Espera um pouco e tenta outra vez.'
      : res.status >= 500 ? 'O servidor teve um problema. Tenta outra vez daqui a pouco.'
      : 'Algo correu mal.';
    throw new ApiError(msg ?? fallback, res.status);
  }
  return data as T;
}
