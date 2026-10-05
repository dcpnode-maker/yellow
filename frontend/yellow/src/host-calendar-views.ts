import { calendarDateOffset, isCalendarDate, projectCalendarPage, type CalendarPage, type CalendarSegment } from "./hosting-calendar";

export type HostCalendarView = "list" | "month" | "year";
export type HostCalendarRow = Readonly<{
  id: string; label: string; unitTypeId: string; unitTypeLabel: string;
  sellableUnitId: string | null; assigned: boolean; segments: readonly CalendarSegment[];
}>;
export type HostWeekBar = Readonly<{segment: CalendarSegment; column: number; span: number; lane: number; starts: boolean; ends: boolean}>;

export function hostMonthStart(date: string): string {
  return isCalendarDate(date) && date >= "0001-01-01" && date <= "9999-12-31" ? `${date.slice(0,7)}-01` : "";
}
export function shiftHostMonth(date: string, amount: number): string {
  const start=hostMonthStart(date);
  if (!start || !Number.isSafeInteger(amount)) return "";
  const next=new Date(`${start}T12:00:00Z`);next.setUTCMonth(next.getUTCMonth()+amount);
  if (!Number.isFinite(next.getTime())) return "";
  return hostMonthStart(next.toISOString().slice(0,10));
}
export function hostMonthDates(month: string): readonly string[] {
  const start=hostMonthStart(month), end=shiftHostMonth(month,1), dates:string[]=[];
  if (!start || !end) return dates;
  for(let date=start;date<end;date=calendarDateOffset(date,1)) dates.push(date);
  return dates;
}
export function hostMonthWeeks(month: string): readonly (readonly (string|null)[])[] {
  const dates=hostMonthDates(month);if(!dates.length)return [];
  const cells:(string|null)[]=Array(new Date(`${dates[0]}T12:00:00Z`).getUTCDay()).fill(null);cells.push(...dates);
  while(cells.length%7)cells.push(null);
  return Array.from({length:cells.length/7},(_,index)=>cells.slice(index*7,index*7+7));
}
/** Presentation defence in addition to the unchanged strict HTTP reader. */
export function assertHostPage(page: CalendarPage, propertyId: string, timezone: string, from: string, to: string): void {
  if(page.propertyId!==propertyId || page.timezone!==timezone || page.fromDate!==from || page.toDateExclusive!==to) throw new Error("Calendar context changed. Refresh this month.");
  const days=(Date.parse(`${to}T12:00:00Z`)-Date.parse(`${from}T12:00:00Z`))/86400000;
  const projection=projectCalendarPage(page,from,days,timezone);
  if(projection.invalid.length || projection.entries.length!==page.segments.length) throw new Error("This calendar is incomplete. Refresh or use the reservation list.");
}
export function hostRows(page: CalendarPage): readonly HostCalendarRow[] {
  const rows:HostCalendarRow[]=page.rooms.map(room=>({id:`unit:${room.sellableUnitId}`,label:room.sellableUnitLabel,unitTypeId:room.unitTypeId,unitTypeLabel:room.unitTypeLabel,sellableUnitId:room.sellableUnitId,assigned:true,segments:page.segments.filter(segment=>segment.sellableUnitId===room.sellableUnitId)}));
  for(const segment of page.segments.filter(segment=>segment.sellableUnitId===null)) {
    const id=`unassigned:${segment.unitTypeId}`;if(rows.some(row=>row.id===id))continue;
    rows.push({id,label:"Unassigned stays",unitTypeId:segment.unitTypeId,unitTypeLabel:segment.unitTypeLabel,sellableUnitId:null,assigned:false,segments:page.segments.filter(stay=>stay.sellableUnitId===null && stay.unitTypeId===segment.unitTypeId)});
  }
  return rows;
}
export function hostSegmentOnDate(segment: CalendarSegment,date: string): boolean {
  return date>=segment.clipFromDate && date<segment.clipToDateExclusive;
}
export function hostBarTone(segment: CalendarSegment): "completed"|"active"|"upcoming" {
  if(segment.segmentStatus==="departed" || segment.reservationStatus==="checked_out")return "completed";
  if(segment.segmentStatus==="in_house" || ["in_house","due_out"].includes(segment.reservationStatus))return "active";
  return "upcoming";
}
export function hostSegmentLabel(segment: CalendarSegment): string {
  if(segment.segmentStatus==="departed")return "Departed segment";
  return segment.reservationStatus.replaceAll("_"," ");
}
export function hostWeekBars(week: readonly (string|null)[], segments: readonly CalendarSegment[]): readonly HostWeekBar[] {
  const occupied:Set<number>[]=[],bars:HostWeekBar[]=[];
  for(const segment of [...segments].sort((a,b)=>a.clipFromDate.localeCompare(b.clipFromDate)||a.segmentId.localeCompare(b.segmentId))) {
    const columns=week.flatMap((date,index)=>date && hostSegmentOnDate(segment,date)?[index]:[]),first=columns[0],last=columns.at(-1);
    if(first===undefined || last===undefined)continue;
    let lane=occupied.findIndex(taken=>columns.every(column=>!taken.has(column)));
    if(lane<0){lane=occupied.length;occupied.push(new Set());}
    columns.forEach(column=>occupied[lane]!.add(column));
    const effectiveEnd=segment.localFromDate===segment.localToDateExclusive?calendarDateOffset(segment.localFromDate,1):segment.localToDateExclusive;
    bars.push({segment,column:first+1,span:last-first+1,lane,starts:week[first]===segment.localFromDate,ends:calendarDateOffset(week[last]!,1)===effectiveEnd});
  }
  return bars;
}
/** Every month remains its own validated page. Repeated segment IDs across
 * neighboring pages are normal; only invariant identity may be compared. */
export function hostSegmentIdentity(segment: CalendarSegment): string {
  return JSON.stringify([segment.reservationId,segment.segmentId,segment.segmentSeq,segment.stayFrom,segment.stayTo,segment.localFromDate,segment.localToDateExclusive,segment.sellableUnitId,segment.sellableUnitLabel,segment.unitTypeId,segment.unitTypeCode,segment.unitTypeLabel,segment.reservationStatus,segment.segmentStatus,segment.primaryGuestDisplayName,segment.confirmationNo]);
}
/** A mount-owned read queue. Aborted queued reads never reach transport. */
export function createHostReadQueue(limit=2) {
  if(!Number.isSafeInteger(limit)||limit<1||limit>2)throw new RangeError("Calendar read concurrency must be one or two");
  let active=0;const waiting:(()=>void)[]=[];
  const pump=()=>{while(active<limit && waiting.length)waiting.shift()!();};
  return function run<T>(read:()=>Promise<T>,signal?:AbortSignal):Promise<T> {
    return new Promise<T>((resolve,reject)=>{
      let cancelled=false;
      const abort=()=>{cancelled=true;reject(new Error("Calendar read cancelled"));};
      if(signal?.aborted){abort();return;}
      signal?.addEventListener("abort",abort,{once:true});
      waiting.push(()=>{
        if(cancelled){signal?.removeEventListener("abort",abort);return;}
        active++;
        void (async()=>{try{const value=await read();if(!cancelled)resolve(value);}catch(error){reject(error);}finally{active--;signal?.removeEventListener("abort",abort);pump();}})();
      });pump();
    });
  };
}
