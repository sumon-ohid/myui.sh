"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export interface SlotInfo {
  readonly id: string;
  readonly variantCount: number;
  readonly active: number;
}

interface RegistryShape {
  readonly slots: ReadonlyMap<string, SlotInfo>;
  readonly register: (id: string, variantCount: number) => void;
  readonly unregister: (id: string) => void;
  readonly setActive: (id: string, variantId: number) => void;
  readonly getActive: (id: string) => number;
}

const RegistryContext = createContext<RegistryShape | null>(null);

const STORAGE_KEY = "myui:active-variants";

function loadActiveMap(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function saveActiveMap(map: Record<string, number>): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors (private mode, quota)
  }
}

export function MyuiRegistryProvider({ children }: { children: ReactNode }) {
  const [slots, setSlots] = useState<Map<string, SlotInfo>>(new Map());
  const activeMapRef = useRef<Record<string, number>>(loadActiveMap());

  useEffect(() => {
    saveActiveMap(activeMapRef.current);
  }, [slots]);

  const register = useCallback((id: string, variantCount: number) => {
    setSlots((prev) => {
      const existing = prev.get(id);
      if (existing && existing.variantCount === variantCount) return prev;
      const active = activeMapRef.current[id] ?? 0;
      const next = new Map(prev);
      next.set(id, { id, variantCount, active });
      return next;
    });
  }, []);

  const unregister = useCallback((id: string) => {
    setSlots((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const setActive = useCallback((id: string, variantId: number) => {
    activeMapRef.current = { ...activeMapRef.current, [id]: variantId };
    setSlots((prev) => {
      const existing = prev.get(id);
      if (!existing || existing.active === variantId) return prev;
      const next = new Map(prev);
      next.set(id, { ...existing, active: variantId });
      return next;
    });
  }, []);

  const getActive = useCallback((id: string) => {
    return activeMapRef.current[id] ?? 0;
  }, []);

  const value = useMemo<RegistryShape>(
    () => ({ slots, register, unregister, setActive, getActive }),
    [slots, register, unregister, setActive, getActive],
  );

  return (
    <RegistryContext.Provider value={value}>
      {children}
    </RegistryContext.Provider>
  );
}

export function useMyuiRegistry(): RegistryShape | null {
  return useContext(RegistryContext);
}
