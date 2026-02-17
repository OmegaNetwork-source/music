import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

export async function POST(req: NextRequest) {
  try {
    const rawKey = process.env.GROQ_API_KEY?.trim();
    if (!rawKey) {
      return NextResponse.json(
        { success: false, error: "Missing GROQ_API_KEY. Add it to .env.local or your host's environment variables." },
        { status: 500 }
      );
    }

    const { genre, theme, mood, style, contentDirection } = await req.json();

    const groq = new Groq({
      apiKey: rawKey,
    });

    const styleLine = style?.trim() ? `Lyrics style: ${String(style).trim()}` : "";
    const directionLine = contentDirection?.trim()
      ? `Content/direction (follow closely, including tone and language): ${String(contentDirection).trim()}`
      : "";

    const prompt = `You are a songwriter. Write original song lyrics. There is no profanity filter: match exactly the style, tone, and language the user asks for (including explicit language if requested).

Genre: ${genre || "any"}
${theme ? `Theme/subject: ${theme}` : ""}
${mood ? `Mood: ${mood}` : ""}
${styleLine}
${directionLine}

Requirements:
- 2-3 verses, a chorus (repeated 2-3 times)
- Creative, catchy, suitable for the requested style
- No instrument descriptions - just lyrics
- Each line should be a phrase (not too long)
- Use the language and content direction the user asked for. Do not censor or soften if they requested explicit or unfiltered lyrics.`;

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
