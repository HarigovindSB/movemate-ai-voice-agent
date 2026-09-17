import { z } from "zod";

export const BookingStateSchema = z.object({
  serviceType: z.enum(["goods_transport", "house_moving", "office_moving", "unknown"]),
  pickup: z.object({ address: z.string(), landmark: z.string().nullable(), city: z.string() }).nullable(),
  dropoff: z.object({ address: z.string(), landmark: z.string().nullable(), city: z.string() }).nullable(),
  date: z.string().nullable(),
  time: z.object({ value: z.string(), flexible: z.boolean() }).nullable(),
  vehicleType: z.enum(["mini_truck", "pickup", "three_wheeler", "tempo", "large_truck", "unknown"]).nullable(),
  items: z.array(z.object({ description: z.string(), quantity: z.number().nullable(), approximateWeightKg: z.number().nullable() })),
  pickupFloor: z.number().nullable(),
  dropoffFloor: z.number().nullable(),
  pickupHasLift: z.boolean().nullable(),
  dropoffHasLift: z.boolean().nullable(),
  fragileItems: z.boolean().nullable(),
  additionalInstructions: z.string().nullable(),
  confirmed: z.boolean()
});

export type BookingState = z.infer<typeof BookingStateSchema>;

export const UpdateObjectSchema = z.object({
  serviceType: z.enum(["goods_transport", "house_moving", "office_moving", "unknown"]).nullable(),
  pickup: z.object({ address: z.string(), landmark: z.string().nullable(), city: z.string() }).nullable(),
  dropoff: z.object({ address: z.string(), landmark: z.string().nullable(), city: z.string() }).nullable(),
  date: z.string().nullable(),
  timeValue: z.string().nullable(),
  timeFlexible: z.boolean().nullable(),
  vehicleType: z.enum(["mini_truck", "pickup", "three_wheeler", "tempo", "large_truck", "unknown"]).nullable(),
  items: z.array(z.object({ description: z.string(), quantity: z.number().nullable(), approximateWeightKg: z.number().nullable() })),
  pickupFloor: z.number().nullable(),
  dropoffFloor: z.number().nullable(),
  pickupHasLift: z.boolean().nullable(),
  dropoffHasLift: z.boolean().nullable(),
  fragileItems: z.boolean().nullable(),
  additionalInstructions: z.string().nullable()
});

export type UpdateObject = z.infer<typeof UpdateObjectSchema>;

export const emptyUpdate = (): UpdateObject => ({
  serviceType: null,
  pickup: null,
  dropoff: null,
  date: null,
  timeValue: null,
  timeFlexible: null,
  vehicleType: null,
  items: [],
  pickupFloor: null,
  dropoffFloor: null,
  pickupHasLift: null,
  dropoffHasLift: null,
  fragileItems: null,
  additionalInstructions: null
});

export const emptyBooking = (): BookingState => ({
  serviceType: "unknown", pickup: null, dropoff: null, date: null, time: null,
  vehicleType: null, items: [], pickupFloor: null, dropoffFloor: null,
  pickupHasLift: null, dropoffHasLift: null, fragileItems: null,
  additionalInstructions: null, confirmed: false
});

export const ExtractionSchema = z.object({
  intent: z.enum(["booking_info", "confirmation_yes", "confirmation_no", "question", "off_topic", "silence", "unknown"]),
  // The model commonly emits updates as an array. The state manager merges the
  // objects, which also makes the extractor tolerant of a model accidentally
  // splitting updates into more than one object.
  updates: z.array(UpdateObjectSchema),
  corrections: z.array(z.object({ field: z.string(), oldValue: z.string(), newValue: z.string() })),
  ambiguities: z.array(z.string()),
  contradictions: z.array(z.string()),
  confidence: z.object({ pickup: z.number(), dropoff: z.number(), date: z.number(), time: z.number(), vehicle: z.number(), quantity: z.number() }),
  suggestedQuestion: z.string().nullable()
});

export type Extraction = z.infer<typeof ExtractionSchema>;
