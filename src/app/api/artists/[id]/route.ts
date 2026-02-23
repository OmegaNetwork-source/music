import { NextRequest, NextResponse } from "next/server";
import { ensureStoreLoaded, persistStore, getArtists, updateArtist } from "@/lib/trackStore";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureStoreLoaded();
    const { id } = await params;
    const wallet = req.nextUrl.searchParams.get("wallet");
    if (!wallet?.trim()) {
      return NextResponse.json(
        { success: false, error: "Missing wallet" },
        { status: 400 }
      );
    }
    const artists = getArtists(wallet.trim());
    if (!artists.some((a) => a.id === id)) {
      return NextResponse.json(
        { success: false, error: "Artist not found" },
        { status: 404 }
      );
    }
    const body = await req.json();
    const { name, imageUrl, slug, bio, youtubeUrl, websiteUrl } = body as {
      name?: string;
      imageUrl?: string;
      slug?: string;
      bio?: string;
      youtubeUrl?: string;
      websiteUrl?: string;
    };
    const artist = updateArtist(wallet.trim(), id, {
      ...(name !== undefined && { name: String(name).trim() }),
      ...(imageUrl !== undefined && { imageUrl: imageUrl ? String(imageUrl) : undefined }),
      ...(slug !== undefined && { slug: slug ? String(slug).trim() : undefined }),
      ...(bio !== undefined && { bio: String(bio).trim() || undefined }),
      ...(youtubeUrl !== undefined && { youtubeUrl: youtubeUrl ? String(youtubeUrl).trim() : undefined }),
      ...(websiteUrl !== undefined && { websiteUrl: websiteUrl ? String(websiteUrl).trim() : undefined }),
    });
    await persistStore();
    return NextResponse.json({ success: true, artist });
  } catch (e) {
    console.error("Update artist error:", e);
    return NextResponse.json(
      { success: false, error: "Failed to update artist" },
      { status: 500 }
    );
  }
}
