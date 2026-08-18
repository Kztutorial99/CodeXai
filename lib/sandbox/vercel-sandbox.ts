import { Sandbox } from "@vercel/sandbox";
import type { AgentFile, SandboxRunResult } from "../agent/types";

const DEFAULT_TIMEOUT_MS = 5 * 60_000;
const ROOT = "/vercel/sandbox";

export function normalizeWorkspaceName(value: string) {
  const clean = value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return `codexai-${(clean || "workspace").slice(0, 42)}`;
}

export async function getWorkspace(name: string) {
  return Sandbox.getOrCreate({
    name: normalizeWorkspaceName(name),
    runtime: "node24",
    timeout: DEFAULT_TIMEOUT_MS,
    ports: [3000],
  });
}

export function validateWorkspaceFiles(files: AgentFile[]): AgentFile[] {
  const output: AgentFile[] = [];
  let total = 0;
  for (const file of files) {
    const path = file.path.replace(/^\/+/, "");
    if (!path || path.includes("..") || path.startsWith(".env") || path.includes("node_modules")) continue;
    if (!/^[a-zA-Z0-9_./@-]+$/.test(path)) continue;
    if (file.content.length > 100_000) continue;
    total += file.content.length;
    if (total > 1_500_000) break;
    output.push({ path, content: file.content });
  }
  return output;
}

export async function writeWorkspaceFiles(sandbox: Sandbox, files: AgentFile[]) {
  const safeFiles = validateWorkspaceFiles(files);
  if (!safeFiles.length) return [];
  await sandbox.writeFiles(safeFiles.map((file) => ({ path: `${ROOT}/${file.path}`, content: Buffer.from(file.content) })));
  return safeFiles;
}

export async function readWorkspaceFiles(sandbox: Sandbox, paths: string[]): Promise<AgentFile[]> {
  const result: AgentFile[] = [];
  for (const path of paths.slice(0, 20)) {
    try {
      const content = await sandbox.readFile(`${ROOT}/${path}`);
      result.push({ path, content: content.toString().slice(0, 100_000) });
    } catch {
      // Missing files are ignored; the repair agent can work with the remaining context.
    }
  }
  return result;
}

export async function runInWorkspace(
  sandbox: Sandbox,
  command: string,
  args: string[] = [],
  options: { timeoutMs?: number; cwd?: string; detached?: boolean } = {},
): Promise<SandboxRunResult> {
  const started = Date.now();
  try {
    const result = await sandbox.runCommand({
      cmd: command,
      args,
      cwd: options.cwd ?? ROOT,
      detached: options.detached,
    });
    return {
      ok: result.exitCode === 0,
      exitCode: result.exitCode,
      stdout: await result.stdout(),
      stderr: await result.stderr(),
      durationMs: Date.now() - started,
    };
  } catch (error) {
    return {
      ok: false,
      exitCode: null,
      stdout: "",
      stderr: error instanceof Error ? error.message : "Sandbox execution failed",
      durationMs: Date.now() - started,
    };
  }
}

export async function startPreview(sandbox: Sandbox) {
  const result = await sandbox.runCommand({
    cmd: "npm",
    args: ["run", "dev", "--", "--hostname", "0.0.0.0", "--port", "3000"],
    cwd: ROOT,
    detached: true,
  });
  if (result.exitCode !== null && result.exitCode !== 0) return null;
  return sandbox.domain(3000);
}
