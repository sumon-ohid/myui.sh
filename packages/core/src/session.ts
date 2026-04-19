import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { z } from "zod";

const SessionRecordSchema = z.object({
  version: z.literal(1),
  sessionId: z.string().min(1),
  componentName: z.string().min(1),
  prompt: z.string().min(1),
  scope: z.string().min(1),
  model: z.string().min(1),
  variantCount: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  updatedAt: z.string().min(1),
});

export type SessionRecord = z.infer<typeof SessionRecordSchema>;

export function sessionFilePath(projectRoot: string): string {
  return resolve(projectRoot, ".myui", "session.json");
}

export async function readSession(
  projectRoot: string,
): Promise<SessionRecord | undefined> {
  try {
    const raw = await readFile(sessionFilePath(projectRoot), "utf8");
    const parsed = SessionRecordSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export async function writeSession(
  projectRoot: string,
  record: Omit<SessionRecord, "version" | "updatedAt">,
): Promise<void> {
  const file = sessionFilePath(projectRoot);
  await mkdir(dirname(file), { recursive: true });
  const full: SessionRecord = {
    ...record,
    version: 1,
    updatedAt: new Date().toISOString(),
  };
  await writeFile(file, JSON.stringify(full, null, 2), "utf8");
}

export async function clearSession(projectRoot: string): Promise<void> {
  await rm(sessionFilePath(projectRoot), { force: true });
}
