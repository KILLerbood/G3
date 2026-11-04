import { useCallback, useSyncExternalStore } from 'react';
import { store } from './storage';

/**
 * Small shared state kept on this device (src/lib/storage), for what the sheet doesn't hold yet:
 * client notes, onboarding checklists, projects, contracts, follow-up sequences.
 * Every component using the same key sees the same value; other tabs follow through the storage event.
 */
const EVT = 'g3-local';
const cache = new Map<string, unknown>();
function read<T>(key: string, fallback: T): T {
  if (!cache.has(key)) cache.set(key, store.json<T>(key, fallback));
  return cache.get(key) as T;
}
export function writeLocal<T>(key: string, value: T) {
  cache.set(key, value);
  store.setJson(key, value);
  window.dispatchEvent(new CustomEvent(EVT, { detail: key }));
}
export function readLocal<T>(key: string, fallback: T): T { return read(key, fallback); }
function subscribe(cb: () => void) {
  const on = (e: Event) => { if (e instanceof StorageEvent && e.key) cache.delete(e.key); cb(); };
  window.addEventListener(EVT, on);
  window.addEventListener('storage', on);
  return () => { window.removeEventListener(EVT, on); window.removeEventListener('storage', on); };
}
export function useLocalState<T>(key: string, fallback: T): [T, (next: T | ((prev: T) => T)) => void] {
  const value = useSyncExternalStore(subscribe, () => read(key, fallback), () => fallback);
  const set = useCallback((next: T | ((prev: T) => T)) => {
    const prev = read(key, fallback);
    writeLocal(key, typeof next === 'function' ? (next as (p: T) => T)(prev) : next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return [value, set];
}
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
