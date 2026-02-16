import { NextRequest, NextResponse } from "next/server";
import { MusicGPTClient } from "musicgpt";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.MUSICGPT_API_KEY;

    // FORCING LOGS TO RENDER
    console.error("DEBUG: Request received at /api/generate-musicgpt");
    console.error("DEBUG: Keys in process.env:", Object.keys(process.env).join(", "));
    console.error("DEBUG: MUSICGPT_API_KEY found?", !!apiKey);

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "Missing MUSICGPT_API_KEY" },
        { status: 500 }
      );
    }

    const { lyrics, genre, stylePrompt, makeInstrumental, voiceId, output_length } = await req.json();

    const prompt =
      (stylePrompt || "").trim() || `${genre || "Pop"} style, catchy song`;

    const client = new MusicGPTClient(apiKey, "ERROR");
    const music = await client.music_ai({
      prompt: prompt.slice(0, 280),
      music_style: genre || "Pop",
      lyrics: (lyrics || "").trim().slice(0, 3000) || undefined,
      make_instrumental: Boolean(makeInstrumental),
      vocal_only: false,
      ...(voiceId && typeof voiceId === "string" && voiceId.trim() && { voice_id: voiceId.trim() }),
      ...(typeof output_length === "number" && output_length > 0 && { output_length }),
    });

    const taskId = music.task_id;
    const conversionId1 = music.conversion_id_1;
    const conversionId2 = music.conversion_id_2;
    const eta = typeof music.eta === "number" && music.eta > 0 ? music.eta : 120;

    if (!taskId || (!conversionId1 && !conversionId2)) {
      return NextResponse.json(
        { success: false, error: "No task or conversion ID from MusicGPT" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      task_id: taskId,
      conversion_ids: [conversionId1, conversionId2].filter(Boolean) as string[],
      eta,
    });
  } catch (error: unknown) {
    console.error("MusicGPT error:", error);
    const message =
      error && typeof error === "object" && "message" in error
        ? String((error as { message: unknown }).message)
        : "MusicGPT generation failed";
    const status =
      message.includes("402") || (error as { response?: { status?: number } })?.response?.status === 402
        ? 402
        : 500;
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}
