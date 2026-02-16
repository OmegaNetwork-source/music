import { NextResponse } from "next/server";
import { MusicGPTClient } from "musicgpt";

export async function GET() {
  try {
    const apiKey = process.env.MUSICGPT_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        maleVoiceId: null,
        femaleVoiceId: null,
      });
    }
    const client = new MusicGPTClient(apiKey, "ERROR");
    const [femaleRes, maleRes] = await Promise.all([
      client.searchVoices("female", 0, 5),
      client.searchVoices("male", 0, 5),
    ]);
    const femaleVoiceId =
      femaleRes.voices?.length > 0 ? femaleRes.voices[0].voice_id : null;
    const maleVoiceId =
      maleRes.voices?.length > 0 ? maleRes.voices[0].voice_id : null;
    return NextResponse.json({
      maleVoiceId,
      femaleVoiceId,
    });
  } catch {
    return NextResponse.json({
      maleVoiceId: null,
      femaleVoiceId: null,
    });
  }
}
