import { spawn } from "node:child_process";
import {
  open,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:net";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { SHELL_TEMPLATE_DIR } from "./paths.js";
import { setTimeout as sleep } from "node:timers/promises";
import { previewPaths, type PreviewPaths } from "./paths.js";

const requireFromHere = createRequire(import.meta.url);

function resolveViteBin(): string {
  const pkgPath = requireFromHere.resolve("vite/package.json");
  return resolve(dirname(pkgPath), "bin", "vite.js");
}

export interface DaemonStatus {
  readonly running: boolean;
  readonly pid: number | undefined;
  readonly port: number | undefined;
  readonly url: string | undefined;
}

export interface StartOptions {
  readonly projectRoot: string;
  readonly preferredPort?: number;
  readonly host?: string;
  readonly readyTimeoutMs?: number;
  readonly viteBin?: string;
}

const DEFAULT_PORT = 9999;
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_READY_MS = 30_000;

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function findFreePort(start: number): Promise<number> {
  for (let port = start; port < start + 50; port++) {
    const free = await new Promise<boolean>((resolve) => {
      const srv = createServer();
      srv.once("error", () => resolve(false));
      srv.once("listening", () => srv.close(() => resolve(true)));
      srv.listen(port, DEFAULT_HOST);
    });
    if (free) return port;
  }
  throw new Error(`No free port near ${start}`);
}

async function readPid(paths: PreviewPaths): Promise<number | undefined> {
  try {
    const raw = await readFile(paths.pidFile, "utf8");
    const n = Number.parseInt(raw.trim(), 10);
    return Number.isFinite(n) ? n : undefined;
  } catch {
    return undefined;
  }
}

async function readPort(paths: PreviewPaths): Promise<number | undefined> {
  try {
    const raw = await readFile(paths.portFile, "utf8");
    const n = Number.parseInt(raw.trim(), 10);
    return Number.isFinite(n) ? n : undefined;
  } catch {
    return undefined;
  }
}

export async function getStatus(projectRoot: string): Promise<DaemonStatus> {
  const paths = previewPaths(projectRoot);
  const pid = await readPid(paths);
  const port = await readPort(paths);

  if (pid && isAlive(pid) && port) {
    return {
      running: true,
      pid,
      port,
      url: `http://${DEFAULT_HOST}:${port}`,
    };
  }

  return { running: false, pid: undefined, port: undefined, url: undefined };
}

async function waitForReady(
  port: number,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://${DEFAULT_HOST}:${port}/`, {
        signal: AbortSignal.timeout(1500),
      });
      if (res.ok || res.status === 404) return;
    } catch {
      // not ready yet
    }
    await sleep(250);
  }
  throw new Error(`Vite did not become ready on port ${port} within ${timeoutMs}ms`);
}

export async function startDaemon(opts: StartOptions): Promise<DaemonStatus> {
  const paths = previewPaths(opts.projectRoot);
  const existing = await getStatus(opts.projectRoot);
  if (existing.running) return existing;

  await rm(paths.pidFile, { force: true });
  await rm(paths.portFile, { force: true });

  const port = await findFreePort(opts.preferredPort ?? DEFAULT_PORT);
  const viteBin = opts.viteBin ?? resolveViteBin();

  const logFd = await open(paths.logFile, "a");

  const configPath = resolve(SHELL_TEMPLATE_DIR, "vite.config.template.mjs");

  const child = spawn(
    process.execPath,
    [
      viteBin,
      "--config",
      configPath,
      "--port",
      String(port),
      "--host",
      opts.host ?? DEFAULT_HOST,
      "--strictPort",
      "false",
      "--clearScreen",
      "false",
    ],
    {
      cwd: SHELL_TEMPLATE_DIR,
      env: {
        ...process.env,
        MYUI_PROJECT_ROOT: opts.projectRoot,
        MYUI_PREVIEW_DIR: paths.previewDir,
        FORCE_COLOR: "0",
      },
      detached: true,
      stdio: ["ignore", logFd.fd, logFd.fd],
    },
  );

  if (!child.pid) {
    await logFd.close();
    throw new Error("Failed to spawn Vite (no pid)");
  }

  child.unref();
  await logFd.close();

  await writeFile(paths.pidFile, String(child.pid), "utf8");
  await writeFile(paths.portFile, String(port), "utf8");

  try {
    await waitForReady(port, opts.readyTimeoutMs ?? DEFAULT_READY_MS);
  } catch (err) {
    await stopDaemon(opts.projectRoot).catch(() => {});
    throw err;
  }

  return {
    running: true,
    pid: child.pid,
    port,
    url: `http://${DEFAULT_HOST}:${port}`,
  };
}

export async function stopDaemon(projectRoot: string): Promise<boolean> {
  const paths = previewPaths(projectRoot);
  const pid = await readPid(paths);

  let killed = false;
  if (pid && isAlive(pid)) {
    try {
      process.kill(pid, "SIGTERM");
      killed = true;
      for (let i = 0; i < 20; i++) {
        if (!isAlive(pid)) break;
        await sleep(100);
      }
      if (isAlive(pid)) {
        process.kill(pid, "SIGKILL");
      }
    } catch {
      // ignore
    }
  }

  await rm(paths.pidFile, { force: true });
  await rm(paths.portFile, { force: true });
  return killed;
}
