import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { TodayGlassDashboard } from "../frontend/yellow/src/workspaces/TodayGlassDashboard";
import { movementHaptic, parseBusinessMix } from "../frontend/yellow/src/today-business-mix";
import { readFileSync } from "node:fs";

const P="6081b544-22a1-534f-a86d-bb1ae0519e14";
const metric={roomNights:3,roomRevenueMinor:"9007199254740993",adrMinor:"3002399751580331"};
const wire={property:{id:P,name:"Synthetic property",businessDate:"2026-10-03",currency:"INR"},provenance:"stats_daily_commercial_taxonomy",
  window:{period:"month",fromDate:"2026-10-01",toDateExclusive:"2026-10-04",recordedDays:2,expectedDays:3},total:metric,
  groups:[{marketSegmentGroup:{code:"OTA",label:"OTA"},segments:[{marketSegment:{code:"RETAIL",label:"Retail"},sources:[{source:{code:"MMT",label:"MakeMyTrip"},channelCode:{code:"WEB",label:"Web"},metric}]}]}]};
const noop=()=>{};
const appSource=readFileSync("frontend/yellow/src/App.tsx","utf8");
const formatterSource=appSource.slice(appSource.indexOf("function moneyExactMinor("),appSource.indexOf("type PmsIconName ="));
const exactMoney=Function(new Bun.Transpiler({loader:"ts"}).transformSync(formatterSource)+";return moneyExactMinor;")() as (minor:string,currency:string)=>string;
function render(open:boolean,value:typeof wire=wire) { return renderToString(createElement(TodayGlassDashboard,{greeting:"Good evening",propertyName:"Synthetic property",localTime:"17:00",
  occupancyPercent:50,roomNights:3,roomsAvailable:6,roomRevenue:"INR9",adr:"INR3",revpar:"INR1.5",performanceLoading:false,performanceUnavailable:false,
  movements:[{label:"Arrivals",value:1,loading:false,unavailable:false,glyph:"↘",onOpen:noop},{label:"Departures",value:0,loading:false,unavailable:false,glyph:"↗",onOpen:noop},{label:"In house",value:2,loading:false,unavailable:false,glyph:"⌂",onOpen:noop}],
  businessMix:parseBusinessMix(value,P,"month"),businessMixPeriod:"month",businessMixLoading:false,businessMixError:null,onBusinessMixPeriod:noop,formatMoney:exactMoney,
  activeMovementIndex:0,movementDrawerOpen:open,movementDrawer:createElement("table",{"aria-label":"Individual reservations"},createElement("tbody",null,createElement("tr",null,createElement("td",null,"Synthetic guest")))),onMovementDrawerToggle:noop,onOpenPerformance:noop})).replace(/<!--.*?-->/g, ""); }
test("guest movement and individual reservations precede stats; duplicated pulse and demo clutter are removed",()=>{
  const html=render(true);expect(html.indexOf("Guest movement")).toBeLessThan(html.indexOf("Useful operating stats"));
  expect(html.indexOf("Individual reservations")).toBeLessThan(html.indexOf("Useful operating stats"));
  expect(html).not.toContain('class="today-glass-pulse"');expect(html).not.toContain("COLLEAGUE DEMO PATH");
  expect(html).toContain('aria-expanded="true"');expect(html).toContain("Hide reservations");expect(html).toContain("MakeMyTrip");
  for(const label of ["Today","Week","Month","Quarter","Year"]) expect(html).toContain(label);
  expect(html).toContain("2/3 dates recorded");expect(html).toContain("incomplete period evidence");
});
test("closed reservation drawer is inert and hidden while keeping its table state mounted",()=>{
  const html=render(false);expect(html).toContain('aria-expanded="false"');expect(html).toContain('inert=""');expect(html).toContain('aria-hidden="true"');expect(html).toContain("Show reservations");expect(html).toContain("Synthetic guest");
});
test("source contribution retains integer money, attribution and full room-night shares",()=>{
  const mix=parseBusinessMix(wire,P,"month");expect(mix.rows[0]!.roomRevenueMinor).toBe("9007199254740993");expect(mix.rows[0]!.shareBasisPoints).toBe(10000);expect(mix.rows[0]!.source).toBe("MakeMyTrip");
});
test("actual wired table formatter preserves zero-, two-, three-decimal currencies and bigint precision",()=>{
  expect(appSource).toContain("formatMoney={moneyExactMinor}");
  for(const [currency,amount,expected] of [["JPY","10000","10,000"],["INR","501","5.01"],["BHD","1000","1.000"],["INR","9007199254740993","90,071,992,547,409.93"],["INR","-1","-₹0.01"]]){
    const m={roomNights:1,roomRevenueMinor:amount!,adrMinor:amount!};
    const source={...wire.groups[0]!.segments[0]!.sources[0]!,metric:m};
    const changed={...wire,property:{...wire.property,currency:currency!},total:m,groups:[{...wire.groups[0]!,segments:[{...wire.groups[0]!.segments[0]!,sources:[source]}]}]};
    expect(render(true,changed)).toContain(expected!);
  }
});
test("foreign property, wrong period, malformed dates, coverage and inconsistent totals fail explicitly",()=>{
  for(const bad of [{...wire,property:{...wire.property,id:"foreign"}},{...wire,window:{...wire.window,period:"year"}},
    {...wire,window:{...wire.window,toDateExclusive:"2026-10-05"}},{...wire,property:{...wire.property,businessDate:"2026-02-30"}},
    {...wire,window:{...wire.window,recordedDays:4}},{...wire,total:{...metric,roomNights:4}},{...wire,total:{...metric,roomRevenueMinor:"1"}},
    {...wire,groups:[{...wire.groups[0],segments:null}]}]) expect(()=>parseBusinessMix(bad,P,"month")).toThrow();
});
test("haptic failure cannot prevent a drawer action on unsupported devices",()=>{
  const original=Object.getOwnPropertyDescriptor(globalThis,"navigator");let calls=0;
  try { Object.defineProperty(globalThis,"navigator",{configurable:true,value:{vibrate(){calls++;throw new Error("unsupported");}}});expect(movementHaptic).not.toThrow();expect(calls).toBe(1); }
  finally { if(original)Object.defineProperty(globalThis,"navigator",original);else Reflect.deleteProperty(globalThis,"navigator"); }
});
