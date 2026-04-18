import { z } from "zod";

export const VariantIdSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);

export const VariantSchema = z
  .object({
    id: VariantIdSchema,
    description: z.string().min(1).max(200),
    code: z.string().min(1),
  })
  .strict();

export const GenerationResultSchema = z
  .object({
    componentName: z
      .string()
      .regex(/^[A-Z][A-Za-z0-9]*$/, "PascalCase identifier required"),
    variants: z.array(VariantSchema).min(1).max(3),
    dependencies: z.array(z.string()).default([]),
  })
  .strict()
  .superRefine((val, ctx) => {
    const ids = val.variants.map((v) => v.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "variant ids must be unique",
        path: ["variants"],
      });
    }
  });

export type Variant = z.infer<typeof VariantSchema>;
export type GenerationResult = z.infer<typeof GenerationResultSchema>;
