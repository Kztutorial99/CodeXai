import { Sandbox } from "@vercel/sandbox";
import type { SandboxRunResult } from "../agent/types";

const DEFAULT_TIMEOUT_MS = 60_000;

export async function runInSandbox(
  command: string,
  args: string[] = [],
  options: { timeoutMs?: number; cwd?: string } = {},
): Promise<SandboxRunResult> {
  const started = Date.now();
  let sandbox: Sandbox | undefined;

  try {
    sandbox = await Sandbox.create({
      timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    });

    const result = await sandbox.runCommand({
      cmd: command,
      args,
      cwd: options.cwd,
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
  } finally {
    if (sandbox) {
      try {
        await sandbox.stop();
      } catch {
        // Cleanup failure must not hide the actual execution result.
      }
    }
  }
}
