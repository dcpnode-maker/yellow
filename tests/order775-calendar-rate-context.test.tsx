import { expect, test } from "bun:test";
import { confirmedCalendarRate } from "../frontend/yellow/src/workspaces/HostReservationCalendar";
import type { HostCalendarReadResult } from "../frontend/yellow/src/host-calendar-read-foundation";

const context={propertyId:"00000000-0000-4000-8000-000000000001",timezone:"UTC",unitTypeId:"00000000-0000-4000-8000-000000000002",sellableUnitId:"00000000-0000-4000-8000-000000000003",ratePlanId:"00000000-0000-4000-8000-000000000004",occupancy:2,channelCode:"DIRECT",stayDate:"2026-10-05"};
const evidence={state:"ready",selection:{...context,price:{ratePlanId:context.ratePlanId,occupancy:context.occupancy,channelCode:context.channelCode,stayDate:context.stayDate}},price:{state:"known",selectedTier:{state:"known",amountMinor:9007199254740991n,currency:"INR"}}} as HostCalendarReadResult;

test("only matching explicit rate context renders exact large minor amount",()=>{
  const shown=confirmedCalendarRate(evidence,context);
  expect(shown).toContain("90,071,992,547,409.91");
  for(const changed of [{...context,sellableUnitId:"other"},{...context,ratePlanId:"other"},{...context,occupancy:3},{...context,channelCode:"OTA"},{...context,stayDate:"2026-10-06"},{...context,timezone:"Asia/Kolkata"}])expect(confirmedCalendarRate(evidence,changed)).toBeNull();
  expect(confirmedCalendarRate({state:"unknown",reason:"denied",source:"rate-price",status:403},context)).toBeNull();
  expect(confirmedCalendarRate({...evidence,price:{state:"unknown",reason:"missing-tier",source:"rate-price"}} as HostCalendarReadResult,context)).toBeNull();
});
