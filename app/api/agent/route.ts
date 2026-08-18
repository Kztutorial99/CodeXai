import { NextResponse } from "next/server";

const QWEN_BASE_URL = process.env.QWEN_BASE_URL ?? "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
const QWEN_MODEL = process.env.QWEN_MODEL ?? "qwen3.8-max";

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json();
    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "DASHSCOPE_API_KEY is not configured" }, { status: 500 });
    }

    const response = await fetch(`${QWEN_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: QWEN_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are CodeXai, an autonomous software-building agent. Analyze the user's goal, propose an implementation plan, identify files and actions needed, and be concise. Do not claim to have executed commands or changed files unless the runtime actually did so.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json(
        { error: data?.error?.message ?? "Qwen API request failed" },
        { status: response.status },
      );
    }

    return NextResponse.json({
      model: QWEN_MODEL,
      content: data?.choices?.[0]?.message?.content ?? "No response generated.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected agent error" },
      { status: 500 },
    );
  }
}
