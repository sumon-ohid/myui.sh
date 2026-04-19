import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearSession,
  readSession,
  sessionFilePath,
  writeSession,
} from "./session.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "myui-session-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("session store", () => {
  it("returns undefined when no session file exists", async () => {
    expect(await readSession(root)).toBeUndefined();
  });

  it("writes and reads back a session", async () => {
    await writeSession(root, {
      sessionId: "sess_abc",
      componentName: "PricingCard",
      prompt: "pricing card",
      scope: "section",
      model: "claude-sonnet-4-6",
      variantCount: 2,
    });
    const got = await readSession(root);
    expect(got?.sessionId).toBe("sess_abc");
    expect(got?.componentName).toBe("PricingCard");
    expect(got?.variantCount).toBe(2);
    expect(got?.version).toBe(1);
    expect(got?.updatedAt).toMatch(/T/);
  });

  it("returns undefined for malformed JSON", async () => {
    await mkdir(dirname(sessionFilePath(root)), { recursive: true });
    await writeFile(sessionFilePath(root), "not json", "utf8");
    expect(await readSession(root)).toBeUndefined();
  });

  it("returns undefined for schema-invalid record", async () => {
    await mkdir(dirname(sessionFilePath(root)), { recursive: true });
    await writeFile(
      sessionFilePath(root),
      JSON.stringify({ sessionId: "x" }),
      "utf8",
    );
    expect(await readSession(root)).toBeUndefined();
  });

  it("clearSession removes the file", async () => {
    await writeSession(root, {
      sessionId: "s",
      componentName: "X",
      prompt: "p",
      scope: "atom",
      model: "claude-sonnet-4-6",
      variantCount: 1,
    });
    await clearSession(root);
    expect(await readSession(root)).toBeUndefined();
  });

  it("overwrites existing session and updates updatedAt", async () => {
    await writeSession(root, {
      sessionId: "old",
      componentName: "X",
      prompt: "p",
      scope: "atom",
      model: "claude-sonnet-4-6",
      variantCount: 1,
    });
    const first = await readSession(root);
    await new Promise((r) => setTimeout(r, 10));
    await writeSession(root, {
      sessionId: "new",
      componentName: "X",
      prompt: "p",
      scope: "atom",
      model: "claude-sonnet-4-6",
      variantCount: 1,
    });
    const second = await readSession(root);
    expect(second?.sessionId).toBe("new");
    expect(second?.updatedAt).not.toBe(first?.updatedAt);
  });

  it("clearSession on missing file is a no-op", async () => {
    await expect(clearSession(root)).resolves.toBeUndefined();
  });

  it("session file is valid JSON on disk", async () => {
    await writeSession(root, {
      sessionId: "s1",
      componentName: "Y",
      prompt: "q",
      scope: "molecule",
      model: "claude-opus-4-7",
      variantCount: 3,
    });
    const raw = await readFile(sessionFilePath(root), "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect(parsed["sessionId"]).toBe("s1");
  });
});
