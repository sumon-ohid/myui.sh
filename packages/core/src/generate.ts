import {
  createSdkMcpServer,
  query,
  tool,
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { defaultConfig, type MyUiConfig } from "./config.js";
import type { ProjectContext } from "./context.js";
import { GenerationError, SchemaValidationError } from "./errors.js";
import { buildSystemPrompt, buildUserPrompt } from "./prompt.js";
import {
  GenerationResultSchema,
  type GenerationResult,
} from "./schema.js";
import { classifyScope, type ComponentScope, type ScopeHint } from "./scope.js";
import { scanShadcnPrimitives, type ShadcnPrimitive } from "./shadcn.js";
import {
  formatReport,
  validateVariant,
  type ValidationReport,
} from "./validate.js";

export type ModelId = "claude-sonnet-4-6" | "claude-opus-4-7";

export interface GenerateOptions {
  readonly userPrompt: string;
  readonly context: ProjectContext;
  readonly variantCount: 1 | 2 | 3;
  readonly model?: ModelId;
  readonly cwd?: string;
  readonly maxTurns?: number;
  readonly maxRepairs?: number;
  readonly config?: MyUiConfig;
}

export interface VariantReport {
  readonly variantId: 1 | 2 | 3;
  readonly report: ValidationReport;
}

export interface GenerateSuccess {
  readonly ok: true;
  readonly result: GenerationResult;
  readonly sessionId: string;
  readonly costUsd: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly scope: ComponentScope;
  readonly reports: readonly VariantReport[];
  readonly repairsUsed: number;
}

export interface GenerateFailure {
  readonly ok: false;
  readonly error: Error;
  readonly sessionId?: string;
  readonly reports?: readonly VariantReport[];
}

export type GenerateOutcome = GenerateSuccess | GenerateFailure;

const variantInputShape = {
  componentName: z
    .string()
    .regex(/^[A-Z][A-Za-z0-9]*$/, "PascalCase identifier required"),
  variants: z
    .array(
      z.object({
        id: z.union([z.literal(1), z.literal(2), z.literal(3)]),
        description: z.string().min(1).max(200),
        code: z.string().min(1),
      }),
    )
    .min(1)
    .max(3),
  dependencies: z.array(z.string()),
};

interface RunArgs {
  readonly prompt: string;
  readonly systemPrompt: string;
  readonly model: ModelId;
  readonly maxTurns: number;
  readonly cwd: string | undefined;
  readonly resume: string | undefined;
}

interface RunResult {
  readonly captured: unknown;
  readonly sessionId: string | undefined;
  readonly costUsd: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

async function runQuery(args: RunArgs): Promise<RunResult> {
  let captured: unknown;
  const emitTool = tool(
    "emit_variants",
    "Emit the final generated component variants. Call this exactly once per generation.",
    variantInputShape,
    async (toolArgs) => {
      captured = toolArgs;
      return {
        content: [{ type: "text" as const, text: "Variants captured." }],
      };
    },
  );

  const outputServer = createSdkMcpServer({
    name: "myui-output",
    version: "0.0.0",
    tools: [emitTool],
  });

  let sessionId: string | undefined;
  let costUsd = 0;
  let inputTokens = 0;
  let outputTokens = 0;

  for await (const message of query({
    prompt: args.prompt,
    options: {
      model: args.model,
      systemPrompt: args.systemPrompt,
      mcpServers: { "myui-output": outputServer },
      allowedTools: ["mcp__myui-output__emit_variants"],
      permissionMode: "default",
      maxTurns: args.maxTurns,
      ...(args.cwd ? { cwd: args.cwd } : {}),
      ...(args.resume ? { resume: args.resume } : {}),
    },
  })) {
    if (message.type === "result") {
      const m = message as unknown as {
        session_id?: string;
        total_cost_usd?: number;
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      sessionId = m.session_id;
      costUsd = m.total_cost_usd ?? 0;
      inputTokens = m.usage?.input_tokens ?? 0;
      outputTokens = m.usage?.output_tokens ?? 0;
    }
  }

  return { captured, sessionId, costUsd, inputTokens, outputTokens };
}

function parseResult(captured: unknown): GenerationResult | Error {
  if (captured === undefined) {
    return new GenerationError(
      "Model did not call `emit_variants`. Try again or raise maxTurns.",
    );
  }
  const parsed = GenerationResultSchema.safeParse(captured);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    }));
    return new SchemaValidationError(
      "emit_variants payload failed schema validation.",
      issues,
    );
  }
  return parsed.data;
}

