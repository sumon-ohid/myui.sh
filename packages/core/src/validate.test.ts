import { describe, expect, it } from "vitest";
import { validateVariant } from "./validate.js";

const BASE = {
  allowedDependencies: ["react", "lucide-react", "clsx"],
  forbiddenImports: ["styled-components", "@emotion/*"],
  availablePrimitives: [],
  typescript: true,
} as const;

describe("validateVariant", () => {
  it("accepts a clean component", () => {
    const code = `
import React from "react";
import { Check } from "lucide-react";
export default function C() {
  return <button type="button" aria-label="save"><Check /></button>;
}`;
    const r = validateVariant({ ...BASE, code });
    expect(r.ok).toBe(true);
    expect(r.issues.filter((i) => i.severity === "error")).toEqual([]);
  });

  it("rejects forbidden imports", () => {
    const code = `import styled from "styled-components"; export default () => null;`;
    const r = validateVariant({ ...BASE, code });
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.rule === "forbidden-import")).toBe(true);
  });

  it("rejects pattern-forbidden imports", () => {
    const code = `import x from "@emotion/react"; export default () => null;`;
    const r = validateVariant({ ...BASE, code });
    expect(r.issues.some((i) => i.rule === "forbidden-import")).toBe(true);
  });

  it("rejects non-allowlisted imports", () => {
    const code = `import x from "random-pkg"; export default () => null;`;
    const r = validateVariant({ ...BASE, code });
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.rule === "non-allowlisted-import")).toBe(
      true,
    );
  });

  it("allows internal imports", () => {
    const code = `import { X } from "@/components/x"; import { Y } from "./y"; export default () => null;`;
    const r = validateVariant({ ...BASE, code });
    expect(r.ok).toBe(true);
  });

  it("rejects any type", () => {
    const code = `export default function C() { const x: any = 1; return <div>{x}</div>; }`;
    const r = validateVariant({ ...BASE, code });
    expect(r.issues.some((i) => i.rule === "no-any")).toBe(true);
    expect(r.ok).toBe(false);
  });

  it("rejects ts-ignore", () => {
    const code = `// @ts-ignore\nexport default () => null;`;
    const r = validateVariant({ ...BASE, code });
    expect(r.issues.some((i) => i.rule === "no-ts-suppression")).toBe(true);
  });

  it("rejects dangerouslySetInnerHTML", () => {
    const code = `export default () => <div dangerouslySetInnerHTML={{ __html: "x" }} />;`;
    const r = validateVariant({ ...BASE, code });
    expect(r.issues.some((i) => i.rule === "no-dangerous-html")).toBe(true);
  });

  it("flags img without alt", () => {
    const code = `export default () => <img src="x.png" />;`;
    const r = validateVariant({ ...BASE, code });
    expect(r.issues.some((i) => i.rule === "img-alt")).toBe(true);
    expect(r.ok).toBe(false);
  });

  it("flags nameless button", () => {
    const code = `export default () => <button type="button"></button>;`;
    const r = validateVariant({ ...BASE, code });
    expect(r.issues.some((i) => i.rule === "button-name")).toBe(true);
  });

  it("accepts button with text", () => {
    const code = `export default () => <button type="button">Save</button>;`;
    const r = validateVariant({ ...BASE, code });
    expect(r.issues.some((i) => i.rule === "button-name")).toBe(false);
  });

  it("warns on raw button when Button primitive available", () => {
    const code = `export default () => <button type="button">Save</button>;`;
    const r = validateVariant({
      ...BASE,
      code,
      availablePrimitives: [
        { name: "Button", file: "button", exports: ["Button"] },
      ],
    });
    expect(
      r.issues.some(
        (i) => i.rule === "prefer-button-primitive" && i.severity === "warning",
      ),
    ).toBe(true);
    expect(r.ok).toBe(true);
  });

  it("warns on inline style", () => {
    const code = `export default () => <div style={{ color: "red" }} />;`;
    const r = validateVariant({ ...BASE, code });
    expect(r.issues.some((i) => i.rule === "no-inline-style")).toBe(true);
  });
});
