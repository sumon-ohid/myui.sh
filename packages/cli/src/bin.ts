#!/usr/bin/env node
import { Command } from "commander";
import { registerDaemon } from "./commands/daemon.js";
import { registerGenerate } from "./commands/generate.js";
import { registerInit } from "./commands/init.js";
import { registerRefine } from "./commands/refine.js";
import { registerSmoke } from "./commands/smoke.js";

function installSignalHandlers(): void {
  const onSignal = (sig: NodeJS.Signals) => {
    process.stderr.write(`\nmyui: received ${sig}, exiting\n`);
    process.exit(130);
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
}

function main(): void {
  installSignalHandlers();
  const program = new Command();

  program
    .name("myui")
    .description("AI UI design CLI — generate production-ready components")
    .version("0.0.0");

  registerInit(program);
  registerGenerate(program);
  registerRefine(program);
  registerDaemon(program);
  registerSmoke(program);

  program.parseAsync(process.argv).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`myui: ${msg}\n`);
    process.exit(1);
  });
}

main();
