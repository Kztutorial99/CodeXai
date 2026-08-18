import type { AgentPlan, AgentRepair } from "./types";
import { qwenChat } from "../qwen/client";

function parseJson<T>(raw: string): T {
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
  return JSON.parse(cleaned) as T;
}

function validateFiles(files: unknown): AgentPlan["files"] {
  if (!Array.isArray(files)) return [];
  return files.filter((file): file is AgentPlan["files"][number] => {
    if (!file || typeof file !== "object") return false;
    const item = file as Record<string, unknown>;
    return typeof item.path === "string" && typeof item.content === "string";
  });
}

export async function createPlan(prompt: string): Promise<AgentPlan> {
  const data = await qwenChat([
    {
      role: "system",
      content: `You are the CodeXai autonomous software architect. Return ONLY valid JSON with keys summary (string), tasks (string[]), files ({path:string,content:string}[]), commands (string[]). Generate a complete runnable web app, preferably Next.js when the user asks for a web app. The files array is the source of truth: write the actual application files, not pseudo-code. Keep it focused and production-minded. Use only safe commands from this exact set: npm install, npm run build, npm test, node --version. Never request secrets, .env files, destructive commands, shell interpreters (-e/-c), curl, wget, git, chmod, sudo, rm, or arbitrary scripts. Do not include node_modules or lockfiles. Limit to 30 useful source/config files.`,
    },
    { role: "user", content: prompt },
  ]);

  const raw = data?.choices?.[0]?.message?.content;
  if (typeof raw !== "string") throw new Error("Qwen returned no plan");
  const parsed = parseJson<AgentPlan>(raw);
  if (!parsed.summary || !Array.isArray(parsed.tasks)) throw new Error("Invalid agent plan");
  return {
    summary: parsed.summary,
    tasks: parsed.tasks.slice(0, 20),
    files: validateFiles(parsed.files).slice(0, 30),
    commands: Array.isArray(parsed.commands) ? parsed.commands.slice(0, 4) : [],
  };
}

export async function createRepair(errorText: string, files: AgentPlan["files"]): Promise<AgentRepair> {
  const compactFiles = files.slice(0, 20).map((file) => ({ path: file.path, content: file.content.slice(0, 50000) }));
  const data = await qwenChat([
    {
      role: "system",
      content: `You are CodeXai's debugging agent. Return ONLY valid JSON with keys summary (string) and files ({path:string,content:string}[]). Diagnose the build/test failure and return complete replacement contents only for files that must change. Do not return patches, markdown, commands, secrets, .env files, node_modules, or destructive operations.`,
    },
    { role: "user", content: JSON.stringify({ error: errorText.slice(0, 12000), files: compactFiles }) },
  ]);
  const raw = data?.choices?.[0]?.message?.content;
  if (typeof raw !== "string") throw new Error("Qwen returned no repair");
  const parsed = parseJson<AgentRepair>(raw);
  return {
    summary: typeof parsed.summary === "string" ? parsed.summary : "Applied an automated repair.",
    files: validateFiles(parsed.files).slice(0, 10),
  };
}
