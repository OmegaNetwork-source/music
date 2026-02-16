import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";

const MUSICGEN_VERSION = "charlesmccarthy/musicgen:d51032695d2c2ec28031e9e30b793b1a8f61efe367af46027a211c2954a6ad44";

export async function POST(req: NextRequest) {
  try {
    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json(
        { success: false, error: "Missing REPLICATE_API_TOKEN. Add it to .env.local" },
        { status: 500 }
      );
    }

    const { prompt, genre, duration = 15 } = await req.json();

    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    // Combine genre + user prompt for richer music generation
    const fullPrompt = genre
      ? `${genre} style, ${prompt}`
      : prompt;

    const runInput = {
      prompt: fullPrompt,
      model_version: "large",
      duration: Math.min(60, Math.max(8, Number(duration) || 60)),
    };
    let output: unknown;
    try {
      output = await replicate.run(MUSICGEN_VERSION as `${string}/${string}`, { input: runInput });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const is429 = msg.includes("429") || msg.toLowerCase().includes("throttl");
      if (is429) {
        const retryAfter = 12;
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        try {
          output = await replicate.run(MUSICGEN_VERSION as `${string}/${string}`, { input: runInput });
        } catch (retryErr) {
          const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
          return NextResponse.json(
            {
              success: false,
              error: `Replicate rate limited (429). Waited ${retryAfter}s and retried; still failed. Add $5+ credit at replicate.com/account/billing, or try again later.`,
              detail: retryMsg,
            },
            { status: 429 }
          );
        }
      } else {
        throw err;
      }
    }

    // output can be string URL or FileOutput object
    const audioUrl =
      typeof output === "string"
        ? output
        : (output as { url?: () => string })?.url?.() ??
          (output as { default?: string })?.default ??
          String(output);

    return NextResponse.json({
      success: true,
      audioUrl: audioUrl || output,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Music generation error:", error);
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
