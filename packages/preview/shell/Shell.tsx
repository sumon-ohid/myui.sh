import React, { useEffect, useState } from "react";

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

export function Shell(): React.ReactElement {
  const [variants, setVariants] = useState<VariantEntry[]>(() => loadVariants());
  const [active, setActive] = useState<number>(() => {
    const first = loadVariants()[0];
    return first ? first.id : 1;
  });

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

  if (variants.length === 0) {
    return (
      <main className="shell shell--empty">
        <h1>No variants yet</h1>
        <p>Run <code>myui generate &quot;…&quot;</code> in another terminal.</p>
      </main>
    );
  }

  const current = variants.find((v) => v.id === active) ?? variants[0];
  if (!current) {
    return <main className="shell shell--empty"><h1>No variants</h1></main>;
  }
  const Active = current.Component;

  return (
    <div className="shell">
      <nav className="shell__bar" aria-label="Variants">
        <span className="shell__brand">myui</span>
        <div className="shell__tabs" role="tablist">
          {variants.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={v.id === current.id}
              className={
                "shell__tab" +
                (v.id === current.id ? " shell__tab--active" : "")
              }
              onClick={() => setActive(v.id)}
            >
              Variant {v.id}
            </button>
          ))}
        </div>
        <span className="shell__hint">choose in terminal to keep</span>
      </nav>
      <main className="shell__stage">
        <Active />
      </main>
    </div>
  );
}
