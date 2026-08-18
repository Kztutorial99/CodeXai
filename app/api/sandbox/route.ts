import { NextResponse } from "next/server";
import { runInSandbox } from "@/lib/sandbox/vercel-sandbox";

const SAFE_COMMANDS = new Set(["node", "npm", "npx", "pnpm", "python", "python3"]);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const command = typeof body.command === "string" ? body.command.trim() : "";
    const args = Array.isArray(body.args) && body.args.every((value: unknown) => typeof value === "string")
      ? body.args as string[]
      : [];

    if (!command || !SAFE_COMMANDS.has(command)) {
      return NextResponse.json({ error: "Command is not allowed by the sandbox API" }, { status: 400 });
    }

    const result = await runInSandbox(command, args, { timeoutMs: 60_000 });
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sandbox request failed" },
      { status: 500 },
    );
  }
}
