import { NextResponse } from "next/server";
import { getWorkspace, runInWorkspace } from "@/lib/sandbox/vercel-sandbox";

function parseSafeCommand(command: string, args: string[]) {
  if (command === "node" && args.length === 1 && args[0] === "--version") return { command, args };
  if (command === "npm" && args.length === 1 && ["install", "test"].includes(args[0])) return { command, args };
  if (command === "npm" && args.length === 2 && args[0] === "run" && args[1] === "build") return { command, args };
  return null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const command = typeof body?.command === "string" ? body.command.trim() : "";
    const args = Array.isArray(body?.args) && body.args.every((value: unknown) => typeof value === "string") ? body.args as string[] : [];
    const workspaceId = typeof body?.workspaceId === "string" ? body.workspaceId.slice(0, 48) : "default";
    const safe = parseSafeCommand(command, args);

    if (!safe) {
      return NextResponse.json({ error: "Command is not allowed by the sandbox API" }, { status: 400 });
    }

    const sandbox = await getWorkspace(workspaceId);
    const result = await runInWorkspace(sandbox, safe.command, safe.args);
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sandbox request failed" },
      { status: 500 },
    );
  }
}
