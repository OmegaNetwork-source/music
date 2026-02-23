import { NextRequest, NextResponse } from "next/server";
import { ensureStoreLoaded, persistStore, getArtists, createArtist } from "@/lib/trackStore";

export async function GET(req: NextRequest) {
  await ensureStoreLoaded();
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet?.trim()) {
    return NextResponse.json(
      { success: false, error: "Missing wallet" },
      { status: 400 }
    );
  }
  const artists = getArtists(wallet.trim());
  return NextResponse.json({ success: true, artists });
}

export async function POST(req: NextRequest) {
  try {
    await ensureStoreLoaded();
    const body = await req.json();
    const { wallet, name, imageUrl } = body as { wallet?: string; name?: string; imageUrl?: string };
    if (!wallet?.trim() || !name?.trim()) {
      return NextResponse.json(
        { success: false, error: "Missing wallet or name" },
        { status: 400 }
      );
    }
    const artist = createArtist(wallet.trim(), name.trim(), imageUrl?.trim() || undefined);
    await persistStore();
    return NextResponse.json({ success: true, artist });
  } catch (e) {
    console.error("Create artist error:", e);
    return NextResponse.json(
      { success: false, error: "Failed to create artist" },
      { status: 500 }
    );
  }
}
