# MoveMate — Conversational Transportation Booking Agent

A voice-first booking assistant built for the AI Voice Agent technical assessment. The important part of the implementation is not the UI; it is the separation between **LLM interpretation** and a **validated, deterministic booking state**.

## 🚀 Live Demo

**Live Application:** https://movemate-ai-voice-agent.vercel.app

**GitHub Repository:** https://github.com/HarigovindSB/movemate-ai-voice-agent

## Architecture

```text
Browser voice/text
      ↓
Speech recognition / text input
      ↓
POST /api/agent
      ↓
Groq structured extraction
      ↓
Zod validation + deterministic state manager
      ↓
Business rules (past date, vehicle capacity, required fields)
      ↓
Groq conversational response generation
      ↓
Browser speechSynthesis + live requirement summary
```

The browser's Web Speech Recognition is used as the zero-cost voice path. The server also includes a Groq Whisper endpoint (`/api/transcribe`) for a higher-quality STT path; it is intentionally not required by the main UI so the demo can work without a second paid speech vendor.

Groq currently documents Whisper Large V3 Turbo and Whisper Large V3 for transcription, and its structured-output feature supports strict JSON Schema on supported models. This project defaults to `openai/gpt-oss-20b` for structured extraction and `whisper-large-v3-turbo` for optional server-side STT. See the official docs for current availability and quotas.

## Why the state machine matters

The agent does **not** let the LLM own the booking state. Each turn is extracted into a typed object, then merged by deterministic TypeScript code. That means a correction such as “actually pickup is Koramangala” replaces the active pickup rather than leaving two competing values in the booking. Business rules are also deterministic rather than hallucinated by the model.

The agent explicitly handles:

- Information provided in any order
- Missing information
- Ambiguous locations/times
- Corrections and contradictions
- Past dates
- Vehicle capacity violations
- Off-topic turns
- Final review and explicit confirmation
- API failures with a safe retry message

## Free setup

This project is designed to be usable with free-tier access. No paid database or TTS provider is required.

1. Install Node.js 20+.
2. Clone the repository.
3. Run:

```bash
npm install
cp .env.example .env.local
```

4. Add a Groq API key to `.env.local`:

```env
GROQ_API_KEY=your_key_here
GROQ_CHAT_MODEL=openai/gpt-oss-20b
GROQ_STT_MODEL=whisper-large-v3-turbo
```

5. Start:

```bash
npm run dev
```

6. Open `http://localhost:3000`.

### Getting the API key

Create a Groq API key from the Groq console. Keep it server-side; do not prefix it with `NEXT_PUBLIC_` and do not commit `.env.local`.

## Deployment on Vercel

1. Push this repository to GitHub.
2. Import the repository into Vercel.
3. Add `GROQ_API_KEY` under Project Settings → Environment Variables.
4. Optionally add the two model variables from `.env.example`.
5. Deploy.

The live URL can then be placed in this README before submission.

## Testing

Run:

```bash
npm test
```

The included tests cover arbitrary information order, correction propagation, and vehicle capacity validation.

## Suggested evaluator test cases

Try these deliberately difficult conversations:

1. “I need to move some stuff tomorrow evening.” → agent should gather missing details without assuming an exact time.
2. “Pickup is HSR. Actually, sorry, Koramangala 5th Block.” → active pickup should be Koramangala.
3. “Tomorrow at 5. Actually Thursday.” → agent should surface/resolve the date conflict rather than silently guessing.
4. “Move a 2,000 kg machine in a mini truck.” → capacity rule should reject it.
5. “Pick it up from the main road near Koramangala.” → agent should request a usable location instead of inventing an address.
6. Give pickup/drop/date/items in one sentence and verify the agent does not ask for already supplied information.
7. Ask an unrelated question and verify the agent redirects naturally.
8. Interrupt yourself with a correction and verify the live summary changes.

## Assumptions / limitations

- This is a requirements-gathering assessment, not a real logistics marketplace. No real booking is submitted.
- Exact serviceability by pincode, vehicle inventory, pricing, and live availability would require a real backend/provider integration.
- Browser speech recognition availability varies by browser. The text input is an intentional fallback.
- Free API quotas are provider/account dependent; “free” does not mean unlimited. The app isolates providers so STT/LLM can be swapped without changing the booking state layer.
- The demo uses a simplified vehicle-capacity table to demonstrate deterministic business validation.
