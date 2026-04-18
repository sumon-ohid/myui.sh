export class MyUiError extends Error {
  override name = "MyUiError";
  readonly code: string;
  override readonly cause?: unknown;
  constructor(message: string, code: string, cause?: unknown) {
    super(message);
    this.code = code;
    this.cause = cause;
  }
}

export class GenerationError extends MyUiError {
  override name = "GenerationError";
  constructor(message: string, cause?: unknown) {
    super(message, "GENERATION_FAILED", cause);
  }
}

export class SchemaValidationError extends MyUiError {
  override name = "SchemaValidationError";
  constructor(
    message: string,
    readonly issues: readonly { path: string; message: string }[],
  ) {
    super(message, "SCHEMA_INVALID");
  }
}

export class ContextDetectionError extends MyUiError {
  override name = "ContextDetectionError";
  constructor(message: string, cause?: unknown) {
    super(message, "CONTEXT_DETECTION_FAILED", cause);
  }
}

export class FileWriteError extends MyUiError {
  override name = "FileWriteError";
  constructor(message: string, cause?: unknown) {
    super(message, "FILE_WRITE_FAILED", cause);
  }
}
