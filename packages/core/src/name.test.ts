import { describe, expect, it } from "vitest";
import { inferComponentName } from "./name.js";

describe("inferComponentName", () => {
  it("pascalcases multi-word prompts", () => {
    expect(inferComponentName("pricing section")).toBe("PricingSection");
  });

  it("strips stopwords", () => {
    expect(inferComponentName("a hero with a cta")).toBe("HeroCta");
  });

  it("falls back on empty prompt", () => {
    expect(inferComponentName("")).toBe("Component");
    expect(inferComponentName("!!!")).toBe("Component");
  });

  it("caps at four words", () => {
    expect(inferComponentName("one two three four five six")).toBe(
      "OneTwoThreeFour",
    );
  });
});
