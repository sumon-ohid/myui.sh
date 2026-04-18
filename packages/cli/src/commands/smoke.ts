import { getStatus, materializeVariants, startDaemon } from "@myui/preview";
import * as p from "@clack/prompts";
import type { Command } from "commander";
import { spawn } from "node:child_process";
import pc from "picocolors";

interface SmokeCliOptions {
  readonly open?: boolean;
}

function smokeVariants(): { id: 1 | 2; code: string }[] {
  return [
    {
      id: 1,
      code: `export default function Variant1() {
  return (
    <section style={{
      borderRadius: 16,
      padding: 24,
      background: "#ffffff",
      border: "1px solid #e5e5e5",
      boxShadow: "0 8px 24px rgba(0, 0, 0, 0.06)",
      maxWidth: 760,
      margin: "0 auto",
    }}>
      <h2 style={{ marginTop: 0 }}>Variant 1: Minimal Card</h2>
      <p style={{ color: "#444", lineHeight: 1.6 }}>
        This is the Phase 3 smoke test variant. The preview shell should render this
        component and allow switching to Variant 2.
      </p>
      <button
        type="button"
        style={{
          cursor: "pointer",
          border: "1px solid #111",
          background: "#111",
          color: "#fff",
          borderRadius: 999,
          padding: "10px 16px",
          fontWeight: 600,
        }}
      >
        Primary Action
      </button>
    </section>
  );
}
`,
    },
    {
      id: 2,
      code: `export default function Variant2() {
  return (
    <section style={{
      borderRadius: 20,
      padding: 28,
      background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
      color: "#fff",
      maxWidth: 760,
      margin: "0 auto",
    }}>
      <h2 style={{ marginTop: 0 }}>Variant 2: Contrast Hero</h2>
      <p style={{ color: "#cbd5e1", lineHeight: 1.6 }}>
        This second variant confirms tab switching and HMR in the preview daemon.
      </p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button
          type="button"
          style={{
            cursor: "pointer",
            border: "1px solid #38bdf8",
            background: "#38bdf8",
            color: "#082f49",
            borderRadius: 10,
            padding: "10px 14px",
            fontWeight: 700,
          }}
        >
          Explore
        </button>
        <button
          type="button"
          style={{
            cursor: "pointer",
            border: "1px solid #64748b",
            background: "transparent",
            color: "#e2e8f0",
            borderRadius: 10,
            padding: "10px 14px",
            fontWeight: 600,
          }}
        >
          Secondary
        </button>
      </div>
    </section>
  );
}
`,
    },
  ];
}

function openBrowser(url: string): boolean {
  const platform = process.platform;
  let cmd = "";
  let args: string[] = [];

  if (platform === "darwin") {
    cmd = "open";
    args = [url];
  } else if (platform === "win32") {
    cmd = "cmd";
    args = ["/c", "start", "", url];
  } else {
    cmd = "xdg-open";
    args = [url];
  }

  try {
    const child = spawn(cmd, args, {
      stdio: "ignore",
      detached: true,
    });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

export function registerSmoke(program: Command): void {
  program
    .command("smoke")
    .description("Phase 3 smoke test: preview 2 local variants in browser")
    .option("--no-open", "Do not open browser automatically")
    .action(async (opts: SmokeCliOptions) => {
      const cwd = process.cwd();
      p.intro(pc.bgCyan(pc.black(" myui smoke ")));

      const spinner = p.spinner();
      spinner.start("Materializing 2 preview variants...");

      try {
        await materializeVariants({
          projectRoot: cwd,
          componentName: "Phase3Smoke",
          variants: smokeVariants(),
        });

        const status = await getStatus(cwd);
        const running = status.running
          ? status
          : await startDaemon({ projectRoot: cwd });

        const url = running.url ?? "http://127.0.0.1:9999";
        spinner.stop(pc.green(`✓ Smoke preview ready at ${url}`));

        if (opts.open !== false) {
          const opened = openBrowser(url);
          if (opened) {
            p.note(url, "Opened browser");
          } else {
            p.note(url, pc.yellow("Open this URL manually"));
          }
        } else {
          p.note(url, "Preview URL");
        }

        p.note(
          "Switch between Variant 1 and Variant 2 tabs in the preview bar.",
          "What to verify",
        );
        p.note("Use `myui daemon stop` when done.", "Cleanup");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        spinner.stop(pc.red(`✗ ${msg}`));
        process.exitCode = 1;
      }

      p.outro("");
    });
}
