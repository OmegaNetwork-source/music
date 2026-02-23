import { NextRequest, NextResponse } from "next/server";
import { ensureStoreLoaded, getTrack, setTrackLyrics, persistStore } from "@/lib/trackStore";

/** GET /api/track/[id] – return track name and lyrics (for karaoke). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureStoreLoaded();
  const { id } = await params;
  const track = id ? getTrack(id) : undefined;
  if (!track) {
    return NextResponse.json({ success: false, error: "Track not found" }, { status: 404 });
  }
  return NextResponse.json({
    success: true,
    name: track.name,
    lyrics: track.lyrics ?? null,
  });
}

/** PATCH /api/track/[id] – update track lyrics (for karaoke save). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureStoreLoaded();
  const { id } = await params;
  const track = id ? getTrack(id) : undefined;
  if (!track) {
    return NextResponse.json({ success: false, error: "Track not found" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const lyrics = typeof body.lyrics === "string" ? body.lyrics : "";
  setTrackLyrics(id, lyrics);
  await persistStore();
  const updated = getTrack(id);
  return NextResponse.json({ success: true, lyrics: updated?.lyrics ?? null });
}
