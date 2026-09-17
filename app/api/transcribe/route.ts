import { NextResponse } from "next/server";
import Groq from "groq-sdk";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    if (!process.env.GROQ_API_KEY) return NextResponse.json({ error:"GROQ_API_KEY is not configured" }, { status:500 });
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error:"Audio file is required" }, { status:400 });
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const result = await groq.audio.transcriptions.create({ file, model:process.env.GROQ_STT_MODEL || "whisper-large-v3-turbo", language:"en", temperature:0, response_format:"json" });
    return NextResponse.json({ text: result.text });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error:"Transcription failed" }, { status:502 });
  }
}
