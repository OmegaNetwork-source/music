import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import {
  ensureStoreLoaded,
  persistStore,
  getTrack,
  isSignatureUsedForTrack,
  markSignatureUsed,
} from "@/lib/trackStore";
import { verifyUsdcPayment } from "@/lib/verifyPayment";
import { AUDIO_DIR_PATH } from "@/lib/dataDir";

const AUDIO_DIR = AUDIO_DIR_PATH;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureStoreLoaded();
  const { id } = await params;
  const signature = req.nextUrl.searchParams.get("signature");
  if (!signature) {
    return new NextResponse("Missing signature", { status: 400 });
  }
  const track = id ? getTrack(id) : undefined;
  if (!track) {
    return new NextResponse("Track not found", { status: 404 });
  }

  const verification = await verifyUsdcPayment(signature);
  if (!verification.valid) {
    return new NextResponse(verification.error || "Invalid payment", {
      status: 400,
    });
  }

  if (isSignatureUsedForTrack(signature, id)) {
    return new NextResponse("This payment was already used for another track", {
      status: 403,
    });
  }
  markSignatureUsed(signature, id);
  await persistStore();

  const filename = `${track.name.replace(/\s+/g, "_")}.mp3`;
  const headers: Record<string, string> = {
    "Content-Type": "audio/mpeg",
    "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
  };

  try {
    if (track.blobUrl) {
      const res = await fetch(track.blobUrl, { method: "GET" });
      if (!res.ok) {
        return new NextResponse("Blob audio failed", { status: 502 });
      }
      const contentType = res.headers.get("content-type") || "audio/mpeg";
      const contentLength = res.headers.get("content-length");
      headers["Content-Type"] = contentType;
      if (contentLength) headers["Content-Length"] = contentLength;
      return new NextResponse(res.body, { headers });
    }
    if (track.audioPath) {
      const filePath = path.join(AUDIO_DIR, track.audioPath);
      if (!fs.existsSync(filePath)) {
        return new NextResponse("Audio file not found", { status: 404 });
      }
      const buffer = fs.readFileSync(filePath);
      headers["Content-Length"] = String(buffer.length);
      return new NextResponse(buffer, { headers });
    }

    if (!track.audioUrl) {
      return new NextResponse("Track has no audio source", { status: 502 });
    }
    const res = await fetch(track.audioUrl, { method: "GET" });
    if (!res.ok) {
      return new NextResponse("Upstream audio failed", { status: 502 });
    }
    const contentType = res.headers.get("content-type") || "audio/mpeg";
    const contentLength = res.headers.get("content-length");
    headers["Content-Type"] = contentType;
    if (contentLength) headers["Content-Length"] = contentLength;
    return new NextResponse(res.body, { headers });
  } catch (e) {
    console.error("Download fetch error:", e);
    return new NextResponse("Download failed", { status: 502 });
  }
}
