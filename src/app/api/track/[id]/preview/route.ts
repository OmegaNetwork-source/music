import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { ensureStoreLoaded, getTrack } from "@/lib/trackStore";
import { AUDIO_DIR_PATH, DATA_DIR } from "@/lib/dataDir";

const PREVIEW_BYTES = 500_000; // ~25s of MP3
const AUDIO_DIR = AUDIO_DIR_PATH;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureStoreLoaded();
  const { id } = await params;
  const track = id ? getTrack(id) : undefined;
  if (!track) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[preview] 404 track not in store:", id, "| DATA_DIR:", DATA_DIR);
    }
    return new NextResponse("Track not found", { status: 404 });
  }

  try {
    if (track.blobUrl) {
      const res = await fetch(track.blobUrl, { method: "GET" });
      if (!res.ok) {
        return new NextResponse("Blob audio failed", { status: 502 });
      }
      const reader = res.body?.getReader();
      if (!reader) return new NextResponse("No stream", { status: 502 });
      let read = 0;
      const chunks: Uint8Array[] = [];
      while (read < PREVIEW_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        const take = Math.min(value.length, PREVIEW_BYTES - read);
        chunks.push(value.slice(0, take));
        read += take;
      }
      reader.cancel();
      const body = new Uint8Array(read);
      let offset = 0;
      for (const c of chunks) {
        body.set(c, offset);
        offset += c.length;
      }
      return new NextResponse(body, {
        headers: {
          "Content-Type": res.headers.get("content-type") || "audio/mpeg",
          "Content-Length": String(body.length),
        },
      });
    }
    if (track.audioPath) {
      const filePath = path.join(AUDIO_DIR, track.audioPath);
      if (!fs.existsSync(filePath)) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[preview] 404 audio file missing:", filePath, "| AUDIO_DIR:", AUDIO_DIR);
        }
        return new NextResponse("Audio file not found", { status: 404 });
      }
      const stat = fs.statSync(filePath);
      const readLen = Math.min(stat.size, PREVIEW_BYTES);
      const fd = fs.openSync(filePath, "r");
      const buffer = Buffer.alloc(readLen);
      fs.readSync(fd, buffer, 0, readLen, 0);
      fs.closeSync(fd);
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "audio/mpeg",
          "Content-Length": String(readLen),
        },
      });
    }

    if (!track.audioUrl) {
      return new NextResponse("Track has no audio source", { status: 502 });
    }
    const res = await fetch(track.audioUrl, { method: "GET" });
    if (!res.ok) {
      return new NextResponse("Upstream audio failed", { status: 502 });
    }
    const contentType = res.headers.get("content-type") || "audio/mpeg";
    const reader = res.body?.getReader();
    if (!reader) {
      return new NextResponse("No stream", { status: 502 });
    }
    let read = 0;
    const chunks: Uint8Array[] = [];
    while (read < PREVIEW_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      const take = Math.min(value.length, PREVIEW_BYTES - read);
      chunks.push(value.slice(0, take));
      read += take;
      if (read >= PREVIEW_BYTES) break;
    }
    reader.cancel();
    const body = new Uint8Array(read);
    let offset = 0;
    for (const c of chunks) {
      body.set(c, offset);
      offset += c.length;
    }
    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(body.length),
      },
    });
  } catch (e) {
    console.error("Preview fetch error:", e);
    return new NextResponse("Preview failed", { status: 502 });
  }
}
