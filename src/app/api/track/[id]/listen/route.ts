import { NextRequest, NextResponse } from "next/server";
import { ensureStoreLoaded, persistStore, getTrack, incrementTrackPlay } from "@/lib/trackStore";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureStoreLoaded();
  const { id } = await params;
  const track = id ? getTrack(id) : undefined;
  if (!track) {
    return NextResponse.json(
      { success: false, error: "Track not found" },
      { status: 404 }
    );
  }
  const plays = incrementTrackPlay(id);
  await persistStore();
  return NextResponse.json({ success: true, plays });
}
