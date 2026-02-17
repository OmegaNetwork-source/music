import { NextRequest, NextResponse } from "next/server";
import { getArtistById, getTracksByArtist, getTrack } from "@/lib/trackStore";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const artist = getArtistById(id);
  if (!artist) {
    return NextResponse.json(
      { success: false, error: "Artist not found" },
      { status: 404 }
    );
  }
  const trackIds = getTracksByArtist(artist.wallet, id);
  const tracks = trackIds
    .map((tid) => {
      const t = getTrack(tid);
      return t ? { id: tid, name: t.name } : null;
    })
    .filter(Boolean) as { id: string; name: string }[];
  return NextResponse.json({ success: true, artist, tracks });
}
