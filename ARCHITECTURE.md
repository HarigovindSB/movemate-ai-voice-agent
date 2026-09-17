# Architecture notes

## Core invariant

The LLM may propose state changes, but it never directly mutates the canonical booking state.

```text
LLM extraction → schema validation → deterministic merge → business validation → response generation
```

## Turn lifecycle

1. Receive a transcript.
2. Send current state + recent conversation + transcript to the extractor.
3. Parse strict JSON Schema output.
4. Apply only non-null updates.
5. Run deterministic business rules.
6. Compute mandatory missing fields.
7. Generate one natural-language response based on the resulting state.
8. If all requirements are valid, ask for explicit confirmation.
9. Only a confirmation_yes transition sets `confirmed=true`.

## Uncertainty policy

- Missing → ask.
- Ambiguous/high-impact → clarify.
- Correction → replace active value and acknowledge it.
- Contradiction → do not silently choose.
- Invalid business rule → explain constraint and request a correction.
- Unknown/off-topic → redirect without fabricating an answer.

## Production evolution

A production version could replace browser recognition with streaming audio/WebRTC and add:

- persistent sessions in Redis/Postgres
- real address autocomplete/geocoding
- serviceability API
- vehicle inventory API
- pricing/quote tool
- interruption-aware streaming TTS
- observability/tracing
- evaluation datasets and conversation replay
