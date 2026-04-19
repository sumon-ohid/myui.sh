import React, { useCallback, useEffect, useMemo, useState } from "react";

type VariantModule = { default: React.ComponentType };

const eagerModules = import.meta.glob<VariantModule>("./variants/Variant*.tsx", {
  eager: true,
});

interface VariantEntry {
  readonly id: number;
  readonly Component: React.ComponentType;
}

function loadVariants(): VariantEntry[] {
  const out: VariantEntry[] = [];
  for (const [path, mod] of Object.entries(eagerModules)) {
    const match = path.match(/Variant(\d+)\.tsx$/);
    if (!match || !match[1]) continue;
    const id = Number.parseInt(match[1], 10);
    if (Number.isNaN(id)) continue;
    out.push({ id, Component: mod.default });
  }
  out.sort((a, b) => a.id - b.id);
  return out;
}

type Density = "comfortable" | "compact";
type Theme = "light" | "dark";

const STAGE_BG: Record<Theme, string> = {
  light: "#fafafa",
  dark: "#0b0b0c",
};

export function Shell(): React.ReactElement {
  const [variants, setVariants] = useState<VariantEntry[]>(() => loadVariants());
  const [active, setActive] = useState<number>(() => {
    const first = loadVariants()[0];
    return first ? first.id : 1;
  });
  const [density, setDensity] = useState<Density>("comfortable");
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    if (!import.meta.hot) return;
    import.meta.hot.accept(() => {
      const next = loadVariants();
      setVariants(next);
      if (!next.some((v) => v.id === active) && next[0]) {
        setActive(next[0].id);
      }
    });
  }, [active]);

  const ordered = useMemo(() => variants, [variants]);
  const currentIndex = ordered.findIndex((v) => v.id === active);
  const safeIndex = currentIndex === -1 ? 0 : currentIndex;
  const current = ordered[safeIndex];

  const goTo = useCallback(
    (delta: number) => {
      if (ordered.length === 0) return;
      const next = (safeIndex + delta + ordered.length) % ordered.length;
      const target = ordered[next];
      if (target) setActive(target.id);
    },
    [ordered, safeIndex],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement) {
        const tag = e.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable)
          return;
      }
      if (e.key === "ArrowLeft" || e.key === "[") {
        e.preventDefault();
        goTo(-1);
      } else if (e.key === "ArrowRight" || e.key === "]") {
        e.preventDefault();
        goTo(1);
      } else if (/^[1-9]$/.test(e.key)) {
        const n = Number.parseInt(e.key, 10);
        const target = ordered.find((v) => v.id === n);
        if (target) setActive(target.id);
      } else if (e.key === "d" || e.key === "D") {
        setDensity((d) => (d === "comfortable" ? "compact" : "comfortable"));
      } else if (e.key === "t" || e.key === "T") {
        setTheme((t) => (t === "light" ? "dark" : "light"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, ordered]);

  if (ordered.length === 0) {
    return (
      <main className="shell shell--empty">
        <div className="shell__brand">myui</div>
        <h1>No variants yet</h1>
        <p>
          Run <code>myui generate &quot;…&quot;</code> in another terminal.
        </p>
      </main>
    );
  }

  if (!current) {
    return (
      <main className="shell shell--empty">
        <h1>No variants</h1>
      </main>
    );
  }
  const Active = current.Component;
  const stageStyle: React.CSSProperties = {
    background: STAGE_BG[theme],
    padding: density === "compact" ? "1rem" : "2.5rem",
  };
  const frameStyle: React.CSSProperties = {
    minHeight: "100%",
    display: "flex",
    alignItems: density === "compact" ? "stretch" : "flex-start",
    justifyContent: "center",
  };

  return (
    <div className={`shell shell--${theme}`}>
      <main className="shell__stage" style={stageStyle}>
        <div style={frameStyle}>
          <Active />
        </div>
      </main>

      <aside
        className="dock"
        role="toolbar"
        aria-label="Variant controls"
        data-theme={theme}
      >
        <div className="dock__group">
          <button
            type="button"
            className="dock__icon"
            aria-label="Previous variant"
            title="Previous (←)"
            onClick={() => goTo(-1)}
            disabled={ordered.length < 2}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <div className="dock__pills" role="tablist">
            {ordered.map((v) => (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={v.id === current.id}
                title={`Variant ${v.id} (press ${v.id})`}
                className={
                  "dock__pill" +
                  (v.id === current.id ? " dock__pill--active" : "")
                }
                onClick={() => setActive(v.id)}
              >
                {v.id}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="dock__icon"
            aria-label="Next variant"
            title="Next (→)"
            onClick={() => goTo(1)}
            disabled={ordered.length < 2}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        <div className="dock__divider" aria-hidden="true" />

        <div className="dock__group">
          <button
            type="button"
            className="dock__chip"
            aria-pressed={density === "compact"}
            title="Toggle density (D)"
            onClick={() =>
              setDensity((d) => (d === "comfortable" ? "compact" : "comfortable"))
            }
          >
            {density === "compact" ? "Compact" : "Comfortable"}
          </button>
          <button
            type="button"
            className="dock__chip"
            aria-pressed={theme === "dark"}
            title="Toggle theme (T)"
            onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
          >
            {theme === "dark" ? "Dark" : "Light"}
          </button>
        </div>

        <div className="dock__divider" aria-hidden="true" />

        <div className="dock__meta">
          <span className="dock__brand">myui</span>
          <span className="dock__hint">
            {safeIndex + 1} / {ordered.length} · pick in terminal
          </span>
        </div>
      </aside>
    </div>
  );
}
