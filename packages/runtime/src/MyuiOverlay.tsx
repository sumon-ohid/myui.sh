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
        <span style={{ fontWeight: 600, padding: "0 0.25rem", color: "#000000" }}>myui</span>
        <span style={{ opacity: 0.5, fontSize: "11px" }}>no slots active</span>
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
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 16 16 12 12 8"></polyline>
          <line x1="8" y1="12" x2="16" y2="12"></line>
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
      <div className="myui-dock__drag" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle cx="8" cy="6" r="1.5" fill="currentColor" />
          <circle cx="16" cy="6" r="1.5" fill="currentColor" />
          <circle cx="8" cy="12" r="1.5" fill="currentColor" />
          <circle cx="16" cy="12" r="1.5" fill="currentColor" />
          <circle cx="8" cy="18" r="1.5" fill="currentColor" />
          <circle cx="16" cy="18" r="1.5" fill="currentColor" />
        </svg>
      </div>

      {slots.length > 1 ? (
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
      ) : (
        <div style={{ padding: "0 0.5rem", fontWeight: 500 }}>
          {activeSlot?.id || "myui"}
        </div>
      )}

      <div className="myui-dock__divider" aria-hidden="true" />

      {activeSlot && (
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
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
                v{n}
              </button>
            ),
          )}
        </div>
      )}

      <div className="myui-dock__divider" aria-hidden="true" />

      <div className="myui-dock__group">
        {activeSlot && activeSlot.active > 0 && (
          <ApplyButton slotId={activeSlot.id} variantIndex={activeSlot.active} />
        )}
        
        <button
          type="button"
          className="myui-dock__icon"
          onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
          title="Toggle theme (T)"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
          )}
        </button>

        <button
          type="button"
          className="myui-dock__icon"
          onClick={() => setCollapsed(true)}
          title="More options / Collapse (H)"
          aria-label="Collapse dock"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="1"></circle>
            <circle cx="19" cy="12" r="1"></circle>
            <circle cx="5" cy="12" r="1"></circle>
          </svg>
        </button>
      </div>
    </aside>
  );
}

function ApplyButton({ slotId, variantIndex }: { slotId: string; variantIndex: number }) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  const apply = async () => {
    setStatus("loading");
    try {
      const res = await fetch("/api/myui/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId, variantIndex }),
      });
      if (!res.ok) throw new Error(await res.text());
      setStatus("done");
      setTimeout(() => window.location.reload(), 600);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2000);
    }
  };

  return (
    <button
      type="button"
      className="myui-dock__chip myui-dock__chip--apply"
      onClick={apply}
      disabled={status === "loading" || status === "done"}
      title={`Apply variant ${variantIndex} to codebase`}
    >
      {status === "loading" ? (
        <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
        </svg>
      ) : status === "done" ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      ) : status === "error" ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
          </svg>
          <span style={{ marginLeft: "4px" }}>Apply</span>
        </>
      )}
    </button>
  );
}

// Keep listSlotIds as a side-effect-free reference so registerSlots stays linked.
void listSlotIds;