function validateAll(
  result: GenerationResult,
  config: MyUiConfig,
  primitives: readonly ShadcnPrimitive[],
  typescript: boolean,
): VariantReport[] {
  return result.variants.map((v) => ({
    variantId: v.id,
    report: validateVariant({
      code: v.code,
      allowedDependencies: config.allowedDependencies,
      forbiddenImports: config.forbiddenImports,
      availablePrimitives: primitives,
      typescript,
    }),
  }));
}

function buildRepairPrompt(
  reports: readonly VariantReport[],
  scope: ScopeHint,
): string {
  const failing = reports.filter((r) => !r.report.ok);
  const lines = [
    `Your previous \`emit_variants\` output failed validation. Regenerate ONLY the failing variants, keeping their ids stable. Call \`emit_variants\` again with the fixed variants plus any passing ones unchanged.`,
    ``,
    `Scope reminder: ${scope.scope}, ≤${scope.lineBudget} lines.`,
    ``,
    `Failures:`,
    ...failing.map(
      (f) =>
        `\nVariant ${f.variantId}:\n${formatReport(f.report)
          .split("\n")
          .map((l) => `  ${l}`)
          .join("\n")}`,
    ),
    ``,
    `Fix each issue by its rule name. Do not introduce new imports outside the allowlist.`,
  ];
  return lines.join("\n");
}

export async function generate(
  options: GenerateOptions,
): Promise<GenerateOutcome> {
  const scope = classifyScope(options.userPrompt);
  const primitives = await scanShadcnPrimitives(options.context);
  const config = options.config ?? defaultConfig();
  const model = options.model ?? "claude-sonnet-4-6";
  const maxTurns = options.maxTurns ?? 4;
  const maxRepairs = options.maxRepairs ?? 2;

  const promptArgs = {
    userPrompt: options.userPrompt,
    context: options.context,
    variantCount: options.variantCount,
    scope,
    primitives,
  };
  const systemPrompt = buildSystemPrompt(promptArgs);
  const initialPrompt = buildUserPrompt(promptArgs);

  let totalCost = 0;
  let totalIn = 0;
  let totalOut = 0;
  let sessionId: string | undefined;
  let lastResult: GenerationResult | undefined;
  let lastReports: VariantReport[] = [];
  let repairsUsed = 0;

  let nextPrompt: string = initialPrompt;
  let resume: string | undefined;

  for (let attempt = 0; attempt <= maxRepairs; attempt++) {
    let run: RunResult;
    try {
      run = await runQuery({
        prompt: nextPrompt,
        systemPrompt,
        model,
        maxTurns,
        cwd: options.cwd,
        resume,
      });
    } catch (cause) {
      return {
        ok: false,
        ...(sessionId ? { sessionId } : {}),
        error: new GenerationError("SDK query failed.", cause),
        ...(lastReports.length > 0 ? { reports: lastReports } : {}),
      };
    }

    totalCost += run.costUsd;
    totalIn += run.inputTokens;
    totalOut += run.outputTokens;
    if (run.sessionId) sessionId = run.sessionId;

    const parsed = parseResult(run.captured);
    if (parsed instanceof Error) {
      return {
        ok: false,
        ...(sessionId ? { sessionId } : {}),
        error: parsed,
        ...(lastReports.length > 0 ? { reports: lastReports } : {}),
      };
    }

    lastResult = parsed;
    lastReports = validateAll(
      parsed,
      config,
      primitives,
      options.context.typescript,
    );

    const failing = lastReports.filter((r) => !r.report.ok);
    if (failing.length === 0) break;

    if (attempt === maxRepairs) break;

    repairsUsed += 1;
    nextPrompt = buildRepairPrompt(lastReports, scope);
    resume = sessionId;
  }

  if (!lastResult) {
    return {
      ok: false,
      ...(sessionId ? { sessionId } : {}),
      error: new GenerationError("No result produced."),
    };
  }

  if (!sessionId) {
    return {
      ok: false,
      error: new GenerationError("SDK did not return a session id."),
    };
  }

  const stillFailing = lastReports.some((r) => !r.report.ok);
  if (stillFailing) {
    return {
      ok: false,
      sessionId,
      reports: lastReports,
      error: new GenerationError(
        `Validation still failing after ${repairsUsed} repair attempt(s).`,
      ),
    };
  }

  return {
    ok: true,
    result: lastResult,
    sessionId,
    costUsd: totalCost,
    inputTokens: totalIn,
    outputTokens: totalOut,
    scope: scope.scope,
    reports: lastReports,
    repairsUsed,
  };
}
