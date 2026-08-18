import { NextResponse } from "next/server";
import { qwenChat } from "@/lib/qwen/client";

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json();
    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const data = await qwenChat([
      {
        role: "system",
        content: "You are CodeXai, an autonomous software-building agent. Analyze the user's goal, propose an implementation plan, identify files and actions needed, and be concise. Do not claim to have executed commands or changed files unless the runtime actually did so.",
      },
      { role: "user", content: prompt },
    ]);

    return NextResponse.json({
      model: process.env.QWEN_MODEL ?? "qwen3.8-max",
      content: data?.choices?.[0]?.message?.content ?? "No response generated.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected agent error" },
      { status: 500 },
    );
  }
}
