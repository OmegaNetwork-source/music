import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";

const BARK_VERSION = "suno-ai/bark:b76242b40d67c76ab6742e987628a2a9ac019e11d56ab96c4e91ce03b79b2787";

// Bark voice presets. Numbering doesn't match gender reliably; these are tuned for clearer male/female.
const VOICE_PRESETS: Record<string, string> = {
  female: "en_speaker_6",
  male: "en_speaker_1",
};

export async function POST(req: NextRequest) {
  try {
    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json(
        { success: false, error: "Missing REPLICATE_API_TOKEN. Add it to .env.local" },
        { status: 500 }
      );
    }

    const { lyrics, voice = "female" } = await req.json();

    if (!lyrics || typeof lyrics !== "string" || lyrics.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Lyrics are required for vocals" },
        { status: 400 }
      );
    }

    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    const preset = VOICE_PRESETS[voice] || VOICE_PRESETS.female;
    // Bark schema uses "prompt". ♪ encourages singing; more text = longer output (Bark has no duration param).
    const text = lyrics.trim();
    const prompt = `♪ ${text.slice(0, 400)} ♪`;

    const runInput = { prompt, history_prompt: preset };
    let output: unknown;
    try {
      output = await replicate.run(BARK_VERSION as `${string}/${string}`, { input: runInput });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const is429 = msg.includes("429") || msg.toLowerCase().includes("throttl");
      if (is429) {
        const retryAfter = 12;
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        try {
          output = await replicate.run(BARK_VERSION as `${string}/${string}`, { input: runInput });
        } catch (retryErr) {
          const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
          return NextResponse.json(
            {
              success: false,
              error: `Replicate rate limited (429). Waited ${retryAfter}s and retried; still failed. Add $5+ credit at replicate.com/account/billing for higher limits, or try again in a minute.`,
              detail: retryMsg,
            },
            { status: 429 }
          );
        }
      } else {
        throw err;
      }
    }

    // Bark schema output is audio_out (uri). Replicate may return object or FileOutput.
    const raw = (output as { audio_out?: unknown })?.audio_out ?? output;
    const audioUrl =
      typeof raw === "string"
        ? raw
        : (raw as { url?: () => string })?.url?.() ??
          (raw as { default?: string })?.default ??
          String(raw);

    if (!audioUrl || typeof audioUrl !== "string" || !audioUrl.startsWith("http")) {
      return NextResponse.json(
        { success: false, error: "No valid audio URL returned from Bark" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      audioUrl,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Vocals generation error:", error);
    const is429 = msg.includes("429") || msg.toLowerCase().includes("throttl");
    return NextResponse.json(
      {
        success: false,
        error: is429
          ? "Replicate rate limited (429). With <$5 credit you get 1 request at a time. Wait ~10s and try again, or add credit at replicate.com/account/billing."
          : msg,
        detail: msg,
      },
      { status: is429 ? 429 : 500 }
    );
  }
}
