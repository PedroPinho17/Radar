import { useSyncExternalStore } from 'react';

const noSubscribe = () => () => {};

/**
 * Lê um valor que só existe no browser (URL, localStorage…) sem `setState` dentro de `useEffect`.
 * No servidor e na hidratação devolve `fallback`; logo a seguir, o valor real. `read` tem de devolver
 * sempre o mesmo valor (string/número/null) enquanto nada mudar.
 */
export function useClientValue<T extends string | number | boolean | null>(read: () => T, fallback: T): T {
  return useSyncExternalStore(noSubscribe, read, () => fallback);
}

/** Parâmetro do URL (?nome=…). */
export const searchParam = (name: string) => () => new URLSearchParams(window.location.search).get(name);

const captured = new Map<string, string | null>();

/**
 * Parâmetro do fragmento (#nome=…), lido UMA vez por página e guardado:
 * os tokens dos emails vivem no fragmento e são apagados do URL logo a seguir.
 */
export const hashParam = (name: string) => () => {
  const key = `${window.location.pathname}#${name}`;
  if (!captured.has(key)) captured.set(key, new URLSearchParams(window.location.hash.slice(1)).get(name));
  return captured.get(key) ?? null;
};

/** Tira o fragmento (#token=…) da barra de endereço e do histórico. */
export function clearHash() {
  if (window.location.hash) window.history.replaceState(null, '', window.location.pathname + window.location.search);
}

export const storageValue = (key: string) => () => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // modo privado / bloqueado
  }
};
