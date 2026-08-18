type KeyState = { key: string; cooldownUntil: number };

const COOLDOWN_MS = 30_000;

function loadKeys(): KeyState[] {
  return Object.entries(process.env)
    .filter(([name, value]) => /^QWEN_API_KEY_\d+$/.test(name) && Boolean(value?.trim()))
    .sort(([a], [b]) => Number(a.replace(/\D/g, "")) - Number(b.replace(/\D/g, "")))
    .map(([, value]) => ({ key: value!.trim(), cooldownUntil: 0 }));
}

let states: KeyState[] | null = null;

export function getQwenKeys(): KeyState[] {
  if (!states) {
    states = loadKeys();
    const legacy = process.env.DASHSCOPE_API_KEY?.trim();
    if (!states.length && legacy) states = [{ key: legacy, cooldownUntil: 0 }];
  }
  return states;
}

export function markRateLimited(key: string, retryAfterSeconds?: number) {
  const state = getQwenKeys().find((item) => item.key === key);
  if (!state) return;
  const delay = Math.max(COOLDOWN_MS, (retryAfterSeconds ?? 0) * 1000);
  state.cooldownUntil = Date.now() + delay;
}

export function clearKeyCooldown(key: string) {
  const state = getQwenKeys().find((item) => item.key === key);
  if (state) state.cooldownUntil = 0;
}

export function availableQwenKeys(): KeyState[] {
  const now = Date.now();
  return getQwenKeys().filter((item) => item.cooldownUntil <= now);
}
