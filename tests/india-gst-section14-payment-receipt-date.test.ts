import { describe, expect, test } from "bun:test";
import {
  deriveIndiaGstAccommodationRateChangeDate,
  deriveIndiaGstSection14PaymentReceiptDate,
  deriveIndiaGstSection14WorkingDayCalendarEvidence,
  resolveIndiaGstSection14PaymentProviso,
} from "../src/contexts/tax-fiscal";

type Mutable = Record<PropertyKey, any>;
const id=(n:number)=>`00000000-0000-0000-0000-${String(n).padStart(12,"0")}`;
const TENANT=id(33901),OTHER=id(33902),PROPERTY=id(33903);
const PREDECESSOR="a806f516-fed6-5768-b310-94aa03286adb",SUCCESSOR="0b21daf2-ea6e-5568-9c21-69e4d4424574";
const PRE_FROM="2022-07-17T18:30:00.000000Z",CUTOVER="2025-09-21T18:30:00.000000Z",CHANGE="2025-09-22";
const SOURCE20="ee920c82c30ed88d9bb515d7d79b975cc2ed599c6dad411d04d8b7fcd5a86901";
const SOURCE04="c6d264f1906375e93466dd97b2c60bb9b21c0dec34b93900b15237b4a98b7716";
const SOURCE15="46c9447579017d8bf1fefd75b6e6a48856dab7b23e44c7e06babfdc99ae9d289";
const CAL_SOURCE="d".repeat(64),AUTHORITY="INDIA_GST_GOVERNED_WORKING_DAY_CALENDAR";

