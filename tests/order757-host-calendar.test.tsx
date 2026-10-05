import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { assertHostPage, createHostReadQueue, hostBarTone, hostMonthDates, hostMonthWeeks, hostRows, hostWeekBars, shiftHostMonth } from "../frontend/yellow/src/host-calendar-views";
import { HostCalendarMonth, HostReservationCalendar } from "../frontend/yellow/src/workspaces/HostReservationCalendar";
import { selectCalendarRange, type CalendarPage, type CalendarSegment } from "../frontend/yellow/src/hosting-calendar";

const P="00000000-0000-4000-8000-000000000001", U="00000000-0000-4000-8000-000000000002", T="00000000-0000-4000-8000-000000000003";
function segment(extra: Partial<CalendarSegment> = {}): CalendarSegment {
  return { reservationId:"00000000-0000-4000-8000-000000000004",segmentId:"00000000-0000-4000-8000-000000000005",confirmationNo:"SYN-1",primaryGuestDisplayName:"Synthetic Guest",reservationStatus:"in_house",segmentStatus:"in_house",segmentSeq:1,
    stayFrom:"2026-10-01T15:00:00Z",stayTo:"2026-10-06T11:00:00Z",localFromDate:"2026-10-01",localToDateExclusive:"2026-10-06",clipFromDate:"2026-10-01",clipToDateExclusive:"2026-10-06",continuesBefore:false,continuesAfter:false,
    sellableUnitId:U,sellableUnitLabel:"Unit 101",unitTypeId:T,unitTypeCode:"ROOM",unitTypeLabel:"Room",roomCondition:null,outOfService:null,...extra };
}
function page(extra: Partial<CalendarPage> = {}): CalendarPage {
  return {propertyId:P,timezone:"UTC",fromDate:"2026-10-01",toDateExclusive:"2026-11-01",limit:1000,limited:false,roomLimit:500,roomsLimited:false,
    rooms:[{sellableUnitId:U,sellableUnitLabel:"Unit 101",unitTypeId:T,unitTypeCode:"ROOM",unitTypeLabel:"Room",roomCondition:null,outOfService:null}],segments:[segment()],...extra};
}
test("host month arithmetic is Sunday first, padded and bounded across leap/year edges",()=>{
  expect(hostMonthWeeks("2026-10-01")[0]).toEqual([null,null,null,null,"2026-10-01","2026-10-02","2026-10-03"]);
  expect(hostMonthDates("2028-02-01")).toHaveLength(29);
  expect(hostMonthDates("2026-02-01")).toHaveLength(28);
  expect(shiftHostMonth("2026-12-01",1)).toBe("2027-01-01");
  expect(shiftHostMonth("0001-01-01",-1)).toBe("");
  expect(shiftHostMonth("9999-12-01",1)).toBe("");
  expect(hostMonthWeeks("0001-01-01").flat().filter(Boolean)[0]).toBe("0001-01-01");
  expect(hostMonthDates("2026-02-29")).toEqual([]);
});
test("week spans use exclusive checkout and independent overlap lanes",()=>{
  const weeks=hostMonthWeeks("2026-10-01"), stay=segment();
  expect(hostWeekBars(weeks[0]!,[stay])[0]).toMatchObject({column:5,span:3,starts:true,ends:false,lane:0});
  expect(hostWeekBars(weeks[1]!,[stay])[0]).toMatchObject({column:1,span:2,starts:false,ends:true,lane:0});
  const second=segment({segmentId:"00000000-0000-4000-8000-000000000006"});
  expect(hostWeekBars(weeks[0]!,[stay,second]).map(bar=>bar.lane)).toEqual([0,1]);
  expect(hostWeekBars(weeks[1]!,[segment({clipFromDate:"2026-10-06",clipToDateExclusive:"2026-10-07",localFromDate:"2026-10-06",localToDateExclusive:"2026-10-06"})])[0]).toMatchObject({column:3,span:1});
});
test("departed moved segment wins parent in-house and dates cannot complete occupied stays",()=>{
  expect(hostBarTone(segment({segmentStatus:"departed"}))).toBe("completed");
  expect(hostBarTone(segment())).toBe("active");
  expect(hostBarTone(segment({reservationStatus:"reserved",segmentStatus:"booked"}))).toBe("upcoming");
});
test("real hotel children and unassigned-by-type rows retain separate identities",()=>{
  const U2="00000000-0000-4000-8000-000000000007";
  const data=page({rooms:[...page().rooms,{...page().rooms[0]!,sellableUnitId:U2,sellableUnitLabel:"Unit 102"}],segments:[segment(),segment({sellableUnitId:U2,sellableUnitLabel:"Unit 102",segmentId:"00000000-0000-4000-8000-000000000008"}),segment({sellableUnitId:null,sellableUnitLabel:null,segmentId:"00000000-0000-4000-8000-000000000009"})]});
  const rows=hostRows(data);expect(rows.map(row=>row.id)).toEqual([`unit:${U}`,`unit:${U2}`,`unassigned:${T}`]);
  expect(rows.map(row=>row.segments.length)).toEqual([1,1,1]);expect(rows[2]!.assigned).toBe(false);
});
test("host defensive seam rejects limited, duplicate, wrong property/timezone/range and malformed evidence",()=>{
  expect(()=>assertHostPage(page(),P,"UTC","2026-10-01","2026-11-01")).not.toThrow();
  for(const value of [page({limited:true}),page({roomsLimited:true}),page({rooms:[...page().rooms,...page().rooms]}),page({segments:[segment(),segment()]}),page({propertyId:U}),page({timezone:"Asia/Calcutta"}),page({toDateExclusive:"2026-10-31"}),page({segments:[segment({stayFrom:"bad"})]})]){
    expect(()=>assertHostPage(value,P,"UTC","2026-10-01","2026-11-01")).toThrow();
  }
});
test("native local dates crossing DST remain civil-day spans",()=>{
  const data=page({timezone:"America/New_York",fromDate:"2026-03-01",toDateExclusive:"2026-04-01",segments:[segment({stayFrom:"2026-03-07T20:00:00Z",stayTo:"2026-03-10T15:00:00Z",localFromDate:"2026-03-07",localToDateExclusive:"2026-03-10",clipFromDate:"2026-03-07",clipToDateExclusive:"2026-03-10"})]});
  expect(()=>assertHostPage(data,P,"America/New_York","2026-03-01","2026-04-01")).not.toThrow();
  expect(hostRows(data)[0]!.segments).toHaveLength(1);
  const bars=hostMonthWeeks("2026-03-01").flatMap(week=>hostWeekBars(week,data.segments));expect(bars.map(bar=>bar.span)).toEqual([1,2]);
});
test("month renderer escapes real labels and exposes local range without invented pricing/media",()=>{
  const html=renderToString(createElement(HostCalendarMonth,{month:"2026-10-01",today:"2026-10-04",segments:[segment({primaryGuestDisplayName:"A <script> guest"})],range:{from:"2026-10-04",to:"2026-10-07"},onSelectDate(){},onSelectSegment(){}}));
  expect(html).toContain("A &lt;script&gt; guest");expect(html).not.toContain("<script>");expect(html).toContain('aria-pressed="true"');expect(html).toContain("2026-10-07");
  expect(html).not.toContain("<img");expect(html).not.toContain("Smart Pricing");expect(html).not.toContain("Blocked by you");expect(html).not.toContain("SR");
  expect(selectCalendarRange({from:"2026-10-08",to:""},"2026-10-04")).toEqual({from:"2026-10-04",to:"2026-10-08"});
});
test("host entry shows loading truth without a promise of availability",()=>{
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  try {const html=renderToString(createElement(QueryClientProvider,{client},createElement(HostReservationCalendar,{propertyId:P,propertyLabel:"Synthetic property",timezone:"UTC",today:"2026-10-04",contextKey:"synthetic",loadCalendar:async()=>page(),onOpenReservation(){}})));
    expect(html).toContain("Loading calendars");expect(html).not.toContain("Available");expect(html).not.toContain("Listed");
  }finally{client.clear();}
});
test("read queue caps concurrency at two and aborts queued work before transport",async()=>{
  const queue=createHostReadQueue(2), releases:(()=>void)[]=[], started:number[]=[];let active=0,max=0;
  const run=(n:number,signal?:AbortSignal)=>queue(async()=>{started.push(n);active++;max=Math.max(max,active);await new Promise<void>(resolve=>releases.push(resolve));active--;return n;},signal);
  const a=run(1),b=run(2),controller=new AbortController(),c=run(3,controller.signal);controller.abort();
  await expect(c).rejects.toThrow();expect(started).toEqual([1,2]);expect(max).toBe(2);releases.splice(0).forEach(resolve=>resolve());expect(await Promise.all([a,b])).toEqual([1,2]);
  expect(await queue(async()=>4)).toBe(4);
});
