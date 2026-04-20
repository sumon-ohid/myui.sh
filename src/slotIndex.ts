"use client";
import type { ComponentType } from "react";

export type SlotManifest = Record<string, ComponentType>;
export type SlotLoader = () => Promise<SlotManifest>;
export type SlotIndex = Record<string, SlotLoader>;

let registered: SlotIndex = {};

export function registerSlots(index: SlotIndex): void {
  registered = { ...registered, ...index };
}

export function listSlotIds(): string[] {
  return Object.keys(registered);
}

export async function loadSlotManifest(slotId: string): Promise<SlotManifest> {
  const loader = registered[slotId];
  if (!loader) return {};
  try {
    const mod = await loader();
    return mod;
  } catch {
    return {};
  }
}
