import { NextRequest, NextResponse } from "next/server";
import { getArtistBySlug } from "@/lib/trackStore";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug?.trim()) {
    return NextResponse.json(
      { success: false, error: "Missing slug" },
      { status: 400 }
    );
  }
  const artist = getArtistBySlug(slug.trim());
  if (!artist) {
    return NextResponse.json(
      { success: false, error: "Artist not found" },
      { status: 404 }
    );
  }
  return NextResponse.json({ success: true, artist });
}
