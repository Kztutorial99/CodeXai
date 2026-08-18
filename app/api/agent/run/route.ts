import { NextResponse } from "next/server";
import { runAgentLoop } from "@/lib/agent/loop";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json();
    if (typeof prompt !== "string" || prompt.trim().length < 3) {
      return NextResponse.json({ error: "A valid build prompt is required" }, { status: 400 });
    }

    const result = await runAgentLoop(prompt.trim());
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Autonomous agent failed" },
      { status: 500 },
    );
  }
}
