import {
  detectProjectContext,
  formatReport,
  generate,
  inferComponentName,
  loadConfig,
  writeVariant,
  type GenerationResult,
  type ModelId,
  type Variant,
  type VariantReport,
} from "@myui/core";
import { getStatus, materializeVariants, startDaemon } from "@myui/preview";
import * as p from "@clack/prompts";
import type { Command } from "commander";
import pc from "picocolors";

interface GenerateCliOptions {
  readonly variants?: string;
  readonly model?: string;
  readonly out?: string;
}

function renderReports(reports: readonly VariantReport[]): void {
  for (const r of reports) {
    if (r.report.issues.length === 0) continue;
    p.note(formatReport(r.report), pc.red(`Variant ${r.variantId}`));
  }
}

function parseVariantCount(raw: string | undefined): 1 | 2 | 3 {
  if (!raw) return 1;
  const n = Number.parseInt(raw, 10);
  if (n === 1 || n === 2 || n === 3) return n;
  throw new Error(`--variants must be 1, 2, or 3 (got "${raw}")`);
}

function parseModel(raw: string | undefined): ModelId {
  if (!raw || raw === "sonnet") return "claude-sonnet-4-6";
  if (raw === "opus") return "claude-opus-4-7";
  if (raw === "claude-sonnet-4-6" || raw === "claude-opus-4-7") return raw;
  throw new Error(`--model must be sonnet or opus (got "${raw}")`);
}

async function pickVariant(
  result: GenerationResult,
): Promise<Variant | null> {
  if (result.variants.length === 1) {
    const only = result.variants[0];
    if (!only) return null;
    return only;
  }

  const choice = await p.select({
    message: "Which variant would you like to keep?",
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
  const picked = result.variants.find((v) => String(v.id) === choice);
  return picked ?? null;
}

export function registerGenerate(program: Command): void {
  program
    .command("generate <prompt>")
    .alias("gen")
    .description("Generate a UI component from a prompt")
    .option("-v, --variants <n>", "Number of variants (1-3)", "1")
    .option("-m, --model <id>", "sonnet | opus", "sonnet")
    .option("-o, --out <dir>", "Override components directory")
    .action(async (prompt: string, opts: GenerateCliOptions) => {
      const variantCount = parseVariantCount(opts.variants);
      const model = parseModel(opts.model);

      const cwd = process.cwd();
      p.intro(pc.bgCyan(pc.black(" myui ")));

      const ctx = await detectProjectContext(cwd);
      const config = await loadConfig(ctx);
      const componentsDir = opts.out
        ? opts.out.startsWith("/")
          ? opts.out
          : `${cwd}/${opts.out}`
        : ctx.componentsDir;

      const spinner = p.spinner();
      spinner.start(
        `Generating ${variantCount} variant(s) with ${model}…`,
      );

      const outcome = await generate({
        userPrompt: prompt,
        context: ctx,
        variantCount,
        model,
        cwd,
        config,
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
          `✓ Generated ${outcome.result.variants.length} variant(s)${repairNote} ` +
            `(${outcome.inputTokens + outcome.outputTokens} tokens, ` +
            `$${outcome.costUsd.toFixed(4)})`,
        ),
      );

      const warnings = outcome.reports.flatMap((r) =>
        r.report.issues.filter((i) => i.severity === "warning"),
      );
      if (warnings.length > 0) {
        p.note(
          warnings
            .slice(0, 8)
            .map((w) => `• ${w.rule}: ${w.message}`)
            .join("\n"),
          pc.yellow("Warnings"),
        );
      }

      const name =
        outcome.result.componentName ||
        inferComponentName(prompt);

      try {
        await materializeVariants({
          projectRoot: cwd,
          componentName: name,
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
        componentName: name,
        code: picked.code,
        extension: ctx.typescript ? "tsx" : "jsx",
      });

      p.note(written.relPath, "Wrote component");

      if (outcome.result.dependencies.length > 0) {
        p.note(
          `${ctx.packageManager} add ${outcome.result.dependencies.join(" ")}`,
          "Install dependencies",
        );
      }

      p.outro(pc.dim(`session: ${outcome.sessionId}`));
    });
}
