import { createPlan, createRepair } from "./planner";
import type { AgentStep } from "./types";
import { getWorkspace, runInWorkspace, startPreview, validateWorkspaceFiles, writeWorkspaceFiles, readWorkspaceFiles } from "../sandbox/vercel-sandbox";

function safeCommand(command: string): { cmd: string; args: string[] } | null {
  const value = command.trim();
  if (value === "node --version") return { cmd: "node", args: ["--version"] };
  if (value === "npm install") return { cmd: "npm", args: ["install"] };
  if (value === "npm run build") return { cmd: "npm", args: ["run", "build"] };
  if (value === "npm test") return { cmd: "npm", args: ["test"] };
  return null;
}

function finish(step: AgentStep, status: AgentStep["status"], detail?: string) {
  step.status = status;
  step.completedAt = new Date().toISOString();
  if (detail) step.detail = detail;
}

export async function runAgentLoop(prompt: string, workspaceId = "default") {
  const steps: AgentStep[] = [
    { id: "plan", name: "plan", status: "running", startedAt: new Date().toISOString(), detail: "Qwen is analyzing the request and generating project files." },
    { id: "build", name: "build", status: "pending", detail: "Write files and install dependencies in the persistent sandbox." },
    { id: "test", name: "test", status: "pending", detail: "Run the production build and inspect failures." },
    { id: "repair", name: "repair", status: "pending", detail: "Ask Qwen to repair failed files and retest." },
    { id: "deploy", name: "deploy", status: "pending", detail: "Expose the working sandbox as a live preview." },
  ];

  const plan = await createPlan(prompt);
  finish(steps[0], "completed", `${plan.files.length} files planned across ${plan.tasks.length} tasks.`);

  const sandbox = await getWorkspace(workspaceId);
  const safeFiles = validateWorkspaceFiles(plan.files);
  if (!safeFiles.length) throw new Error("Qwen generated no safe project files");

  steps[1].status = "running";
  steps[1].startedAt = new Date().toISOString();
  const written = await writeWorkspaceFiles(sandbox, safeFiles);
  const executions: Array<{ command: string; ok: boolean; stdout: string; stderr: string; durationMs: number }> = [];

  const commands = ["npm install", "npm run build"];
  for (const command of commands) {
    const parsed = safeCommand(command);
    if (!parsed) continue;
    const result = await runInWorkspace(sandbox, parsed.cmd, parsed.args);
    executions.push({ command, ...result });
    if (!result.ok) break;
  }
  finish(steps[1], executions.every((item) => item.ok) ? "completed" : "failed", `${written.length} files written to persistent workspace.`);

  let failed = executions.find((item) => !item.ok);
  steps[2].status = "running";
  steps[2].startedAt = new Date().toISOString();
  if (!failed) {
    finish(steps[2], "completed", "Production build passed.");
  } else {
    finish(steps[2], "failed", failed.stderr.slice(0, 1000));
  }

  let repairAttempts = 0;
  while (failed && repairAttempts < 2) {
    repairAttempts += 1;
    steps[3].status = "running";
    steps[3].startedAt = new Date().toISOString();
    const currentFiles = await readWorkspaceFiles(sandbox, safeFiles.map((file) => file.path));
    const repair = await createRepair(`${failed.stderr}\n${failed.stdout}`, currentFiles.length ? currentFiles : safeFiles);
    const repairedFiles = await writeWorkspaceFiles(sandbox, repair.files);
    if (!repairedFiles.length) {
      finish(steps[3], "failed", "Qwen did not return safe replacement files.");
      break;
    }

    const install = await runInWorkspace(sandbox, "npm", ["install"]);
    if (!install.ok) {
      failed = { command: "npm install", ...install };
      finish(steps[3], "failed", install.stderr.slice(0, 1000));
      continue;
    }
    const rebuild = await runInWorkspace(sandbox, "npm", ["run", "build"]);
    executions.push({ command: "npm run build (repair)", ...rebuild });
    if (rebuild.ok) {
      failed = undefined;
      finish(steps[3], "completed", `${repair.summary} Retest passed after repair ${repairAttempts}.`);
      finish(steps[2], "completed", "Production build passed after automated repair.");
    } else {
      failed = { command: "npm run build (repair)", ...rebuild };
      finish(steps[3], repairAttempts >= 2 ? "failed" : "running", `${repair.summary} Build still failing.`);
      finish(steps[2], "failed", rebuild.stderr.slice(0, 1000));
    }
  }

  if (!failed) {
    steps[4].status = "running";
    steps[4].startedAt = new Date().toISOString();
    const previewUrl = await startPreview(sandbox);
    if (previewUrl) {
      finish(steps[4], "completed", "Live preview server started in the persistent sandbox.");
      return {
        plan,
        steps,
        executions,
        workspace: workspaceId,
        files: safeFiles.map((file) => file.path),
        previewUrl,
        repairAttempts,
      };
    }
    finish(steps[4], "failed", "Build passed but the preview server could not start.");
  }

  return {
    plan,
    steps,
    executions,
    workspace: workspaceId,
    files: safeFiles.map((file) => file.path),
    previewUrl: null,
    repairAttempts,
  };
}
