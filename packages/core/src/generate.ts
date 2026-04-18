import {
  createSdkMcpServer,
  query,
  tool,
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { ProjectContext } from "./context.js";
import { GenerationError, SchemaValidationError } from "./errors.js";
import { buildSystemPrompt, buildUserPrompt } from "./prompt.js";
import {
  GenerationResultSchema,
  type GenerationResult,
} from "./schema.js";

export type ModelId = "claude-sonnet-4-6" | "claude-opus-4-7";

export interface GenerateOptions {
  readonly userPrompt: string;
  readonly context: ProjectContext;
  readonly variantCount: 1 | 2 | 3;
  readonly model?: ModelId;
  readonly cwd?: string;
  readonly maxTurns?: number;
}

export interface GenerateSuccess {
  readonly ok: true;
  readonly result: GenerationResult;
  readonly sessionId: string;
  readonly costUsd: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface GenerateFailure {
  readonly ok: false;
  readonly error: Error;
  readonly sessionId?: string;
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

export async function generate(
  options: GenerateOptions,
): Promise<GenerateOutcome> {
  const systemPrompt = buildSystemPrompt({
    userPrompt: options.userPrompt,
    context: options.context,
    variantCount: options.variantCount,
  });
  const userPrompt = buildUserPrompt({
    userPrompt: options.userPrompt,
    context: options.context,
    variantCount: options.variantCount,
  });

  let captured: unknown;

  const emitTool = tool(
    "emit_variants",
    "Emit the final generated component variants. Call this exactly once per generation.",
    variantInputShape,
    async (args) => {
      captured = args;
      return {
        content: [
          {
            type: "text" as const,
            text: "Variants captured.",
          },
        ],
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

  try {
    for await (const message of query({
      prompt: userPrompt,
      options: {
        model: options.model ?? "claude-sonnet-4-6",
        systemPrompt,
        mcpServers: { "myui-output": outputServer },
        allowedTools: ["mcp__myui-output__emit_variants"],
        permissionMode: "default",
        maxTurns: options.maxTurns ?? 4,
        ...(options.cwd ? { cwd: options.cwd } : {}),
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
  } catch (cause) {
    return {
      ok: false,
      error: new GenerationError(
        "SDK query failed while generating variants.",
        cause,
      ),
    };
  }

  if (captured === undefined) {
    return {
      ok: false,
      ...(sessionId ? { sessionId } : {}),
      error: new GenerationError(
        "Model did not call `emit_variants`. Try again or raise maxTurns.",
      ),
    };
  }

  const parsed = GenerationResultSchema.safeParse(captured);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    }));
    return {
      ok: false,
      ...(sessionId ? { sessionId } : {}),
      error: new SchemaValidationError(
        "emit_variants payload failed schema validation.",
        issues,
      ),
    };
  }

  if (!sessionId) {
    return {
      ok: false,
      error: new GenerationError("SDK did not return a session id."),
    };
  }

  return {
    ok: true,
    result: parsed.data,
    sessionId,
    costUsd,
    inputTokens,
    outputTokens,
  };
}
