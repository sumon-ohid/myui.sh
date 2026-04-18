#!/usr/bin/env node
import { Command } from "commander";
import { registerGenerate } from "./commands/generate.js";
import { registerInit } from "./commands/init.js";

function main(): void {
  const program = new Command();

  program
    .name("myui")
    .description("AI UI design CLI — generate production-ready components")
    .version("0.0.0");

  registerInit(program);
  registerGenerate(program);

  program.parseAsync(process.argv).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`myui: ${msg}\n`);
    process.exit(1);
  });
}

main();
