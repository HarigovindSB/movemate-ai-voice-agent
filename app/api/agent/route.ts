import { NextResponse } from "next/server";
import { extractTurn, generateReply } from "@/lib/llm/groq";
import { applyExtraction, businessIssues, getBusinessIssueReply, mandatoryMissing } from "@/lib/booking/validation";
import { BookingStateSchema, emptyBooking } from "@/lib/booking/schema";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    if (!process.env.GROQ_API_KEY) return NextResponse.json({ error:"GROQ_API_KEY is not configured" }, { status:500 });
    const body = await req.json();
    const state = BookingStateSchema.parse(body.state ?? emptyBooking());
    const history = Array.isArray(body.history) ? body.history : [];
    const utterance = String(body.utterance ?? "").trim();
    if (!utterance) return NextResponse.json({ error:"Utterance is required" }, { status:400 });

    const extraction = await extractTurn(state, history, utterance);
    let nextState = applyExtraction(state, extraction);
    const issues = businessIssues(nextState);
    const missing = mandatoryMissing(nextState);

    // Hard validation failures should not depend on a second LLM call.
    // This is especially important for past dates and vehicle-capacity errors.
    const deterministicIssueReply = getBusinessIssueReply(issues, nextState);
    if (deterministicIssueReply) {
      return NextResponse.json({
        state: nextState,
        extraction,
        reply: deterministicIssueReply,
        missing,
        issues
      });
    }

    if (extraction.intent === "confirmation_yes" && missing.length === 0 && issues.length === 0) {
      nextState = { ...nextState, confirmed:true };
      return NextResponse.json({ state:nextState, extraction, reply:"Perfect. I’ve confirmed the requirements. This demo stops at confirmation; no real booking has been placed.", missing, issues });
    }
    if (extraction.intent === "confirmation_no") {
      nextState = { ...nextState, confirmed:false };
    }
    const reply = await generateReply(nextState, extraction, utterance);
    return NextResponse.json({ state:nextState, extraction, reply, missing, issues });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error:"Agent failed. Please retry the last message." }, { status:502 });
  }
}
