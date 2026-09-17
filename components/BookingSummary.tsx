import type { BookingState } from "@/lib/booking/schema";
import { businessIssues, mandatoryMissing, formatDateForSpeechOrUi } from "@/lib/booking/validation";

const vehicleLabels: Record<string,string> = { mini_truck:"Mini truck", pickup:"Pickup", three_wheeler:"Three-wheeler", tempo:"Tempo", large_truck:"Large truck", unknown:"Not specified" };
const value = (x: unknown) => x === null || x === undefined || x === "" ? "Not specified" : String(x);

export function BookingSummary({ state }: { state: BookingState }) {
  const missing = mandatoryMissing(state), issues = businessIssues(state);
  const items = state.items.length ? state.items.map(i => `${i.quantity ? `${i.quantity} × ` : ""}${i.description}${i.approximateWeightKg ? ` (~${i.approximateWeightKg} kg)` : ""}`).join(", ") : "Not specified";
  const fields = [
    ["Service", state.serviceType === "unknown" ? "Not specified" : state.serviceType.replaceAll("_"," ")],
    ["Pickup", state.pickup ? `${state.pickup.address}${state.pickup.city ? `, ${state.pickup.city}` : ""}` : null],
    ["Drop-off", state.dropoff ? `${state.dropoff.address}${state.dropoff.city ? `, ${state.dropoff.city}` : ""}` : null],
    ["Date", state.date ? formatDateForSpeechOrUi(state.date) : null], ["Time", state.time ? `${state.time.value}${state.time.flexible ? " (flexible)" : ""}` : null],
    ["Vehicle", state.vehicleType ? vehicleLabels[state.vehicleType] : null], ["Items", items],
    ["Pickup floor", state.pickupFloor === null ? null : `${state.pickupFloor}${state.pickupHasLift === null ? "" : state.pickupHasLift ? " (lift)" : " (no lift)"}`],
    ["Drop-off floor", state.dropoffFloor === null ? null : `${state.dropoffFloor}${state.dropoffHasLift === null ? "" : state.dropoffHasLift ? " (lift)" : " (no lift)"}`],
    ["Fragile", state.fragileItems === null ? null : state.fragileItems ? "Yes" : "No"],
    ["Instructions", state.additionalInstructions]
  ] as const;
  return <div className="summary">
    <div className={`status ${missing.length || issues.length ? "warn" : "good"}`}>
      {state.confirmed ? "✓ Requirements confirmed" : missing.length ? `Still needed: ${missing.join(", ")}.` : issues.length ? issues.join(" ") : "All required details collected. Review and confirm."}
    </div>
    {fields.map(([label,v]) => <div className="field" key={label}><div className="label">{label}</div><div className={`value ${v == null ? "missing" : ""}`}>{value(v)}</div></div>)}
    <p className="small">The summary is maintained separately from the transcript so corrections replace the active value rather than creating duplicate answers.</p>
  </div>;
}
