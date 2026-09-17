import Groq from "groq-sdk";
import { ExtractionSchema, type BookingState, type Extraction } from "../booking/schema";
import { EXTRACTION_SYSTEM, RESPONSE_SYSTEM } from "../agent/prompt";
import { businessIssues, getBusinessIssueReply, indiaTodayISO, mandatoryMissing } from "../booking/validation";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const chatModel = process.env.GROQ_CHAT_MODEL || "openai/gpt-oss-20b";

// Groq strict structured output requires every property of an object to be required.
// We therefore represent an extraction turn as exactly one update object wrapped in
// a one-element array. Every field is present in that object; null/[] means "not
// provided or not changed in this turn".
const updateObjectSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    serviceType: { type: ["string", "null"], enum: ["goods_transport", "house_moving", "office_moving", "unknown", null] },
    pickup: {
      type: ["object", "null"],
      additionalProperties: false,
      properties: {
        address: { type: "string" },
        landmark: { type: ["string", "null"] },
        city: { type: "string" }
      },
      required: ["address", "landmark", "city"]
    },
    dropoff: {
      type: ["object", "null"],
      additionalProperties: false,
      properties: {
        address: { type: "string" },
        landmark: { type: ["string", "null"] },
        city: { type: "string" }
      },
      required: ["address", "landmark", "city"]
    },
    date: { type: ["string", "null"] },
    timeValue: { type: ["string", "null"] },
    timeFlexible: { type: ["boolean", "null"] },
    vehicleType: { type: ["string", "null"], enum: ["mini_truck", "pickup", "three_wheeler", "tempo", "large_truck", "unknown", null] },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          description: { type: "string" },
          quantity: { type: ["number", "null"] },
          approximateWeightKg: { type: ["number", "null"] }
        },
        required: ["description", "quantity", "approximateWeightKg"]
      }
    },
    pickupFloor: { type: ["number", "null"] },
    dropoffFloor: { type: ["number", "null"] },
    pickupHasLift: { type: ["boolean", "null"] },
    dropoffHasLift: { type: ["boolean", "null"] },
    fragileItems: { type: ["boolean", "null"] },
    additionalInstructions: { type: ["string", "null"] }
  },
  required: [
    "serviceType", "pickup", "dropoff", "date", "timeValue", "timeFlexible",
    "vehicleType", "items", "pickupFloor", "dropoffFloor", "pickupHasLift",
    "dropoffHasLift", "fragileItems", "additionalInstructions"
  ]
};

const jsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    intent: {
      type: "string",
      enum: ["booking_info", "confirmation_yes", "confirmation_no", "question", "off_topic", "silence", "unknown"]
    },
    updates: {
      type: "array",
      items: updateObjectSchema
    },
    corrections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          field: { type: "string" },
          oldValue: { type: "string" },
          newValue: { type: "string" }
        },
        required: ["field", "oldValue", "newValue"]
      }
    },
    ambiguities: { type: "array", items: { type: "string" } },
    contradictions: { type: "array", items: { type: "string" } },
    confidence: {
      type: "object",
      additionalProperties: false,
      properties: {
        pickup: { type: "number" },
        dropoff: { type: "number" },
        date: { type: "number" },
        time: { type: "number" },
        vehicle: { type: "number" },
        quantity: { type: "number" }
      },
      required: ["pickup", "dropoff", "date", "time", "vehicle", "quantity"]
    },
    suggestedQuestion: { type: ["string", "null"] }
  },
  required: ["intent", "updates", "corrections", "ambiguities", "contradictions", "confidence", "suggestedQuestion"]
};

export async function extractTurn(
  state: BookingState,
  history: { role: "user" | "assistant"; content: string }[],
  utterance: string
): Promise<Extraction> {
  // Use the machine's current date for relative-date resolution. The prompt also
  // tells the model not to invent an exact clock time for vague dayparts.
  const today = indiaTodayISO();

  const response = await groq.chat.completions.create({
    model: chatModel,
    temperature: 0,
    messages: [
      { role: "system", content: EXTRACTION_SYSTEM },
      {
        role: "user",
        content: JSON.stringify({
          today,
          existingBookingState: state,
          recentConversation: history.slice(-8),
          latestUserUtterance: utterance
        })
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "booking_extraction", strict: true, schema: jsonSchema }
    }
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  return ExtractionSchema.parse(JSON.parse(raw));
}

export async function generateReply(
  state: BookingState,
  extraction: Extraction,
  userUtterance: string
): Promise<string> {
  const missing = mandatoryMissing(state);
  const issues = businessIssues(state);

  // Do not send hard business-rule failures back through the LLM.
  // This guarantees that past dates and impossible loads receive a useful
  // response even if the LLM is rate-limited or temporarily unavailable.
  const deterministicIssueReply = getBusinessIssueReply(issues, state);
  if (deterministicIssueReply) return deterministicIssueReply;

  const response = await groq.chat.completions.create({
    model: chatModel,
    temperature: 0.25,
    messages: [
      { role: "system", content: RESPONSE_SYSTEM },
      {
        role: "user",
        content: JSON.stringify({
          currentState: state,
          missing,
          businessIssues: issues,
          extraction,
          latestUserUtterance: userUtterance,
          instruction: missing.length
            ? "Continue gathering the highest-priority missing requirement. Ask exactly one question."
            : "The booking appears complete. Summarize all requirements and ask for explicit confirmation."
        })
      }
    ]
  });
  return response.choices[0]?.message?.content?.trim() || "I’m sorry, I didn’t catch that. Could you say it again?";
}
