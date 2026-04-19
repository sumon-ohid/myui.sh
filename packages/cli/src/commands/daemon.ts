import { getStatus, startDaemon, stopDaemon } from "@myui-sh/preview";
import * as p from "@clack/prompts";
import type { Command } from "commander";
import pc from "picocolors";

export function registerDaemon(program: Command): void {
  const cmd = program
    .command("daemon")
    .description("Manage the preview daemon");

  cmd
    .command("start")
    .description("Start preview daemon for current project")
    .action(async () => {
      const cwd = process.cwd();
      p.intro(pc.bgCyan(pc.black(" myui daemon ")));
      const spinner = p.spinner();
      spinner.start("Starting Vite daemon…");
      try {
        const status = await startDaemon({ projectRoot: cwd });
        spinner.stop(pc.green(`✓ Running at ${status.url} (pid ${status.pid})`));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        spinner.stop(pc.red(`✗ ${msg}`));
        process.exitCode = 1;
      }
      p.outro("");
    });

  cmd
    .command("stop")
    .description("Stop preview daemon")
    .action(async () => {
      const killed = await stopDaemon(process.cwd());
      process.stdout.write(
        killed ? pc.green("✓ Stopped\n") : pc.dim("Not running\n"),
      );
    });

  cmd
    .command("status")
    .description("Show daemon status")
    .action(async () => {
      const s = await getStatus(process.cwd());
      if (s.running) {
        process.stdout.write(
          `${pc.green("●")} running  pid=${s.pid}  ${s.url}\n`,
        );
      } else {
        process.stdout.write(`${pc.dim("○")} stopped\n`);
      }
    });
}
