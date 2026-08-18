import type { AgentPlan } from "./types";

const baseUrl = process.env.QWEN_BASE_URL ?? "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
const model = process.env.QWEN_MODEL ?? "qwen3.8-max";

export async function createPlan(prompt: string): Promise<AgentPlan> {
  const key = process.env.DASHSCOPE_API_KEY;
  if (!key) throw new Error("DASHSCOPE_API_KEY is not configured");

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: "You are the CodeXai planning agent. Return ONLY valid JSON with keys summary (string), tasks (string[]), commands (string[]). Commands must be safe development commands such as npm install, npm run build, npm test, node --version. Never request secrets, destructive commands, curl|sh, rm -rf, chmod, or arbitrary shell scripts.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message ?? "Qwen planning failed");

  const raw = data?.choices?.[0]?.message?.content;
  if (typeof raw !== "string") throw new Error("Qwen returned no plan");

  const cleaned = raw.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
  const parsed = JSON.parse(cleaned) as AgentPlan;
  if (!parsed.summary || !Array.isArray(parsed.tasks) || !Array.isArray(parsed.commands)) {
    throw new Error("Invalid agent plan");
  }
  return parsed;
}
