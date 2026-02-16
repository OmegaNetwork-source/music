import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url || !url.startsWith("https://")) {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }
  try {
    const res = await fetch(url, { headers: { Accept: "audio/*" } });
    if (!res.ok) throw new Error("Fetch failed");
    const blob = await res.blob();
    return new NextResponse(blob, {
      headers: {
        "Content-Type": res.headers.get("Content-Type") || "audio/mpeg",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch audio" }, { status: 502 });
  }
}
