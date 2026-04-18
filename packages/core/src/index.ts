export {
  DEFAULT_ALLOWED,
  DEFAULT_FORBIDDEN,
  defaultConfig,
  loadConfig,
} from "./config.js";
export type { MyUiConfig } from "./config.js";
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
  VariantReport,
} from "./generate.js";
export { formatReport, validateVariant } from "./validate.js";
export type { Severity, ValidationIssue, ValidationReport } from "./validate.js";
export { inferComponentName } from "./name.js";
export { classifyScope } from "./scope.js";
export type { ComponentScope, ScopeHint } from "./scope.js";
export { scanShadcnPrimitives } from "./shadcn.js";
export type { ShadcnPrimitive } from "./shadcn.js";
export {
  GenerationResultSchema,
  VariantIdSchema,
  VariantSchema,
} from "./schema.js";
export type { GenerationResult, Variant } from "./schema.js";
export { writeVariant } from "./write.js";
export type { WriteVariantArgs, WriteVariantResult } from "./write.js";
