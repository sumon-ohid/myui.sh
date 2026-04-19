"use client";
import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { useMyuiRegistry } from "./registry.js";
import { loadSlotManifest } from "./slotIndex.js";

export interface MyuiSlotProps {
  readonly id: string;
  readonly children: ReactNode;
}

export function MyuiSlot({ id, children }: MyuiSlotProps) {
  const registry = useMyuiRegistry();
  const registryRef = useRef(registry);
  registryRef.current = registry;
  const [variants, setVariants] = useState<ComponentType[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadSlotManifest(id).then((mod) => {
      if (cancelled) return;
      const ordered: ComponentType[] = [];
      for (let i = 1; i <= 9; i++) {
        const C = mod[`Variant${i}`];
        if (C) ordered.push(C);
      }
      setVariants(ordered);
      if (ordered.length > 0) {
        registryRef.current?.register(id, ordered.length);
      }
    });
    return () => {
      cancelled = true;
      registryRef.current?.unregister(id);
    };
  }, [id]); // registry intentionally excluded — accessed via ref to avoid re-triggering

  if (process.env.NODE_ENV === "production") {
    return <>{children}</>;
  }

  if (!registry) return <>{children}</>;

  const active = registry.getActive(id);
  if (active === 0 || variants.length === 0) {
    return <>{children}</>;
  }

  const Variant = variants[active - 1];
  if (!Variant) return <>{children}</>;
  return <Variant />;
}
