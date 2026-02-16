import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { success: false, error: "Missing GROQ_API_KEY. Add it to .env.local" },
        { status: 500 }
      );
    }

    const { genre, theme, mood } = await req.json();

    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });

    const prompt = `Write original song lyrics. 
Genre: ${genre || "any"}
${theme ? `Theme/subject: ${theme}` : ""}
${mood ? `Mood: ${mood}` : ""}

Requirements:
- 2-3 verses, a chorus (repeated 2-3 times)
- Creative, catchy, suitable for singing
- No instrument descriptions - just lyrics
- Each line should be a phrase (not too long)`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 600,
      temperature: 0.9,
    });

    const lyrics =
      completion.choices[0]?.message?.content?.trim() ||
      "Could not generate lyrics. Try again.";

    return NextResponse.json({
      success: true,
      lyrics,
    });
  } catch (error) {
    console.error("Lyrics generation error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to generate lyrics",
      },
      { status: 500 }
    );
  }
}
