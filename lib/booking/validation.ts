import type { BookingState, Extraction } from "./schema";

export const capacitiesKg: Record<NonNullable<BookingState["vehicleType"]>, number> = {
  mini_truck: 700,
  pickup: 1000,
  three_wheeler: 500,
  tempo: 1200,
  large_truck: 5000,
  unknown: 0
};

/** Current calendar date in the service's India time zone. */
export function indiaTodayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

export function mandatoryMissing(state: BookingState): string[] {
  const missing: string[] = [];
  if (!state.pickup) missing.push("pickup location");
  if (!state.dropoff) missing.push("drop-off location");
  if (!state.date) missing.push("date");
  if (!state.time) missing.push("time");
  if (!state.items.length) missing.push("items/load description");
  if (!state.vehicleType || state.vehicleType === "unknown") missing.push("vehicle type");
  return missing;
}

export function businessIssues(state: BookingState, todayISO = indiaTodayISO()): string[] {
  const issues: string[] = [];

  if (state.date && /^\d{4}-\d{2}-\d{2}$/.test(state.date) && state.date < todayISO) {
    issues.push(`The requested date ${state.date} is in the past. The move date must be today or a future date.`);
  }

  const totalWeight = state.items.reduce(
    (sum, item) => sum + (item.approximateWeightKg ?? 0) * (item.quantity ?? 1),
    0
  );

  if (
    state.vehicleType &&
    state.vehicleType !== "unknown" &&
    totalWeight > capacitiesKg[state.vehicleType]
  ) {
    issues.push(
      `The estimated ${totalWeight} kg load exceeds the ${capacitiesKg[state.vehicleType]} kg capacity of the selected vehicle.`
    );
  }

  return issues;
}

export function formatDateForSpeechOrUi(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata"
  }).format(date);
}

export function applyExtraction(state: BookingState, e: Extraction): BookingState {
  const updates = e.updates.length ? e.updates : [];
  const merged = updates.reduce<Record<string, unknown>>((acc, update) => {
    for (const [key, value] of Object.entries(update)) {
      // null and empty item arrays mean "not supplied in this turn".
      if (value !== null && !(Array.isArray(value) && value.length === 0)) {
        acc[key] = value;
      }
    }
    return acc;
  }, {});

  const u = merged as Partial<Extraction["updates"][number]>;

  return {
    ...state,
    serviceType:
      u.serviceType && u.serviceType !== "unknown" ? u.serviceType : state.serviceType,
    pickup: u.pickup ?? state.pickup,
    dropoff: u.dropoff ?? state.dropoff,
    date: u.date ?? state.date,
    time: u.timeValue
      ? { value: u.timeValue, flexible: u.timeFlexible ?? false }
      : state.time,
    vehicleType:
      u.vehicleType && u.vehicleType !== "unknown" ? u.vehicleType : state.vehicleType,
    items: u.items?.length ? u.items : state.items,
    pickupFloor: u.pickupFloor ?? state.pickupFloor,
    dropoffFloor: u.dropoffFloor ?? state.dropoffFloor,
    pickupHasLift: u.pickupHasLift ?? state.pickupHasLift,
    dropoffHasLift: u.dropoffHasLift ?? state.dropoffHasLift,
    fragileItems: u.fragileItems ?? state.fragileItems,
    additionalInstructions: u.additionalInstructions ?? state.additionalInstructions,
    confirmed: false
  };
}

export function getBusinessIssueReply(issues: string[], state: BookingState): string | null {
  const pastDate = issues.find((issue) => issue.includes("is in the past"));
  if (pastDate) {
    const date = state.date
      ? formatDateForSpeechOrUi(state.date)
      : "That date";
    return `${date} has already passed, so I can't use it for the move. What future date would you like instead?`;
  }

  const capacity = issues.find((issue) => issue.includes("exceeds"));
  if (capacity) {
    return `${capacity.replace(/^The estimated /, "The load is ")}. Would you like to choose a larger vehicle?`;
  }

  return null;
}