function stable(value:any):string{if(value===null||typeof value!=="object")return JSON.stringify(value);if(Array.isArray(value))return`[${value.map(stable).join(",")}]`;return`{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${stable(value[k])}`).join(",")}}`;}
const hash=(value:unknown)=>new Bun.CryptoHasher("sha256").update(stable(value)).digest("hex");
const content=(lower:number,itc:boolean)=>({country:"IN",price_display:"tax_exclusive",rounding:"document",taxes:[{code:"GST_ROOM",name:"GST on accommodation",mode:"slab_percent",slab_basis:"transaction_value",applies_to:["room_revenue"],slabs:[{upto_minor:750000,rate:lower,itc_eligible:itc},{upto_minor:null,rate:0.18,itc_eligible:true}]},{code:"GST_FNB",name:"GST on F&B (restaurant in hotel)",mode:"percent",rate:0.05,applies_to:["fnb_revenue"]}]});
function version(extensionId:string,version:number,status:string,lower:number,itc:boolean,from:string,to:string|null){const body=content(lower,itc);return{extensionId,key:"in-gst-lodging",version,status,effectiveFromInstant:from,effectiveToInstant:to,content:body,contentHash:hash(body),gstRoomSlabs:[{uptoMinor:750000,rate:lower,itcEligible:itc},{uptoMinor:null,rate:0.18,itcEligible:true}]};}
function pair(tenant=TENANT){const predecessor=version(PREDECESSOR,1,"retired",0.12,true,PRE_FROM,CUTOVER),successor=version(SUCCESSOR,2,"active",0.05,false,CUTOVER,null);const body={propertyNode:PROPERTY,predecessor,successor,cutoverInstant:CUTOVER,statutoryLowerBandDelta:{thresholdMinor:750000,predecessorRate:0.12,predecessorItcEligible:true,successorRate:0.05,successorItcEligible:false,predecessorHasNilBand:false,successorHasNilBand:false},sourceHashes:{notification20_2019:SOURCE20,notification04_2022:SOURCE04,notification15_2025:SOURCE15}};return{...body,evidenceHash:hash({tenantId:tenant,predecessorOwnerTenantId:null,successorOwnerTenantId:null,...body})};}
function freeze<T>(value:T,seen=new Set<object>()):T{if(typeof value!=="object"||value===null||seen.has(value))return value;seen.add(value);for(const key of Reflect.ownKeys(value))freeze((value as Mutable)[key],seen);return Object.freeze(value);}
function deepFrozen(value:unknown,seen=new Set<object>()):void{if(typeof value!=="object"||value===null||seen.has(value))return;seen.add(value);expect(Object.isFrozen(value)).toBeTrue();for(const key of Reflect.ownKeys(value))deepFrozen((value as Mutable)[key],seen);}

const calendarDays=freeze([
  {date:"2025-09-23",state:"working"},{date:"2025-09-24",state:"non_working"},
  {date:"2025-09-25",state:"working"},{date:"2025-09-26",state:"non_working"},
  {date:"2025-09-27",state:"working"},{date:"2025-09-28",state:"non_working"},
  {date:"2025-09-29",state:"working"},{date:"2025-09-30",state:"working"},
]);
function build(bank="2025-09-30",books="2025-09-23",tenant=TENANT){
  const rateVersionPair=pair(tenant);
  const rateChangeDateEvidence=deriveIndiaGstAccommodationRateChangeDate({tenantId:tenant,rateVersionPair} as never);
  const paymentProvisoEvidence=resolveIndiaGstSection14PaymentProviso({supplierBooksEntryDate:books,supplierBankCreditDate:bank,rateChangeDate:CHANGE});
  const calendarEvidence=freeze({jurisdiction:"IN",authorityId:AUTHORITY,sourceDigestSha256:CAL_SOURCE,days:calendarDays});
  const workingDayEvidence=deriveIndiaGstSection14WorkingDayCalendarEvidence({tenantId:tenant,rateChangeDate:CHANGE,throughDate:"2025-09-30",calendarEvidence} as never);
  return{tenantId:tenant,rateVersionPair,rateChangeDateEvidence,supplierBooksEntryDate:books,supplierBankCreditDate:bank,paymentProvisoEvidence,throughDate:"2025-09-30",calendarEvidence,workingDayEvidence};
}

describe("Order 339: India GST section14 governed payment-receipt date",()=>{
  test("retains ordinary earlier-of through fourth working day and substitutes bank only after",()=>{
    for(const [bank,books,branch,date] of [
      ["2025-09-23","2025-09-22","ordinary_earlier_of_within_four_working_days","2025-09-22"],
      ["2025-09-29","2025-09-23","ordinary_earlier_of_within_four_working_days","2025-09-23"],
      ["2025-09-29","2025-09-30","ordinary_earlier_of_within_four_working_days","2025-09-29"],
      ["2025-09-30","2025-09-23","bank_credit_after_four_working_days","2025-09-30"],
    ] as const){const actual=deriveIndiaGstSection14PaymentReceiptDate(build(bank,books) as never);expect(actual.fourthWorkingDayDate).toBe("2025-09-29");expect(actual.branch).toBe(branch);expect(actual.paymentReceiptDate).toBe(date);}
  });

  test("requires calendar-required predecessor branch and coverage of bank credit",()=>{
    const safe=build("2025-09-22","2025-09-21");
    expect(()=>deriveIndiaGstSection14PaymentReceiptDate(safe as never)).toThrow();
    const absent=build();
    const days=structuredClone(calendarDays).filter(day=>day.date!=="2025-09-30") as Mutable[];
    const calendarEvidence=freeze({jurisdiction:"IN",authorityId:AUTHORITY,sourceDigestSha256:CAL_SOURCE,days});
    const workingDayEvidence=deriveIndiaGstSection14WorkingDayCalendarEvidence({tenantId:TENANT,rateChangeDate:CHANGE,throughDate:"2025-09-29",calendarEvidence} as never);
    expect(()=>deriveIndiaGstSection14PaymentReceiptDate({...absent,throughDate:"2025-09-29",calendarEvidence,workingDayEvidence} as never)).toThrow(/contain/);
  });

  test("replays every supplied predecessor and rejects coherent or shallow copies",()=>{
    const valid=build();
    for(const key of ["rateChangeDateEvidence","paymentProvisoEvidence","workingDayEvidence"] as const){const changed=structuredClone(valid[key]) as Mutable;changed.evidenceHash="a".repeat(64);freeze(changed);expect(()=>deriveIndiaGstSection14PaymentReceiptDate({...valid,[key]:changed} as never)).toThrow();expect(()=>deriveIndiaGstSection14PaymentReceiptDate({...valid,[key]:{...valid[key]}} as never)).toThrow();}
    const changedPair=structuredClone(valid.rateVersionPair) as Mutable;changedPair.successor.gstRoomSlabs[0].rate=0.12;expect(()=>deriveIndiaGstSection14PaymentReceiptDate({...valid,rateVersionPair:changedPair} as never)).toThrow();
  });

  test("rejects surplus downstream authority, proxies, accessors and symbols",()=>{
    const valid=build();
    for(const key of ["rate","taxableValue","taxAmount","rounding","matrix","posting","document","irp","currentDate"]){expect(()=>deriveIndiaGstSection14PaymentReceiptDate({...valid,[key]:1} as never)).toThrow();}
    expect(()=>deriveIndiaGstSection14PaymentReceiptDate(new Proxy(valid,{}) as never)).toThrow();
    const accessor={...valid} as Mutable;Object.defineProperty(accessor,"throughDate",{enumerable:true,get:()=>"2025-09-30"});expect(()=>deriveIndiaGstSection14PaymentReceiptDate(accessor as never)).toThrow();
    const symbolic={...valid} as Mutable;symbolic[Symbol("x")]=true;expect(()=>deriveIndiaGstSection14PaymentReceiptDate(symbolic as never)).toThrow();
  });

  test("returns deterministic frozen tenant-hidden and complete predecessor-bound evidence",()=>{
    const valid=build(),first=deriveIndiaGstSection14PaymentReceiptDate(valid as never),second=deriveIndiaGstSection14PaymentReceiptDate(valid as never);expect(second).toEqual(first);expect(JSON.stringify(second)).toBe(JSON.stringify(first));deepFrozen(first);expect(first).not.toHaveProperty("tenantId");expect(JSON.stringify(first)).not.toContain(TENANT);expect(first.predecessorHashes).toEqual({rateChangeDate:valid.rateChangeDateEvidence.evidenceHash,paymentProviso:valid.paymentProvisoEvidence.evidenceHash,workingDayCalendar:valid.workingDayEvidence.evidenceHash});expect(first.evidenceHash).toMatch(/^[0-9a-f]{64}$/);const{evidenceHash,...body}=first;expect(evidenceHash).toBe(new Bun.CryptoHasher("sha256").update(JSON.stringify({tenantId:TENANT,...body})).digest("hex"));
    const other=build("2025-09-30","2025-09-23",OTHER);expect(deriveIndiaGstSection14PaymentReceiptDate(other as never).evidenceHash).not.toBe(first.evidenceHash);
  });

  test("source contains no matrix, tax, persistence, clock or calendar-state inference authority",async()=>{const source=await Bun.file(new URL("../src/contexts/tax-fiscal/india-gst-section14-payment-receipt-date.ts",import.meta.url)).text();expect(source).not.toMatch(/new\s+Date|Date\.now|weekday|weekend|holiday|\b(?:SELECT|INSERT|UPDATE|DELETE)\s+(?:FROM|INTO|SET)\b|fetch\s*\(|taxMinor|taxableValue|rounding|six.?case/i);});
});
