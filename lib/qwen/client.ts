import { availableQwenKeys, clearKeyCooldown, markRateLimited } from "./key-pool";

const baseUrl = process.env.QWEN_BASE_URL ?? "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
const model = process.env.QWEN_MODEL ?? "qwen3.8-max";

function retryAfter(response: Response) {
  const value = response.headers.get("retry-after");
  const seconds = value ? Number(value) : NaN;
  return Number.isFinite(seconds) ? seconds : undefined;
}

export async function qwenChat(messages: Array<{ role: "system" | "user" | "assistant"; content: string }>) {
  const keys = availableQwenKeys();
  if (!keys.length) throw new Error("No Qwen API key is available. Configure QWEN_API_KEY_1, QWEN_API_KEY_2, etc.");

  let lastError = "Qwen request failed";
  for (const state of keys) {
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${state.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, temperature: 0.1 }),
      });

      if (response.ok) {
        clearKeyCooldown(state.key);
        return response.json();
      }

      const data = await response.json().catch(() => null);
      lastError = data?.error?.message ?? `Qwen HTTP ${response.status}`;
      if (response.status === 429) {
        markRateLimited(state.key, retryAfter(response));
        continue;
      }
      if (response.status === 401 || response.status === 403) continue;
      if (response.status >= 500) continue;
      throw new Error(lastError);
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    }
  }

  throw new Error(`All available Qwen API keys failed: ${lastError}`);
}
