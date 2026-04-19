"use client";
import { useEffect, useState } from "react";
import { MyuiRegistryProvider, useMyuiRegistry } from "./registry.js";
import { listSlotIds } from "./slotIndex.js";

interface MyuiOverlayProps {
  readonly initialSlotId?: string;
}

function MyuiOverlayInner(props: MyuiOverlayProps) {
  const existing = useMyuiRegistry();
  if (existing) return <Dock {...props} />;
  return (
    <MyuiRegistryProvider>
      <Dock {...props} />
    </MyuiRegistryProvider>
  );
}

export function MyuiOverlay(props: MyuiOverlayProps) {
  if (process.env.NODE_ENV === "production") return null;
  return <MyuiOverlayInner {...props} />;
}

function Dock({ initialSlotId }: MyuiOverlayProps) {
  const registry = useMyuiRegistry();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [collapsed, setCollapsed] = useState(false);
  const [focusedSlot, setFocusedSlot] = useState<string | null>(
    initialSlotId ?? null,
  );

  const slots = registry ? Array.from(registry.slots.values()) : [];
  const activeSlot =
    (focusedSlot ? slots.find((s) => s.id === focusedSlot) : null) ?? slots[0] ?? null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement) {
        const tag = e.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable)
          return;
      }
      if (!activeSlot || !registry) return;
      const total = activeSlot.variantCount;
      if (total === 0) return;

      if (e.key === "ArrowLeft" || e.key === "[") {
        e.preventDefault();
        const next =
          activeSlot.active <= 0 ? total : activeSlot.active - 1;
        registry.setActive(activeSlot.id, next === total ? 0 : next);
      } else if (e.key === "ArrowRight" || e.key === "]") {
        e.preventDefault();
        const next = activeSlot.active >= total ? 0 : activeSlot.active + 1;
        registry.setActive(activeSlot.id, next);
      } else if (/^[0-9]$/.test(e.key)) {
        const n = Number.parseInt(e.key, 10);
        if (n <= total) registry.setActive(activeSlot.id, n);
      } else if (e.key === "t" || e.key === "T") {
        setTheme((t) => (t === "light" ? "dark" : "light"));
      } else if (e.key === "h" || e.key === "H") {
        setCollapsed((c) => !c);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeSlot, registry]);

  if (!registry) return null;

  if (slots.length === 0) {
    return (
      <aside
        className="myui-dock"
        data-theme={theme}
        role="status"
        aria-live="polite"
      >
        <span className="myui-dock__brand">myui</span>
        <span className="myui-dock__hint">no slots registered</span>
      </aside>
    );
  }

  if (collapsed) {
    return (
      <button
        type="button"
        className="myui-dock myui-dock--collapsed"
        data-theme={theme}
        onClick={() => setCollapsed(false)}
        aria-label="Expand myui dock"
        title="Expand (H)"
      >
        <span className="myui-dock__brand">myui</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>
    );
  }

  return (
    <aside
      className="myui-dock"
      data-theme={theme}
      role="toolbar"
      aria-label="myui variant controls"
    >
      {slots.length > 1 && (
        <>
          <select
            className="myui-dock__select"
            value={activeSlot?.id ?? ""}
            onChange={(e) => setFocusedSlot(e.target.value)}
            aria-label="Active slot"
          >
            {slots.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id}
              </option>
            ))}
          </select>
          <div className="myui-dock__divider" aria-hidden="true" />
        </>
      )}

      {activeSlot && (
        <>
          <div className="myui-dock__group">
            <button
              type="button"
              className={
                "myui-dock__pill" +
                (activeSlot.active === 0 ? " myui-dock__pill--active" : "")
              }
              onClick={() => registry.setActive(activeSlot.id, 0)}
              title="Original"
            >
              orig
            </button>
            {Array.from({ length: activeSlot.variantCount }, (_, i) => i + 1).map(
              (n) => (
                <button
                  key={n}
                  type="button"
                  className={
                    "myui-dock__pill" +
                    (activeSlot.active === n ? " myui-dock__pill--active" : "")
                  }
                  onClick={() => registry.setActive(activeSlot.id, n)}
                  title={`Variant ${n} (press ${n})`}
                >
                  {n}
                </button>
              ),
            )}
          </div>

          <div className="myui-dock__divider" aria-hidden="true" />
        </>
      )}

      <div className="myui-dock__group">
        <button
          type="button"
          className="myui-dock__chip"
          aria-pressed={theme === "dark"}
          title="Toggle theme (T)"
          onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
        >
          {theme === "dark" ? "Dark" : "Light"}
        </button>
        <button
          type="button"
          className="myui-dock__icon"
          onClick={() => setCollapsed(true)}
          title="Collapse (H)"
          aria-label="Collapse dock"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      <div className="myui-dock__divider" aria-hidden="true" />

      <div className="myui-dock__meta">
        <span className="myui-dock__brand">myui</span>
        {activeSlot && (
          <span className="myui-dock__hint">
            {activeSlot.active === 0 ? "original" : `v${activeSlot.active}`} ·{" "}
            {activeSlot.variantCount} variant
            {activeSlot.variantCount === 1 ? "" : "s"}
          </span>
        )}
      </div>
    </aside>
  );
}

// Keep listSlotIds as a side-effect-free reference so registerSlots stays linked.
void listSlotIds;
