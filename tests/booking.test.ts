import { describe, expect, it } from "vitest";
import { applyExtraction, businessIssues, mandatoryMissing } from "../lib/booking/validation";
import { emptyBooking, type Extraction, type UpdateObject } from "../lib/booking/schema";

const baseExtraction = (updates: Partial<UpdateObject>): Extraction => ({
  intent:"booking_info", updates:[{serviceType:null,pickup:null,dropoff:null,date:null,timeValue:null,timeFlexible:null,vehicleType:null,items:[],pickupFloor:null,dropoffFloor:null,pickupHasLift:null,dropoffHasLift:null,fragileItems:null,additionalInstructions:null,...updates}], corrections:[], ambiguities:[], contradictions:[], confidence:{pickup:1,dropoff:1,date:1,time:1,vehicle:1,quantity:1}, suggestedQuestion:null
});

describe("booking state",()=>{
  it("accepts information in arbitrary order",()=>{
    const s=applyExtraction(emptyBooking(),baseExtraction({date:"2026-09-16",timeValue:"18:00",timeFlexible:true,items:[{description:"sofa",quantity:2,approximateWeightKg:100}]}));
    expect(mandatoryMissing(s)).toContain("pickup location"); expect(s.items[0].description).toBe("sofa");
  });
  it("replaces corrected pickup",()=>{
    let s=applyExtraction(emptyBooking(),baseExtraction({pickup:{address:"HSR Layout",landmark:null,city:"Bengaluru"}}));
    s=applyExtraction(s,baseExtraction({pickup:{address:"Koramangala 5th Block",landmark:null,city:"Bengaluru"}}));
    expect(s.pickup?.address).toBe("Koramangala 5th Block");
  });
  it("flags over-capacity loads",()=>{
    let s=emptyBooking(); s=applyExtraction(s,baseExtraction({vehicleType:"mini_truck",items:[{description:"machine",quantity:1,approximateWeightKg:2000}]}));
    expect(businessIssues(s).some(x=>x.includes("exceeds"))).toBe(true);
  });
});
