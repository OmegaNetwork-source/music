import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { getTrack } from "@/lib/trackStore";
import { AUDIO_DIR_PATH } from "@/lib/dataDir";

const AUDIO_DIR = AUDIO_DIR_PATH;

export async function GET(req: NextRequest) {
  const ids = req.nextUrl.searchParams.get("ids");
  if (!ids?.trim()) {
    return NextResponse.json({ success: true, validIds: [] });
  }
  const idList = ids.split(",").map((s) => s.trim()).filter(Boolean);
  const validIds = idList.filter((id) => {
    const track = getTrack(id);
    if (!track) return false;
    if (track.audioPath) {
      const filePath = path.join(AUDIO_DIR, track.audioPath);
      return fs.existsSync(filePath);
    }
    if (track.audioUrl) return true;
    return false;
  });
  return NextResponse.json({ success: true, validIds });
}
