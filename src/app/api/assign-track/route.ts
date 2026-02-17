import { NextRequest, NextResponse } from "next/server";
import { setAssignment, getArtists } from "@/lib/trackStore";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { wallet, trackId, artistId } = body as {
      wallet?: string;
      trackId?: string;
      artistId?: string | null;
    };
    if (!wallet?.trim() || !trackId?.trim()) {
      return NextResponse.json(
        { success: false, error: "Missing wallet or trackId" },
        { status: 400 }
      );
    }
    if (artistId !== undefined && artistId !== null) {
      const artists = getArtists(wallet.trim());
      if (!artists.some((a) => a.id === artistId)) {
        return NextResponse.json(
          { success: false, error: "Artist not found" },
          { status: 400 }
        );
      }
    }
    setAssignment(wallet.trim(), trackId.trim(), artistId?.trim() || null);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Assign track error:", e);
    return NextResponse.json(
      { success: false, error: "Failed to assign track" },
      { status: 500 }
    );
  }
}
