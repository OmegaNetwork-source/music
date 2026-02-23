import { NextRequest, NextResponse } from "next/server";
import { ensureStoreLoaded, persistStore, getArtistById, likeArtist, getArtistLikes } from "@/lib/trackStore";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureStoreLoaded();
  const { id } = await params;
  const artist = getArtistById(id);
  if (!artist) {
    return NextResponse.json(
      { success: false, error: "Artist not found" },
      { status: 404 }
    );
  }
  const count = likeArtist(id);
  await persistStore();
  return NextResponse.json({ success: true, likes: count });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureStoreLoaded();
  const { id } = await params;
  const artist = getArtistById(id);
  if (!artist) {
    return NextResponse.json(
      { success: false, error: "Artist not found" },
      { status: 404 }
    );
  }
  const likes = getArtistLikes(id);
  return NextResponse.json({ success: true, likes });
}
