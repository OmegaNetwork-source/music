import { NextResponse } from "next/server";
import { ensureStoreLoaded, getTrending } from "@/lib/trackStore";

export async function GET() {
  await ensureStoreLoaded();
  const list = getTrending();
  return NextResponse.json({ success: true, trending: list });
}
