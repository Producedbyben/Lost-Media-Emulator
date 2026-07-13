import { useRef } from "react";

/**
 * Returns a slice of `params` containing only `keys`, memoized so a NEW object
 * reference is produced ONLY when one of the selected values actually changed
 * (compared by value via Object.is, not by the identity of the whole `params`
 * object). This lets a panel component receive a small, stable-reference prop
 * derived from a large, frequently-replaced parent state object, so wrapping
 * that panel in React.memo actually prevents re-renders when unrelated params
 * change.
 *
 * `keys` does NOT need to be referentially stable across renders — the hook
 * only reads its current *contents* (by index/value) each render, it never
 * compares the array reference itself. Passing a fresh array literal like
 * `useParamSlice(params, ["a", "b"])` on every render is fine and is the
 * expected call pattern.
 */
export function useParamSlice<T extends Record<string, unknown>, K extends keyof T>(
  params: T,
  keys: readonly K[],
): Pick<T, K> {
  const cache = useRef<{ values: unknown[]; result: Pick<T, K> } | null>(null);

  const values = keys.map((k) => params[k]);

  const prev = cache.current;
  if (
    prev &&
    prev.values.length === values.length &&
    prev.values.every((v, i) => Object.is(v, values[i]))
  ) {
    return prev.result;
  }

  const result = {} as Pick<T, K>;
  for (const k of keys) {
    result[k] = params[k];
  }
  cache.current = { values, result };
  return result;
}
