import { NextRequest, NextResponse } from "next/server";
import {
  ensureStoreLoaded,
  getArtistBySlug,
  getTracksByArtist,
  getTrack,
} from "@/lib/trackStore";

export async function GET(req: NextRequest) {
  await ensureStoreLoaded();
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
  const trackIds = getTracksByArtist(artist.wallet, artist.id);
  const tracks = trackIds
    .map((tid) => {
      const t = getTrack(tid);
      return t ? { id: tid, name: t.name } : null;
    })
    .filter(Boolean) as { id: string; name: string }[];
  const { getArtistLikes } = await import("@/lib/trackStore");
  const likes = getArtistLikes(artist.id);
  return NextResponse.json({
    success: true,
    artist,
    tracks,
    likes,
  });
}
