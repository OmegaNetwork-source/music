import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { put } from "@vercel/blob";
import {
  ensureStoreLoaded,
  persistStore,
  registerTrack,
  registerTrackWithLocalFile,
  registerTrackWithBlobUrl,
  getTrack,
  getTrackCount,
} from "@/lib/trackStore";
import { AUDIO_DIR_PATH } from "@/lib/dataDir";

const AUDIO_DIR = AUDIO_DIR_PATH;
const MAX_TRACKS = Number(process.env.MUSIC_STUDIO_MAX_TRACKS) || 50;

export async function POST(req: NextRequest) {
  try {
    await ensureStoreLoaded();
    const count = getTrackCount();
    if (count >= MAX_TRACKS) {
      return NextResponse.json(
        { success: false, error: `Storage limit reached (max ${MAX_TRACKS} tracks). Delete old tracks to add new ones.` },
        { status: 403 }
      );
    }
    const { audioUrl, name, lyrics } = await req.json();
    if (!audioUrl || typeof audioUrl !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing audioUrl" },
        { status: 400 }
      );
    }
    const lyricsStr = typeof lyrics === "string" ? lyrics.trim() : undefined;

    const trackId = crypto.randomUUID();
    const fileName = `${trackId}.mp3`;
    const filePath = path.join(AUDIO_DIR, fileName);
    const displayName = name?.trim() || "Untitled";

    const fetchWithTimeout = (url: string, ms = 25000) =>
      Promise.race([
        fetch(url, { method: "GET" }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Download timeout")), ms)
        ),
      ]) as Promise<Response>;

    let res: Response;
    try {
      res = await fetchWithTimeout(audioUrl);
    } catch (e) {
      console.error("Register track: fetch failed", e);
      try {
        res = await fetchWithTimeout(audioUrl, 15000);
      } catch (e2) {
        const fallbackId = registerTrack(audioUrl, displayName);
        await persistStore();
        return NextResponse.json({
          success: true,
          trackId: fallbackId,
          warning: "Audio saved by URL; it may expire. Unlock soon to keep it.",
        });
      }
    }
    if (!res.ok) {
      console.error("Register track: upstream audio failed", res.status, audioUrl);
      const fallbackId = registerTrack(audioUrl, displayName);
      await persistStore();
      return NextResponse.json({
        success: true,
        trackId: fallbackId,
        warning: "Audio saved by URL; it may expire. Unlock soon to keep it.",
      });
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0) {
      const fallbackId = registerTrack(audioUrl, displayName);
      await persistStore();
      return NextResponse.json({
        success: true,
        trackId: fallbackId,
        warning: "Audio saved by URL; empty response.",
      });
    }

    const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
    if (useBlob) {
      const blob = await put(`tracks/${trackId}.mp3`, buffer, {
        access: "public",
        contentType: "audio/mpeg",
      });
      registerTrackWithBlobUrl(trackId, displayName, blob.url, lyricsStr);
      await persistStore();
      const saved = getTrack(trackId);
      if (!saved?.blobUrl) {
        console.error("[register-track] Track not in store after Blob save:", trackId);
        return NextResponse.json(
          { success: false, error: "Track not persisted; try again." },
          { status: 500 }
        );
      }
      if (process.env.NODE_ENV === "development") {
        console.log("[register-track] Saved", trackId, "to Blob:", blob.url);
      }
      return NextResponse.json({ success: true, trackId });
    }

    if (!fs.existsSync(AUDIO_DIR)) {
      fs.mkdirSync(AUDIO_DIR, { recursive: true });
    }
    fs.writeFileSync(filePath, buffer, "binary");
    registerTrackWithLocalFile(trackId, displayName, fileName, lyricsStr);
    await persistStore();

    const saved = getTrack(trackId);
    if (!saved) {
      console.error("[register-track] Track not in store after save:", trackId);
      return NextResponse.json(
        { success: false, error: "Track not persisted; try again." },
        { status: 500 }
      );
    }
    if (!fs.existsSync(filePath)) {
      console.error("[register-track] Audio file missing after write:", filePath);
      return NextResponse.json(
        { success: false, error: "Audio file not saved; try again." },
        { status: 500 }
      );
    }
    if (process.env.NODE_ENV === "development") {
      console.log("[register-track] Saved", trackId, "to", AUDIO_DIR);
    }
    return NextResponse.json({ success: true, trackId });
  } catch (error) {
    console.error("Register track error:", error);
    try {
      const { audioUrl, name } = await req.clone().json();
      if (audioUrl && typeof audioUrl === "string") {
        await ensureStoreLoaded();
        const fallbackId = registerTrack(audioUrl, name?.trim() || "Untitled");
        await persistStore();
        return NextResponse.json({
          success: true,
          trackId: fallbackId,
          warning: "Audio saved by URL; it may expire.",
        });
      }
    } catch {
      // ignore
    }
    return NextResponse.json(
      { success: false, error: "Failed to register track" },
      { status: 500 }
    );
  }
}
