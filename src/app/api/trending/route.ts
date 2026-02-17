import { NextResponse } from "next/server";
import { getTrending } from "@/lib/trackStore";

export async function GET() {
  const list = getTrending();
  return NextResponse.json({ success: true, trending: list });
}
