import { NextResponse } from "next/server";

export async function GET(request) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch video" }, { status: res.status });
    }

    const headers = new Headers(res.headers);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    headers.set("Cross-Origin-Resource-Policy", "cross-origin");
    // Ensure standard content-type
    if (!headers.get("Content-Type")) {
      headers.set("Content-Type", "video/mp4");
    }

    return new NextResponse(res.body, {
      status: res.status,
      headers,
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
