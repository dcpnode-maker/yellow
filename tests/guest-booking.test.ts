import { describe, test, expect } from "bun:test";
import { GuestBookingService, GuestBookingError, guestBookingTermsFingerprint, type GuestBookingServiceOptions } from "../src/contexts/reservations";
import { GuestBookingTokenSigner, GuestBookingAuthorityError, GUEST_BOOKING_ISSUER_SCOPES } from "../src/contexts/identity";
import type { Tx } from "../src/kernel";
import type { RateQuote } from "../src/contexts/rates";

const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const NOW=Date.now();
const claims={tenantId:id(1),propertyNode:id(2),actorId:id(3),primaryPartyId:id(4),ratePlanIds:[id(5)],
  channelCode:"direct",sessionId:id(6),validFrom:Math.floor(NOW/1000),validUntil:Math.floor(NOW/1000)+900};
const body={stayStart:"2026-11-01T00:00:00.000Z",stayEnd:"2026-11-02T00:00:00.000Z",adults:1,childAges:[]};
function fixture(authority?:GuestBookingServiceOptions["authority"], contextRows: readonly Record<string, unknown>[] = [], serviceNow:()=>number=()=>NOW) {
  const calls:unknown[]=[];
  const tokens=new GuestBookingTokenSigner("a".repeat(32),{now:()=>NOW});
  const tx=(async(strings:TemplateStringsArray)=>{
    const query=strings.join("");
    if(query.includes("clock_timestamp"))return [{now:new Date(NOW)}];
    if(query.includes("FROM public.org_node AS property"))return contextRows;
    return [];
  }) as unknown as Tx;
  const options={tokens,authority:authority??{authorize:async()=>new Date(NOW)},now:serviceNow,
    rates:{getRatePlan:async()=>({id:id(5),tenantId:id(1),propertyNode:id(2),code:"PUBLIC",status:"active"})},
    offers:{search:async(_tx:Tx,input:unknown)=>{calls.push(input);return {options:[]};}},
  } as unknown as GuestBookingServiceOptions;
  const service=new GuestBookingService(options);
  const session=service.authenticate(tokens.issue("session",claims,900))!;
  return {service,tokens,session,tx,calls};
}
describe("Invitation guest booking authority and input",()=>{
  test("authenticates only its own immutable scoped session, not staff or forged DTO authority",async()=>{
    const f=fixture();expect(f.session).not.toBeNull();expect(Object.isFrozen(f.session)).toBe(true);
    expect(Object.isFrozen(f.session.ratePlanIds)).toBe(true);expect(f.service.authenticate("eyJ.staff.token")).toBeNull();
    await expect(f.service.offers(f.tx,{...f.session},body)).rejects.toBeInstanceOf(GuestBookingError);
    expect(f.calls).toHaveLength(0);
  });
  test("injects only session property/channel/allowed plans and rejects body authority drift",async()=>{
    const f=fixture();await f.service.offers(f.tx,f.session,body);
    const input=f.calls[0] as Record<string,unknown>;
    expect(input.propertyNode).toBe(id(2));expect(input.channelCode).toBe("direct");expect(input.ratePlanCodes).toEqual(["PUBLIC"]);
    await expect(f.service.offers(f.tx,f.session,{...body,propertyNode:id(99)})).rejects.toBeInstanceOf(GuestBookingError);
    await expect(f.service.offers(f.tx,f.session,{...body,adults:0})).rejects.toBeInstanceOf(GuestBookingError);
    await expect(f.service.offers(f.tx,f.session,{...body,childAges:[18]})).rejects.toBeInstanceOf(GuestBookingError);
    expect(f.calls).toHaveLength(1);
  });
  test("snapshot stays and children survive input mutation while authority awaits",async()=>{
    let proceed:()=>void=()=>{};const wait=new Promise<void>(r=>{proceed=r;});
    const f=fixture({authorize:async()=>{await wait;return new Date(NOW);}});
    const input={...body,childAges:[6]};const pending=f.service.offers(f.tx,f.session,input);
    input.adults=99;input.childAges[0]=17;proceed();await pending;
    expect((f.calls[0] as {guests:unknown}).guests).toEqual({adults:1,childAges:[6]});
  });
  test("live revocation denies before canonical search and all guest writes",async()=>{
    const f=fixture({authorize:async()=>{throw new GuestBookingAuthorityError();}});
    await expect(f.service.offers(f.tx,f.session,body)).rejects.toMatchObject({status:403});
    await expect(f.service.hold(f.tx,f.session,{quoteToken:"invalid"},id(8))).rejects.toMatchObject({status:403});
    await expect(f.service.reserve(f.tx,f.session,{holdToken:"invalid"},id(8))).rejects.toMatchObject({status:403});
    expect(f.calls).toHaveLength(0);
  });
  test("returns property-local labels only for every active invitation plan and linked sellable unit",async()=>{
    const f=fixture(undefined,[{
      tenant_id:id(1),property_id:id(2),property_name:"Harbor House",property_timezone:"Asia/Kolkata",
      rate_plan_id:id(5),rate_plan_code:"PUBLIC",rate_plan_name:"Public rate",
      unit_type_id:id(9),unit_type_code:"QUEEN",unit_type_name:"Queen room",
      sellable_unit_id:id(7),sellable_unit_name:"Room 204",
    }]);
    const result=await f.service.context(f.tx,f.session,{});
    const canonicalTimeZone=new Intl.DateTimeFormat("en",{timeZone:"Asia/Kolkata"}).resolvedOptions().timeZone;
    expect(result).toEqual({property:{id:id(2),name:"Harbor House",timeZone:canonicalTimeZone},ratePlans:[{
      id:id(5),code:"PUBLIC",name:"Public rate",unitTypes:[{id:id(9),code:"QUEEN",name:"Queen room",units:[{id:id(7),name:"Room 204"}]}],
    }]});
    const legacyGmt=fixture(undefined,[{
      tenant_id:id(1),property_id:id(2),property_name:"Harbor House",property_timezone:"GMT",
      rate_plan_id:id(5),rate_plan_code:"PUBLIC",rate_plan_name:"Public rate",
      unit_type_id:null,unit_type_code:null,unit_type_name:null,sellable_unit_id:null,sellable_unit_name:null,
    }]);
    await expect(legacyGmt.service.context(legacyGmt.tx,legacyGmt.session,{})).resolves.toMatchObject({
      property:{timeZone:"UTC"},
    });
  });
  test("rejects foreign query rows, absent allowed plans and invalid IANA property timezone",async()=>{
    const row={tenant_id:id(1),property_id:id(2),property_name:"Harbor House",property_timezone:"UTC",
      rate_plan_id:id(5),rate_plan_code:"PUBLIC",rate_plan_name:"Public rate",
      unit_type_id:null,unit_type_code:null,unit_type_name:null,sellable_unit_id:null,sellable_unit_name:null};
    const foreign=fixture(undefined,[{...row,tenant_id:id(99)}]);
    await expect(foreign.service.context(foreign.tx,foreign.session,{})).rejects.toBeInstanceOf(GuestBookingError);
    const missingPlan=fixture(undefined,[{...row,rate_plan_id:null,rate_plan_code:null,rate_plan_name:null}]);
    await expect(missingPlan.service.context(missingPlan.tx,missingPlan.session,{})).rejects.toBeInstanceOf(GuestBookingError);
    const unallowedPlan=fixture(undefined,[{...row,rate_plan_id:id(6)}]);
    await expect(unallowedPlan.service.context(unallowedPlan.tx,unallowedPlan.session,{})).rejects.toBeInstanceOf(GuestBookingError);
    for(const property_timezone of ["Not/A_Timezone","+05:30","utc","asia/Kolkata","Asia/calcutta"]) {
      const badTimeZone=fixture(undefined,[{...row,property_timezone}]);
      await expect(badTimeZone.service.context(badTimeZone.tx,badTimeZone.session,{})).rejects.toBeInstanceOf(GuestBookingError);
    }
  });
  test("rechecks live plan authority and session expiry after loading context labels",async()=>{
    const row={tenant_id:id(1),property_id:id(2),property_name:"Harbor House",property_timezone:"UTC",
      rate_plan_id:id(5),rate_plan_code:"PUBLIC",rate_plan_name:"Public rate",
      unit_type_id:null,unit_type_code:null,unit_type_name:null,sellable_unit_id:null,sellable_unit_name:null};
    let authorizationCalls=0;
    const revoked=fixture({authorize:async()=>{
      authorizationCalls++;
      if(authorizationCalls===2)throw new GuestBookingAuthorityError();
      return new Date(NOW);
    }},[row]);
    await expect(revoked.service.context(revoked.tx,revoked.session,{})).rejects.toMatchObject({status:403});

    let wallClock=NOW;
    const expiring=fixture({authorize:async()=>{
      wallClock=NOW+901_000;
      return new Date(NOW);
    }},[row],()=>wallClock);
    await expect(expiring.service.context(expiring.tx,expiring.session,{})).rejects.toMatchObject({status:401});
  });
  test("requires the authentic in-memory session, exact empty body, and rejects excess unit rows",async()=>{
    const row={tenant_id:id(1),property_id:id(2),property_name:"Harbor House",property_timezone:"UTC",
      rate_plan_id:id(5),rate_plan_code:"PUBLIC",rate_plan_name:"Public rate",
      unit_type_id:null,unit_type_code:null,unit_type_name:null,sellable_unit_id:null,sellable_unit_name:null};
    const f=fixture(undefined,[row]);
    await expect(f.service.context(f.tx,{...f.session},{})).rejects.toMatchObject({status:403});
    await expect(f.service.context(f.tx,f.session,{tenantId:id(1)})).rejects.toMatchObject({status:400});
    const excessive=fixture(undefined,Array.from({length:4097},()=>row));
    await expect(excessive.service.context(excessive.tx,excessive.session,{})).rejects.toMatchObject({status:503});
  });
  test("expiry is rechecked using PostgreSQL clock even when signature wall clock is earlier",async()=>{
    const f=fixture({authorize:async()=>new Date(NOW+901_000)});
    await expect(f.service.offers(f.tx,f.session,body)).rejects.toMatchObject({status:401});expect(f.calls).toHaveLength(0);
  });
  test("staff issuance cannot invent scope, unknown keys or upper-case duplicate UUIDs",async()=>{
    const f=fixture();const identity={tenantId:id(1),actorId:id(3),scopes:[...GUEST_BOOKING_ISSUER_SCOPES]};
    await expect(f.service.issue(f.tx,{...identity,scopes:[]},id(2),{},"valid-key",id(8))).rejects.toMatchObject({status:403});
    const issued={primaryPartyId:id(4),channelCode:"direct",ratePlanIds:[id(5)]};
    await expect(f.service.issue(f.tx,identity,id(2),{...issued,tenantId:id(99)},"valid-key",id(8))).rejects.toMatchObject({status:400});
    const upper="abcdef00-0000-4000-8000-000000000005";
    await expect(f.service.issue(f.tx,identity,id(2),{...issued,ratePlanIds:[upper,upper.toUpperCase()]},"valid-key",id(8))).rejects.toMatchObject({status:400});
  });
  test("financial terms ignore booking clock but retain price, currency, policies and release changes",()=>{
    const quote={tenantId:id(1),propertyNode:id(2),ratePlanId:id(5),sellableUnitId:id(7),unitTypeId:id(9),releaseId:id(10),
      releaseVersion:1,releaseContentHash:"a".repeat(64),modelDraftId:id(11),modelDraftVersion:1,targetDraftId:id(12),targetDraftVersion:1,
      propertyTimeZone:"UTC",stayStartDate:"2026-11-01",stayEndDate:"2026-11-02",taxAssignmentState:"configured",
      taxAssignments:[],taxPreview:{state:"calculated"},result:{currency:"AED",amountMinor:50000n,policy:{id:id(13)},evaluationContext:{bookingInstant:"old"}}} as unknown as RateQuote;
    const h=guestBookingTermsFingerprint(quote);
    expect(guestBookingTermsFingerprint({...quote,result:{...quote.result,evaluationContext:{bookingInstant:"new"}}} as unknown as RateQuote)).toBe(h);
    for(const change of [{releaseVersion:2},{result:{...quote.result,amountMinor:50001n}},{result:{...quote.result,currency:"INR"}},
      {result:{...quote.result,policy:{id:id(14)}}}])expect(guestBookingTermsFingerprint({...quote,...change} as unknown as RateQuote)).not.toBe(h);
  });
});
