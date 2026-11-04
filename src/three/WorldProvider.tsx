import type { ReactNode } from 'react';

/**
 * G3 has no WebGL background (it was slow on phones). These are kept as no-ops so pages that still
 * declare a «scene» keep compiling; nothing is drawn and three.js is never downloaded.
 */
export type Scene = { shape?: string; [k: string]: unknown };
const noop = () => {};
const ctx = { setScene: noop as (s: Scene) => void, burst: noop, setDimmed: noop as (d: boolean) => void };
export function WorldProvider({ children }: { children: ReactNode }) { return <>{children}</>; }
export const useWorld = () => ctx;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useWorldScene(_scene: Scene, _deps: unknown[] = []) { /* no background */ }
