export { detectProjectContext } from "./context.js";
export type {
  Framework,
  PackageManager,
  ProjectContext,
  TailwindVersion,
} from "./context.js";
export {
  ContextDetectionError,
  FileWriteError,
  GenerationError,
  MyUiError,
  SchemaValidationError,
} from "./errors.js";
export { generate } from "./generate.js";
export type {
  GenerateFailure,
  GenerateOptions,
  GenerateOutcome,
  GenerateSuccess,
  ModelId,
} from "./generate.js";
export { inferComponentName } from "./name.js";
export {
  GenerationResultSchema,
  VariantIdSchema,
  VariantSchema,
} from "./schema.js";
export type { GenerationResult, Variant } from "./schema.js";
export { writeVariant } from "./write.js";
export type { WriteVariantArgs, WriteVariantResult } from "./write.js";
