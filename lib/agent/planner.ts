import type { AgentPlan } from "./types";
import { qwenChat } from "../qwen/client";

export async function createPlan(prompt: string): Promise<AgentPlan> {
  const data = await qwenChat([
    {
      role: "system",
      content: "You are the CodeXai planning agent. Return ONLY valid JSON with keys summary (string), tasks (string[]), commands (string[]). Commands must be safe development commands such as npm install, npm run build, npm test, node --version. Never request secrets, destructive commands, curl|sh, rm -rf, chmod, or arbitrary shell scripts.",
    },
    { role: "user", content: prompt },
  ]);

  const raw = data?.choices?.[0]?.message?.content;
  if (typeof raw !== "string") throw new Error("Qwen returned no plan");
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
  const parsed = JSON.parse(cleaned) as AgentPlan;
  if (!parsed.summary || !Array.isArray(parsed.tasks) || !Array.isArray(parsed.commands)) {
    throw new Error("Invalid agent plan");
  }
  return parsed;
}
