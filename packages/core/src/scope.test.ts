import { describe, expect, it } from "vitest";
import { classifyScope } from "./scope.js";

describe("classifyScope", () => {
  it("classifies button as atom", () => {
    expect(classifyScope("red button").scope).toBe("atom");
  });

  it("classifies card as molecule", () => {
    expect(classifyScope("user profile card").scope).toBe("molecule");
  });

  it("classifies hero as section with pattern ref", () => {
    const r = classifyScope("hero for saas landing");
    expect(r.scope).toBe("section");
    expect(r.patternRef).toMatch(/hero:/);
  });

  it("classifies dashboard as page", () => {
    expect(classifyScope("analytics dashboard").scope).toBe("page");
  });

  it("picks pricing pattern ref", () => {
    const r = classifyScope("pricing section with 3 tiers");
    expect(r.patternRef).toMatch(/pricing:/);
  });

  it("falls back to atom on short prompt", () => {
    expect(classifyScope("tag").scope).toBe("atom");
  });
});
