import {
  detectProjectContext,
  formatReport,
  loadConfig,
  readSession,
  refine,
  writeSession,
  writeVariant,
  type GenerationResult,
  type ModelId,
  type Variant,
  type VariantReport,
} from "@myui-sh/core";
import { getStatus, materializeVariants, startDaemon } from "@myui-sh/preview";
import * as p from "@clack/prompts";
import type { Command } from "commander";
import pc from "picocolors";

interface RefineCliOptions {
  readonly model?: string;
  readonly out?: string;
}

function parseModel(raw: string | undefined): ModelId {
  if (!raw || raw === "sonnet") return "claude-sonnet-4-6";
  if (raw === "opus") return "claude-opus-4-7";
  if (raw === "claude-sonnet-4-6" || raw === "claude-opus-4-7") return raw;
  throw new Error(`--model must be sonnet or opus (got "${raw}")`);
}

function renderReports(reports: readonly VariantReport[]): void {
  for (const r of reports) {
    if (r.report.issues.length === 0) continue;
    p.note(formatReport(r.report), pc.red(`Variant ${r.variantId}`));
  }
}

async function pickVariant(
  result: GenerationResult,
): Promise<Variant | null> {
  if (result.variants.length === 1) {
    const only = result.variants[0];
    return only ?? null;
  }
  const choice = await p.select({
    message: "Which refined variant would you like to keep?",
    options: [
      ...result.variants.map((v) => ({
        value: String(v.id),
        label: `Variant ${v.id}`,
        hint: v.description,
      })),
      { value: "cancel", label: "Cancel — discard all" },
    ],
  });
  if (p.isCancel(choice) || choice === "cancel") return null;
  return result.variants.find((v) => String(v.id) === choice) ?? null;
}

export function registerRefine(program: Command): void {
  program
    .command("refine <instruction>")
    .description("Refine the most recently generated component")
    .option("-m, --model <id>", "sonnet | opus")
    .option("-o, --out <dir>", "Override components directory")
    .action(async (instruction: string, opts: RefineCliOptions) => {
      const cwd = process.cwd();
      p.intro(pc.bgCyan(pc.black(" myui refine ")));

      const session = await readSession(cwd);
      if (!session) {
        p.cancel("No prior session found. Run `myui generate` first.");
        process.exitCode = 1;
        return;
      }

      const ctx = await detectProjectContext(cwd);
      const config = await loadConfig(ctx);
      const componentsDir = opts.out
        ? opts.out.startsWith("/")
          ? opts.out
          : `${cwd}/${opts.out}`
        : ctx.componentsDir;

      const model = opts.model ? parseModel(opts.model) : (session.model as ModelId);

      const spinner = p.spinner();
      spinner.start(
        `Refining ${session.componentName} (session ${session.sessionId.slice(0, 8)}…)`,
      );

      const outcome = await refine({
        instruction,
        sessionId: session.sessionId,
        context: ctx,
        variantCount: session.variantCount,
        model,
        cwd,
        config,
        previousPrompt: session.prompt,
      });

      if (!outcome.ok) {
        spinner.stop(pc.red(`✗ ${outcome.error.message}`));
        if (outcome.reports) renderReports(outcome.reports);
        process.exitCode = 1;
        return;
      }

      const repairNote =
        outcome.repairsUsed > 0
          ? ` after ${outcome.repairsUsed} repair${outcome.repairsUsed === 1 ? "" : "s"}`
          : "";
      spinner.stop(
        pc.green(
          `✓ Refined ${outcome.result.variants.length} variant(s)${repairNote} ` +
            `($${outcome.costUsd.toFixed(4)})`,
        ),
      );

      try {
        await materializeVariants({
          projectRoot: cwd,
          componentName: session.componentName,
          variants: outcome.result.variants.map((v) => ({
            id: v.id,
            code: v.code,
          })),
        });
        const status = await getStatus(cwd);
        const running = status.running
          ? status
          : await startDaemon({ projectRoot: cwd });
        p.note(running.url ?? "(no url)", "Preview");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        p.note(msg, pc.yellow("Preview unavailable"));
      }

      const picked = await pickVariant(outcome.result);
      if (!picked) {
        p.cancel("Cancelled.");
        return;
      }

      const written = await writeVariant({
        projectRoot: cwd,
        componentsDir,
        componentName: session.componentName,
        code: picked.code,
        extension: ctx.typescript ? "tsx" : "jsx",
      });

      p.note(written.relPath, "Wrote component");

      try {
        await writeSession(cwd, {
          sessionId: outcome.sessionId,
          componentName: session.componentName,
          prompt: session.prompt,
          scope: session.scope,
          model,
          variantCount: session.variantCount,
        });
      } catch {
        // ignore session-persist failure
      }

      p.outro(pc.dim(`session: ${outcome.sessionId}`));
    });
}
