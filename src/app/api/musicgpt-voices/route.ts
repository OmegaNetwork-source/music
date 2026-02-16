import { NextResponse } from "next/server";
import { MusicGPTClient } from "musicgpt";

export async function GET() {
  try {
    const apiKey = process.env.MUSICGPT_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, voices: [] }, { status: 200 });
    }
    const client = new MusicGPTClient(apiKey, "ERROR");
    const data = await client.getAllVoices(0, 150);
    if (!data.success || !Array.isArray(data.voices)) {
      return NextResponse.json({ success: true, voices: [] });
    }
    return NextResponse.json({
      success: true,
      voices: data.voices.map((v) => ({
        voice_id: v.voice_id,
        voice_name: v.voice_name,
      })),
    });
  } catch {
    return NextResponse.json({ success: true, voices: [] });
  }
}
