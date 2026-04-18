import { describe, expect, it } from "vitest";
import { GenerationResultSchema } from "./schema.js";

describe("GenerationResultSchema", () => {
  const validVariant = {
    id: 1 as const,
    description: "Minimal button",
    code: "export const Button = () => <button />;",
  };

  it("accepts a minimal valid result", () => {
    const result = GenerationResultSchema.parse({
      componentName: "Button",
      variants: [validVariant],
      dependencies: [],
    });
    expect(result.componentName).toBe("Button");
  });

  it("rejects lowercase component name", () => {
    expect(() =>
      GenerationResultSchema.parse({
        componentName: "button",
        variants: [validVariant],
        dependencies: [],
      }),
    ).toThrow(/PascalCase/);
  });

  it("rejects duplicate variant ids", () => {
    expect(() =>
      GenerationResultSchema.parse({
        componentName: "Button",
        variants: [validVariant, { ...validVariant }],
        dependencies: [],
      }),
    ).toThrow(/unique/);
  });

  it("rejects variant id out of enum", () => {
    expect(() =>
      GenerationResultSchema.parse({
        componentName: "Button",
        variants: [{ ...validVariant, id: 4 }],
        dependencies: [],
      }),
    ).toThrow();
  });

  it("rejects more than 3 variants", () => {
    expect(() =>
      GenerationResultSchema.parse({
        componentName: "Button",
        variants: [
          { ...validVariant, id: 1 },
          { ...validVariant, id: 2 },
          { ...validVariant, id: 3 },
          { ...validVariant, id: 1 },
        ],
        dependencies: [],
      }),
    ).toThrow();
  });

  it("rejects extra properties", () => {
    expect(() =>
      GenerationResultSchema.parse({
        componentName: "Button",
        variants: [validVariant],
        dependencies: [],
        extra: "nope",
      }),
    ).toThrow();
  });

  it("defaults dependencies to empty array", () => {
    const result = GenerationResultSchema.parse({
      componentName: "Button",
      variants: [validVariant],
    });
    expect(result.dependencies).toEqual([]);
  });
});
