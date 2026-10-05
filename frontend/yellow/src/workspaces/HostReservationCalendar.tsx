import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { selectCalendarRange, type CalendarPage, type CalendarRange, type CalendarSegment } from "../hosting-calendar";
import { assertHostPage, createHostReadQueue, hostBarTone, hostMonthDates, hostMonthStart, hostMonthWeeks, hostRows, hostSegmentLabel, hostSegmentOnDate, hostWeekBars, shiftHostMonth, type HostCalendarRow, type HostCalendarView } from "../host-calendar-views";
import "./host-reservation-calendar.css";

type Loader=(from:string,to:string,signal:AbortSignal)=>Promise<CalendarPage>;
type Props=Readonly<{propertyId:string;propertyLabel:string;timezone:string;today:string;contextKey:string;loadCalendar:Loader;onOpenReservation:(id:string)=>void}>;
type Reader=ReturnType<typeof createHostReadQueue>;
type Identity=Pick<HostCalendarRow,"id"|"label"|"unitTypeId"|"unitTypeLabel"|"sellableUnitId"|"assigned">;
type IconName=HostCalendarView|"back"|"next"|"today"|"close"|"room"|"settings";
function Icon({name}:{name:IconName}) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name==="list"?[3,10,17].map(y=><rect key={y} x="4" y={y} width="16" height="4" rx=".6"/>):null}
    {name==="month"?[3,13].flatMap(x=>[3,13].map(y=><rect key={`${x}:${y}`} x={x} y={y} width="8" height="8" rx="1"/>)):null}
    {name==="year"?[3,10,17].flatMap(x=>[3,10,17].map(y=><rect key={`${x}:${y}`} x={x} y={y} width="4" height="4" rx=".5"/>)):null}
    {name==="back"?<path d="m14 5-7 7 7 7M7 12h14"/>:null}{name==="next"?<path d="m10 5 7 7-7 7M17 12H3"/>:null}
    {name==="today"?<path d="M12 20V4m-7 7 7-7 7 7"/>:null}{name==="close"?<path d="m6 6 12 12M6 18 18 6"/>:null}
    {name==="room"?<><path d="M5 21V3h14v18M3 21h18M9 7h6M9 11h6M10 21v-6h4v6"/></>:null}
    {name==="settings"?<><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="2"/></>:null}
  </svg>;
}
function formatted(date:string,options:Intl.DateTimeFormatOptions):string {
  return new Intl.DateTimeFormat("en-GB",{...options,timeZone:"UTC"}).format(new Date(`${date}T12:00:00Z`));
}
function monthLabel(date:string){return formatted(date,{month:"long",year:"numeric"});}
function dayLabel(date:string){return formatted(date,{weekday:"long",day:"numeric",month:"long",year:"numeric"});}
function initials(name:string){return name.trim().split(/\s+/u).slice(0,2).map(part=>Array.from(part)[0]).join("");}
function selected(date:string,range:CalendarRange|null){return Boolean(range && date>=range.from && date<=(range.to||range.from));}
function useMonth(props:Props,month:string,reader:Reader,enabled=true) {
  const end=shiftHostMonth(month,1);
  return useQuery({queryKey:["host-calendar57",props.contextKey,props.propertyId,props.timezone,month,end],queryFn:({signal})=>reader(async()=>{
    const page=await props.loadCalendar(month,end,signal);assertHostPage(page,props.propertyId,props.timezone,month,end);return page;
  },signal),enabled:enabled && Boolean(month&&end),retry:false,staleTime:10_000,gcTime:0});
}
function MiniMonth({month,today,segments=[],known=false}:{month:string;today:string;segments?:readonly CalendarSegment[];known?:boolean}) {
  return <span className={`host-mini-month${known?"":" is-unloaded"}`} aria-hidden="true">{hostMonthWeeks(month).flat().map((date,index)=><span key={date??`blank-${index}`} className={!date?"is-empty":date===today?"is-today":known&&segments.some(stay=>hostSegmentOnDate(stay,date))?"has-stay":""}/>)}</span>;
}
export function HostCalendarMonth({month,today,segments,range,onSelectDate,onSelectSegment}:Readonly<{
  month:string;today:string;segments:readonly CalendarSegment[];range:CalendarRange|null;onSelectDate:(date:string)=>void;onSelectSegment:(segment:CalendarSegment)=>void;
}>) {
  return <div className="host-month-grid" aria-label={monthLabel(month)}>{hostMonthWeeks(month).map((week,index)=>{
    const bars=hostWeekBars(week,segments),lanes=Math.max(1,...bars.map(bar=>bar.lane+1));
    return <div className="host-calendar-week" key={index} style={{"--calendar-lanes":lanes} as CSSProperties}>
      {week.map((date,column)=>date?<button type="button" key={date} className={`host-calendar-day${date<today?" is-past":""}${date===today?" is-today":""}${selected(date,range)?" is-selected":""}`} style={{gridColumn:column+1}} data-calendar-date={date} aria-label={dayLabel(date)} aria-pressed={selected(date,range)} aria-current={date===today?"date":undefined} onClick={()=>onSelectDate(date)}><span className="host-day-number">{Number(date.slice(-2))}</span></button>:<span key={`blank-${column}`} className="host-calendar-blank" style={{gridColumn:column+1}}/>)}
      {bars.map(bar=><button type="button" key={bar.segment.segmentId} className={`host-booking-bar tone-${hostBarTone(bar.segment)}${bar.starts?" starts":""}${bar.ends?" ends":""}`} style={{gridColumn:`${bar.column} / span ${bar.span}`,gridRow:1,alignSelf:"start",marginTop:42+bar.lane*33}} onClick={()=>onSelectSegment(bar.segment)} aria-label={`Review reservation: ${bar.segment.primaryGuestDisplayName}, ${bar.segment.confirmationNo}, ${hostSegmentLabel(bar.segment)}, ${bar.segment.localFromDate} to ${bar.segment.localToDateExclusive}`}>
        <span className="host-guest-avatar" aria-hidden="true">{initials(bar.segment.primaryGuestDisplayName)}</span><span className="host-guest-name">{bar.segment.primaryGuestDisplayName}</span>
      </button>)}
    </div>;
  })}</div>;
}
function MonthPanel({props,month,row,today,range,view,reader,onSelect,onSegment,todayJump,navigation}:Readonly<{
  props:Props;month:string;row:Identity;today:string;range:CalendarRange|null;view:"list"|"month";reader:Reader;onSelect:(date:string)=>void;onSegment:(segment:CalendarSegment)=>void;todayJump:number;navigation?:ReactNode;
}>) {
  const query=useMonth(props,month,reader),page=query.isSuccess&&!query.isFetching?query.data:undefined;
  const actual=page?hostRows(page).find(item=>item.id===row.id && item.unitTypeId===row.unitTypeId):undefined;
  const element=useRef<HTMLElement>(null);
  useEffect(()=>{if(todayJump && page && month===hostMonthStart(today))element.current?.querySelector(`[data-calendar-date="${today}"]`)?.scrollIntoView({block:"center",behavior:"auto"});},[todayJump,Boolean(page),month,today,view]);
  return <section ref={element} className="host-calendar-month" aria-label={monthLabel(month)} aria-busy={query.isFetching}>
    {navigation??<h3>{monthLabel(month)}</h3>}
    {query.isPending||query.isFetching?<p className="host-calendar-notice" role="status">Loading {monthLabel(month)}…</p>:null}
    {query.isError?<div className="host-calendar-notice" role="alert">This month is unavailable or incomplete. <button type="button" onClick={()=>void query.refetch()}>Retry month</button></div>:null}
    {page?(!actual?<p className="host-calendar-notice" role="status">{row.assigned?"This unit was not returned for this month.":"No unassigned stays were returned for this type."} Availability is unknown.</p>:null):null}
    {page?view==="month"?<HostCalendarMonth month={month} today={today} segments={actual?.segments??[]} range={range} onSelectDate={onSelect} onSelectSegment={onSegment}/>:<div className="host-calendar-list">{hostMonthDates(month).map(date=>{
      const stays=actual?.segments.filter(stay=>hostSegmentOnDate(stay,date))??[];
      return <div className={`host-calendar-list-day${date===today?" is-today":""}${selected(date,range)?" is-selected":""}`} key={date} data-calendar-date={date}>
        <button type="button" className="host-list-date" onClick={()=>onSelect(date)} aria-label={`Details for ${dayLabel(date)}`}><strong>{Number(date.slice(-2))}</strong><span>{formatted(date,{weekday:"short"})}</span></button>
        <div className="host-list-stays">{stays.length?stays.map(stay=><button type="button" className={`host-list-stay tone-${hostBarTone(stay)}`} key={stay.segmentId} onClick={()=>onSegment(stay)}><strong>{stay.primaryGuestDisplayName}</strong><small>{hostSegmentLabel(stay)} · {stay.confirmationNo}</small></button>):<><span>No recorded stay</span><small>Availability unknown</small></>}</div><span className="host-list-price" aria-label="Nightly price unknown">—</span>
      </div>;
    })}</div>:null}
  </section>;
}
function YearMonth({props,month,row,today,reader,onOpen}:Readonly<{props:Props;month:string;row:Identity;today:string;reader:Reader;onOpen:()=>void}>) {
  const element=useRef<HTMLButtonElement>(null),[visible,setVisible]=useState(false);
  useEffect(()=>{if(!element.current || typeof IntersectionObserver==="undefined")return;
    const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:"120px"});observer.observe(element.current);return()=>observer.disconnect();
  },[]);
  const query=useMonth(props,month,reader,visible),page=query.isSuccess&&!query.isFetching?query.data:undefined;
  const actual=page?hostRows(page).find(item=>item.id===row.id&&item.unitTypeId===row.unitTypeId):undefined;
  const state=query.isError?"Unavailable":query.isFetching?"Loading":!page?"Not loaded":!actual?"No unit returned":"Recorded stays";
  return <button type="button" className="host-year-month" ref={element} onClick={onOpen} aria-label={`Open ${monthLabel(month)}. ${state}`}><span>{formatted(month,{month:"short"})}</span><MiniMonth month={month} today={today} segments={actual?.segments} known={Boolean(page)}/><small>{state}</small></button>;
}
function DateSheet({props,row,range,active,kind,reader,onClose,onChooseEnd,onClear,onSettings,returnFocus}:Readonly<{
  props:Props;row:Identity;range:CalendarRange|null;active:CalendarSegment|null;kind:"date"|"settings";reader:Reader;onClose:()=>void;onChooseEnd:()=>void;onClear:()=>void;onSettings:()=>void;returnFocus?:HTMLElement|null;
}>) {
  const date=range?.from??active?.clipFromDate??props.today,month=hostMonthStart(date),query=useMonth(props,month,reader,kind==="date"),sheet=useRef<HTMLElement>(null);
  const page=query.isSuccess&&!query.isFetching?query.data:undefined,actual=page?hostRows(page).find(item=>item.id===row.id&&item.unitTypeId===row.unitTypeId):undefined;
  const related=(actual?.segments??[]).filter(stay=>active?stay.segmentId===active.segmentId:hostSegmentOnDate(stay,date));
  useEffect(()=>{
    const previous=returnFocus??(document.activeElement instanceof HTMLElement?document.activeElement:null);
    const background:{element:HTMLElement;inert:boolean}[]=[];
    let branch:HTMLElement|null=sheet.current;
    while(branch?.parentElement) {
      const parent:HTMLElement=branch.parentElement;
      for(const sibling of Array.from(parent.children))if(sibling!==branch && sibling instanceof HTMLElement && !sibling.matches(".host-sheet-backdrop,.host-calendar-surface,.auth-session-control,.auth-screen")) {background.push({element:sibling,inert:sibling.inert});sibling.inert=true;}
      if(parent===document.body)break;
      branch=parent;
    }
    sheet.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return()=>{for(const item of background)item.element.inert=item.inert;if(previous?.isConnected)previous.focus({preventScroll:true});};
  },[]);
  const title=kind==="settings"?"Calendar settings":range?.to?`${formatted(range.from,{day:"numeric",month:"short"})} – ${formatted(range.to,{day:"numeric",month:"short"})}`:formatted(date,{day:"numeric",month:"long"});
  return <><div className="host-sheet-backdrop" onClick={onClose} aria-hidden="true"/><aside className="host-calendar-selection" ref={sheet} role="dialog" aria-modal="true" aria-label={kind==="settings"?"Calendar settings":"Selected calendar dates"} onKeyDown={event=>{
    if(event.key==="Escape"){event.preventDefault();event.stopPropagation();onClose();return;}
    if(event.key==="Tab") {const items=Array.from(sheet.current?.querySelectorAll<HTMLElement>('button:not(:disabled),summary,input:not(:disabled),[tabindex="0"]')??[]).filter(item=>item.getClientRects().length),first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
  }}>
    <header><div><small>{row.label} · {row.unitTypeLabel}</small><h3>{title}</h3></div><button type="button" className="host-calendar-icon" aria-label={kind==="settings"?"Close calendar settings":"Close date details"} onClick={onClose}><Icon name="close"/></button></header>
    {kind==="settings"?<div className="host-settings-stack"><details><summary>Minimum nights</summary><p>Minimum stays are not provided in this calendar. Review them in property rate settings.</p></details><details><summary>Cancellation policy</summary><p>Cancellation terms are not provided in this calendar. Review the approved policy in property rate settings.</p></details><button type="button" className="host-sheet-done" onClick={onClose}>Done</button></div>:<>
      <div className="host-selection-chip"><span>{range?.to?"Selected range":"Selected date"}</span>{range&&!range.to?<button type="button" onClick={onChooseEnd}>Choose end date</button>:null}<button type="button" onClick={onClear}>Clear selection</button></div>
      {query.isPending||query.isFetching?<p role="status">Loading date details…</p>:null}{query.isError?<p role="alert">Date details are unavailable. Close and refresh this month.</p>:null}
      {page?<div className="host-selection-stays">{related.length?related.map(stay=><div className="host-selected-stay" key={stay.segmentId}><span className="host-guest-avatar" aria-hidden="true">{initials(stay.primaryGuestDisplayName)}</span><span><strong>{stay.primaryGuestDisplayName}</strong><small>{stay.confirmationNo} · {hostSegmentLabel(stay)}</small></span><button type="button" className="host-open-reservation" onClick={()=>props.onOpenReservation(stay.reservationId)}>Open reservation</button></div>):<p>No recorded stay {range?.to?"at the start of this range":"on this date"}. Check the reservation workflow before booking.</p>}</div>:null}
      <div className="host-date-facts"><div><h4>Availability</h4><p>Not confirmed for these dates.</p><details><summary>Date notes</summary><p>Saved date notes are not provided in this calendar.</p></details></div><div><h4>Nightly price <span>—</span></h4><p>Prices are not provided in this calendar.</p></div><button type="button" onClick={onSettings}>Custom settings <span aria-hidden="true">＋</span></button></div>
    </>}
  </aside></>;
}
export function HostReservationCalendar(props:Props) {
  const [month,setMonth]=useState(()=>hostMonthStart(props.today)),[view,setView]=useState<HostCalendarView>("month"),[row,setRow]=useState<Identity|null>(null),[search,setSearch]=useState("");
  const [range,setRange]=useState<CalendarRange|null>(null),[active,setActive]=useState<CalendarSegment|null>(null),[sheet,setSheet]=useState<"date"|"settings"|null>(null),[todayJump,setTodayJump]=useState(0);
  const reader=useMemo(()=>createHostReadQueue(2),[]),query=useMonth(props,month,reader),page=query.isSuccess&&!query.isFetching?query.data:undefined;
  const rows=page?hostRows(page):[],visible=rows.filter(item=>`${item.label} ${item.unitTypeLabel}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const menu=useRef<HTMLDetailsElement>(null),heading=useRef<HTMLElement>(null),origin=useRef<HTMLElement|null>(null);
  useEffect(()=>{const close=(event:PointerEvent)=>{if(menu.current?.open && event.target instanceof Node&&!menu.current.contains(event.target))menu.current.open=false;};document.addEventListener("pointerdown",close);return()=>document.removeEventListener("pointerdown",close);},[]);
  const goMonth=(date:string)=>{if(!hostMonthStart(date)||!shiftHostMonth(date,1))return;setMonth(hostMonthStart(date));setSheet(null);setRange(null);setActive(null);};
  const rememberFocus=()=>{origin.current=document.activeElement instanceof HTMLElement?document.activeElement:heading.current;};
  const pickDate=(date:string)=>{rememberFocus();setRange(current=>selectCalendarRange(current,date));setActive(null);setSheet("date");};
  const pickSegment=(stay:CalendarSegment)=>{rememberFocus();setRange(null);setActive(stay);setSheet("date");};
  const clear=()=>{setSheet(null);setRange(null);setActive(null);};
  const groups=Array.from(new Set(visible.filter(item=>item.assigned).map(item=>item.unitTypeId)));
  const months=[month,shiftHostMonth(month,1),shiftHostMonth(month,2)].filter(date=>date&&shiftHostMonth(date,1));
  const yearMonths=Array.from({length:12},(_,index)=>shiftHostMonth(month,index)).filter(date=>date&&shiftHostMonth(date,1)),years=Array.from(new Set(yearMonths.map(date=>date.slice(0,4))));
  const card=(item:HostCalendarRow)=><button type="button" className="host-calendar-room-card" key={item.id} data-host-row={item.id} onClick={()=>{setRow(item);clear();heading.current?.scrollIntoView({block:"start",behavior:"auto"});}} aria-label={`Open ${item.label}, ${item.unitTypeLabel}${item.assigned?", unit calendar":", assignment pending"}`}><span className="host-room-tile"><Icon name="room"/><small>{item.assigned?"Unit":"Unassigned"}</small></span><span className="host-room-description"><strong>{item.label}</strong><span>{item.unitTypeLabel}</span><small>{item.assigned?"Recorded stays":"Assignment pending"}</small></span><MiniMonth month={month} today={props.today} segments={item.segments} known/></button>;
  const navigation=<div className="host-calendar-navigation" aria-label="Calendar dates"><button type="button" className="host-calendar-icon" aria-label={view==="year"?"Previous year":"Previous month"} disabled={!shiftHostMonth(month,view==="year"?-12:-1)} onClick={()=>goMonth(shiftHostMonth(month,view==="year"?-12:-1))}><Icon name="back"/></button><details className="host-month-jump"><summary aria-label="Choose calendar month"><h3>{monthLabel(month)}</h3></summary><label><span className="host-calendar-sr">Jump to month</span><input type="month" aria-label="Jump to month" min="0001-01" max="9999-11" value={month.slice(0,7)} onChange={event=>{goMonth(`${event.target.value}-01`);event.currentTarget.closest("details")?.removeAttribute("open");}}/></label></details><button type="button" className="host-calendar-icon" aria-label={view==="year"?"Next year":"Next month"} disabled={!shiftHostMonth(month,view==="year"?13:2)} onClick={()=>goMonth(shiftHostMonth(month,view==="year"?12:1))}><Icon name="next"/></button></div>;
  return <section className="host-calendar" aria-label="Reservation calendars"><div className="host-calendar-surface" inert={Boolean(sheet)}>
    <header className="host-calendar-heading" ref={heading}>{row?<button type="button" className="host-calendar-icon" aria-label="Back to calendars" onClick={()=>{setRow(null);clear();}}><Icon name="back"/></button>:null}<div className="host-calendar-title"><h2>{row?.label??"Calendars"}</h2><span title={props.propertyLabel}>{row?`${props.propertyLabel} · ${row.unitTypeLabel}${row.assigned?"":" · Assignment pending"}`:props.propertyLabel}</span></div>
      {row?<><details className="host-view-menu" ref={menu} onKeyDown={event=>{
        if(event.key==="Escape"){event.preventDefault();event.currentTarget.open=false;event.currentTarget.querySelector("summary")?.focus();}
        if(event.key==="ArrowDown"||event.key==="ArrowUp"){event.preventDefault();event.currentTarget.open=true;const buttons=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button")),index=buttons.indexOf(document.activeElement as HTMLButtonElement),next=index<0?(event.key==="ArrowDown"?0:buttons.length-1):(index+(event.key==="ArrowDown"?1:-1)+buttons.length)%buttons.length;buttons[next]?.focus();}
      }}><summary className="host-calendar-icon" aria-label={`Calendar view: ${view}. Change view`}><Icon name={view}/></summary><div className="host-view-options" aria-label="Calendar style">{(["list","month","year"] as const).map(option=><button type="button" key={option} aria-pressed={option===view} onClick={()=>{setView(option);setSheet(null);setActive(null);if(menu.current){menu.current.open=false;menu.current.querySelector("summary")?.focus();}}}><span>{option[0]!.toUpperCase()+option.slice(1)}</span><Icon name={option}/></button>)}</div></details><button type="button" className="host-calendar-icon" aria-label="Calendar settings" onClick={()=>{rememberFocus();setSheet("settings");}}><Icon name="settings"/></button></>:null}
    </header>
    {!row?<><label className="host-calendar-search"><span className="host-calendar-sr">Search units and room types</span><input type="search" placeholder="Search units and room types" value={search} onChange={event=>setSearch(event.target.value)}/></label>
      {query.isPending||query.isFetching?<p role="status">Loading calendars…</p>:null}{query.isError?<div role="alert" className="host-calendar-notice">Calendars are unavailable or incomplete. <button type="button" onClick={()=>void query.refetch()}>Retry calendars</button></div>:null}
      {page?<>{groups.map(type=>{const units=visible.filter(item=>item.assigned&&item.unitTypeId===type);return <details open className="host-type-group" key={type}><summary>{units[0]!.unitTypeLabel}<span>{units.length} unit{units.length===1?"":"s"}</span></summary><div className="host-calendar-picker">{units.map(card)}</div></details>;})}{visible.some(item=>!item.assigned)?<section className="host-unassigned-group" aria-label="Unassigned stays"><h3>Unassigned stays</h3><p>These stays have a room type and still need a unit assignment.</p><div className="host-calendar-picker">{visible.filter(item=>!item.assigned).map(card)}</div></section>:null}{!visible.length?<p role="status">{rows.length?"No calendars match your search.":"No units or recorded stays were returned."}</p>:null}</>:null}
    </>:<>
      {view==="year"?<>{navigation}<div className="host-calendar-year" aria-label="Year overview">{years.map(year=><section className="host-calendar-year-group" key={year} aria-label={year}><h3>{year}</h3><div className="host-year-grid">{yearMonths.filter(date=>date.startsWith(year)).map(date=><YearMonth key={date} props={props} month={date} row={row} today={props.today} reader={reader} onOpen={()=>{goMonth(date);setView("month");}}/>)}</div></section>)}</div></>:<>{view==="month"?<div className="host-calendar-weekdays" aria-hidden="true">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(day=><span key={day}>{day}</span>)}</div>:null}{months.map((date,index)=><MonthPanel key={`${row.id}:${date}`} props={props} month={date} row={row} today={props.today} range={range} reader={reader} view={view} onSelect={pickDate} onSegment={pickSegment} todayJump={todayJump} navigation={index===0?navigation:undefined}/>)}</>}
      <button type="button" className="host-calendar-today" onClick={()=>{goMonth(hostMonthStart(props.today));setTodayJump(value=>value+1);if(view==="year")heading.current?.scrollIntoView({block:"start",behavior:"auto"});}}><Icon name="today"/>Today</button>
    </>}
    <p className="host-calendar-legend">Times follow {props.timezone}. Dots and bars show recorded stays. Blank dates do not confirm availability.</p>
    </div>{sheet&&row?<DateSheet props={props} row={row} range={range} active={active} kind={sheet} reader={reader} returnFocus={origin.current} onClose={clear} onChooseEnd={()=>setSheet(null)} onClear={clear} onSettings={()=>setSheet("settings")}/>:null}
  </section>;
}
