import { createPlan } from "./planner";
import type { AgentStep } from "./types";
import { runInSandbox } from "../sandbox/vercel-sandbox";

const allowed = new Set(["node", "npm", "npx", "pnpm", "python", "python3"]);

function splitCommand(command: string): { cmd: string; args: string[] } | null {
  const parts = command.trim().split(/\s+/);
  if (!parts[0] || !allowed.has(parts[0])) return null;
  if (/[;&|`$<>]/.test(command)) return null;
  return { cmd: parts[0], args: parts.slice(1) };
}

export async function runAgentLoop(prompt: string) {
  const steps: AgentStep[] = [
    { id: "plan", name: "plan", status: "running", startedAt: new Date().toISOString() },
    { id: "build", name: "build", status: "pending" },
    { id: "test", name: "test", status: "pending" },
    { id: "repair", name: "repair", status: "pending" },
    { id: "deploy", name: "deploy", status: "pending" },
  ];

  const plan = await createPlan(prompt);
  steps[0].status = "completed";
  steps[0].completedAt = new Date().toISOString();

  steps[1].status = "running";
  const executions = [];
  for (const command of plan.commands.slice(0, 5)) {
    const parsed = splitCommand(command);
    if (!parsed) {
      executions.push({ command, ok: false, stderr: "Command rejected by CodeXai sandbox policy" });
      continue;
    }
    executions.push({ command, ...(await runInSandbox(parsed.cmd, parsed.args)) });
  }
  steps[1].status = executions.every((item) => item.ok) ? "completed" : "failed";
  steps[1].completedAt = new Date().toISOString();

  steps[2].status = "running";
  const failed = executions.filter((item) => !item.ok);
  steps[2].status = failed.length ? "failed" : "completed";
  steps[2].completedAt = new Date().toISOString();

  steps[3].status = failed.length ? "pending" : "completed";
  steps[4].status = "pending";

  return { plan, steps, executions };
}
