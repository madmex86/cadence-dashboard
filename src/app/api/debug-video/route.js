import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const models = [
    "claude-3-5-sonnet-20241022",
    "claude-3-5-sonnet-20240620",
    "claude-3-5-sonnet-latest",
    "claude-3-sonnet-20240229",
    "claude-3-opus-20240229",
    "claude-3-haiku-20240307",
    "claude-sonnet-4-6"
  ];
  
  const results = {};
  
  for (const model of models) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 10,
          messages: [{ role: "user", content: "hi" }]
        }),
      });
      const data = await res.json();
      results[model] = res.ok ? "OK" : data.error?.message || res.status;
    } catch (e) {
      results[model] = e.message;
    }
  }
  
  return NextResponse.json({ test: results });
}
