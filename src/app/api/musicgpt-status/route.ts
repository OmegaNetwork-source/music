import { NextRequest, NextResponse } from "next/server";
import { MusicGPTClient, MusicGPTConversionType } from "musicgpt";

export async function GET(req: NextRequest) {
  try {
    const apiKey = process.env.MUSICGPT_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "Missing MUSICGPT_API_KEY" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const conversionId = searchParams.get("conversion_id");
    if (!conversionId) {
      return NextResponse.json(
        { success: false, error: "Missing conversion_id" },
        { status: 400 }
      );
    }

    const client = new MusicGPTClient(apiKey, "ERROR");
    const data = await client.getConversion(
      MusicGPTConversionType.MUSIC_AI,
      undefined,
      conversionId
    );

    const conversion = data.conversion;

    if (!conversion) {
      return NextResponse.json({
        success: false,
        status: "failed",
        error: "No conversion data found"
      });
    }

    const { status, conversion_path_1, conversion_path_2, audio_url } = conversion;

    // The API returns "COMPLETED" (uppercase)
    if (status === "COMPLETED") {
      let finalAudioUrl = audio_url;

      // If we looked up by a specific sub-ID (conversion_id_1 or conversion_id_2),
      // make sure we return the correct file path for that specific version.
      if (conversion.conversion_id_1 === conversionId) {
        finalAudioUrl = conversion_path_1;
      } else if (conversion.conversion_id_2 === conversionId) {
        finalAudioUrl = conversion_path_2;
      } else {
        // Fallback or generic lookup
        finalAudioUrl = conversion_path_1 || conversion_path_2 || audio_url;
      }

      if (finalAudioUrl) {
        return NextResponse.json({
          success: true,
          status: "completed",
          audioUrl: finalAudioUrl,
        });
      }
    }

    if (status === "FAILED" || status === "CANCELLED" || status === "ERROR") {
      return NextResponse.json({
        success: false,
        status: "failed",
        error: conversion.message || "Generation failed",
      });
    }

    return NextResponse.json({
      success: true,
      status: "processing",
    });

  } catch (error: unknown) {
    console.error("MusicGPT status error:", error);
    const message =
      error && typeof error === "object" && "message" in error
        ? String((error as { message: unknown }).message)
        : "Status check failed";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
