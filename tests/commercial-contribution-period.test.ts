import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { Database } from "../src/kernel";
import type { Tx } from "../src/kernel";
import { OperatorHttpApi } from "../src/http/operator";
import { CommercialContributionService, commercialContributionWindow, isCommercialContributionPeriod } from "../src/contexts/reporting";

test("calendar-to-date periods honor Monday weeks, quarter/year boundaries and leap days", () => {
  expect(commercialContributionWindow("2026-10-03","today")).toEqual({period:"today",fromDate:"2026-10-03",toDateExclusive:"2026-10-04",expectedDays:1});
  expect(commercialContributionWindow("2026-10-04","week").fromDate).toBe("2026-09-28");
  expect(commercialContributionWindow("2026-10-05","week").expectedDays).toBe(1);
  expect(commercialContributionWindow("2026-01-01","week").fromDate).toBe("2025-12-29");
  expect(commercialContributionWindow("2028-02-29","month").expectedDays).toBe(29);
  expect(commercialContributionWindow("2026-04-01","quarter").fromDate).toBe("2026-04-01");
  expect(commercialContributionWindow("2026-12-31","quarter").expectedDays).toBe(92);
  expect(commercialContributionWindow("2028-12-31","year").expectedDays).toBe(366);
});
test("bad civil dates and unapproved period names cannot select arbitrary reporting windows", () => {
  for (const date of ["2026-02-30","2026-02-29","bad","0000-01-01","9999-12-31"]) expect(()=>commercialContributionWindow(date,"year")).toThrow();
  for (const period of ["all","WEEK","",null,{}]) expect(isCommercialContributionPeriod(period)).toBe(false);
});

const id=(n:number)=>`20000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const T=id(91001),F=id(91002),P=id(91003),OTHER=id(91004),FP=id(91005),TYPE=id(91006),ACTOR=id(91007),ROLE=id(91008);
const api=new OperatorHttpApi({} as never),service=new CommercialContributionService();
const scope="reservations.lifecycle:read";

test("unmapped legacy source/channel pairs cannot collide in aggregation keys",async()=>{
  const pairs=[["A","B:NO_MAPPING|C","100"],["A:NO_MAPPING|B","C","200"],["","","300"],["UNMAPPED","","400"]];
  const tx=(async(parts:TemplateStringsArray)=>{
    const query=parts.join("?");
    if(query.includes("FROM org_node")) return [{name:"Synthetic",currency:"INR",business_date:"2026-10-03"}];
    if(query.includes("FROM extension")) return [];
    if(query.includes("FROM stats_daily")) return pairs.map(([source,channel,amount])=>({unit_type_id:TYPE,market_code:"OTA",source_code:source,channel_code:channel,rooms_available:2,room_nights:1,room_revenue_minor:amount,recorded_dates:["2026-10-03"]}));
    throw new Error("Unexpected query");
  }) as unknown as Tx;
  const value=await service.load(tx,{tenantId:T,propertyNode:P});
  const sources=value.groups.flatMap(group=>group.segments.flatMap(segment=>segment.sources));
  expect(sources).toHaveLength(4);
  expect(sources.map(row=>row.metric.roomRevenueMinor).sort()).toEqual(["100","200","300","400"]);
  expect(value.total.roomRevenueMinor).toBe("1000");
});
test("HTTP malformed/duplicate periods are rejected before any database access; no token scope is forbidden",async()=>{
  const tx=(async()=>{throw new Error("Unexpected query");}) as unknown as Tx;
  const request=(query:string,scopes:readonly string[]=[])=>api.commercialContribution({request:new Request(`http://yellow.test/api/v1/properties/${P}/commercial-contribution${query}`),tenantId:T,identity:{tenantId:T,actorId:ACTOR,scopes},tx},P);
  for(const query of ["?period=","?period=all","?period=WEEK","?period=month&period=year","?period=today&from=2026-01-01","?unexpected=1"]) expect((await request(query,[scope])).status).toBe(400);
  expect((await request("?period=year")).status).toBe(403);
});

const DEPLOY=process.env.YELLOW_MIX_DEPLOY_URL,RUNTIME=process.env.YELLOW_MIX_RUNTIME_URL;
if(process.env.YELLOW_REQUIRE_MIX==="1"&&(!DEPLOY||!RUNTIME)) throw new Error("Business mix proof requires isolated deploy and runtime URLs");
for(const value of [DEPLOY,RUNTIME]) if(value){const url=new URL(value);if(url.hostname!=="127.0.0.1"||url.port!=="55493"||url.pathname!=="/yellow_calendar_acceptance_20261003_isolated_v2")throw new Error("Mix fixture is restricted to the isolated synthetic database");}
const dbDescribe=DEPLOY&&RUNTIME?describe.serial:describe.skip;
let admin:SQL,database:Database,businessDate:string;
let fixture: {date:string;nights:number;revenue:string;source:string;channel:string}[]=[];
async function clean(){
  if(!admin)return;
  await admin`DELETE FROM role_permission WHERE role_id=${ROLE}::uuid`;
  for(const table of ["user_role","role","app_user","stats_daily","extension","unit_type","org_node"]) await admin.unsafe(`DELETE FROM ${table} WHERE tenant_id IN ($1::uuid,$2::uuid)`,[T,F]);
  await admin`DELETE FROM tenant WHERE id IN (${T}::uuid,${F}::uuid)`;
}
beforeAll(async()=>{
  if(!DEPLOY||!RUNTIME)return;
  admin=new SQL(DEPLOY,{max:2,prepare:false});database=Database.connect(RUNTIME,{maxConnections:2,prepare:false});await clean();
  await admin`INSERT INTO tenant(id,slug,name,tier,status) VALUES (${T}::uuid,'mix-proof','Mix proof','shared','active'),(${F}::uuid,'mix-foreign-proof','Foreign mix','shared','active')`;
  await admin`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES (${P}::uuid,${T}::uuid,'mix_property','property','Mix Hotel','Pacific/Kiritimati','INR'),(${OTHER}::uuid,${T}::uuid,'mix_other','property','Other Mix','UTC','USD'),(${FP}::uuid,${F}::uuid,'mix_foreign','property','Foreign Mix','UTC','USD')`;
  await admin`INSERT INTO unit_type(id,tenant_id,property_node,code,name,profile_key) VALUES (${TYPE}::uuid,${T}::uuid,${P}::uuid,'STD','Standard','hotel')`;
  const dates=await admin`SELECT (transaction_timestamp() AT TIME ZONE 'Pacific/Kiritimati')::date::text AS d`;businessDate=dates[0].d;
  const offset=(days:number)=>{const date=new Date(`${businessDate}T00:00:00Z`);date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10);};
  const windows=["today","week","month","quarter","year"] as const;
  const unique=new Set([businessDate,offset(-1),offset(-365),offset(1),...windows.map(period=>commercialContributionWindow(businessDate,period).fromDate)]);
  fixture=[...unique].map(date=>({date,nights:1,revenue:"9007199254740993",source:"WEBSITE",channel:"DIRECT"}));
  fixture.push({date:businessDate,nights:2,revenue:"501",source:"MMT",channel:"MMT_WEB"});
  for(const row of fixture) await admin`INSERT INTO stats_daily(tenant_id,property_node,business_date,unit_type_id,market_code,source_code,channel_code,rooms_available,rooms_sold,room_revenue_minor) VALUES (${T}::uuid,${P}::uuid,${row.date}::date,${TYPE}::uuid,'OTA',${row.source},${row.channel},10,${row.nights},${row.revenue}::bigint)`;
  for(const [tenant,property] of [[T,OTHER],[F,FP]] as const) await admin`INSERT INTO stats_daily(tenant_id,property_node,business_date,unit_type_id,market_code,source_code,channel_code,rooms_available,rooms_sold,room_revenue_minor) VALUES (${tenant}::uuid,${property}::uuid,${businessDate}::date,${TYPE}::uuid,'OTA','WEBSITE','DIRECT',1000,999,'7000000000000000000'::bigint)`;
  const taxonomy={demandGroups:[{code:"OTA",label:"Online travel",segments:[{code:"RETAIL",label:"Retail"}]}],distributionGroups:[{code:"DIRECT",label:"Direct",sources:[{code:"WEBSITE",label:"Website",channelCodes:["DIRECT"]}]},{code:"OTA",label:"OTAs",sources:[{code:"MMT",label:"MakeMyTrip",channelCodes:["MMT_WEB"]}]}],companies:[],roomClasses:[{code:"STD",label:"Standard",unitTypeIds:[TYPE]}],marketMappings:[{marketCode:"OTA",segmentCode:"RETAIL"}]};
  await admin`INSERT INTO extension_type(type,json_schema) VALUES ('commercial_attribution','{}'::jsonb) ON CONFLICT(type) DO NOTHING`;
  await admin`INSERT INTO extension(tenant_id,type,key,version,effective,content,status) VALUES (${T}::uuid,'commercial_attribution',${`property:${P}`},1,tstzrange('-infinity','infinity','[)'),${JSON.stringify(taxonomy)}::jsonb,'active')`;
  await admin`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES (${ACTOR}::uuid,${T}::uuid,'mix@example.test','Mix reader','active')`;
  await admin`INSERT INTO role(id,tenant_id,name) VALUES (${ROLE}::uuid,${T}::uuid,'Mix reader')`;
  await admin`INSERT INTO permission(code,description) VALUES (${scope},'Lifecycle read') ON CONFLICT(code) DO NOTHING`;
  await admin`INSERT INTO role_permission(role_id,permission_code) VALUES (${ROLE}::uuid,${scope})`;
  await admin`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node) VALUES (${T}::uuid,${ACTOR}::uuid,${ROLE}::uuid,${P}::uuid)`;
});
afterAll(async()=>{if(admin){await clean();await admin.close();}if(database)await database.close();});
dbDescribe("business mix actual runtime-role PostgreSQL evidence",()=>{
  test("all periods use the property-local civil date, exact source totals, recorded coverage and exclusive future boundary",async()=>{
    for(const period of ["today","week","month","quarter","year"] as const){
      const value=await database.withTenantTransaction(T,tx=>service.load(tx,{tenantId:T,propertyNode:P,period}));
      const window=commercialContributionWindow(businessDate,period),expected=fixture.filter(row=>row.date>=window.fromDate&&row.date<window.toDateExclusive);
      expect(value.property).toMatchObject({id:P,businessDate,currency:"INR"});
      expect(value.window).toEqual({...window,recordedDays:new Set(expected.map(row=>row.date)).size});
      expect(value.total.roomNights).toBe(expected.reduce((sum,row)=>sum+row.nights,0));
      expect(value.total.roomRevenueMinor).toBe(expected.reduce((sum,row)=>sum+BigInt(row.revenue),0n).toString());
      expect(value.groups[0]!.segments[0]!.sources.find(row=>row.source.code==="MMT")!.metric.roomRevenueMinor).toBe("501");
    }
    await expect(database.withTenantTransaction(F,tx=>service.load(tx,{tenantId:T,propertyNode:P,period:"year"}))).rejects.toThrow("scope was not found");
  });
  test("current grants and revocation remain mandatory even with a valid read token scope",async()=>{
    const read=(property:string)=>database.withTenantTransaction(T,tx=>api.commercialContribution({request:new Request(`http://yellow.test/api/v1/properties/${property}/commercial-contribution?period=year`),tenantId:T,identity:{tenantId:T,actorId:ACTOR,scopes:[scope]},tx},property));
    expect((await read(OTHER)).status).toBe(403);expect((await read(FP)).status).toBe(403);expect((await read(P)).status).toBe(200);
    await admin`DELETE FROM user_role WHERE user_id=${ACTOR}::uuid`;
    try{expect((await read(P)).status).toBe(403);}finally{await admin`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node) VALUES (${T}::uuid,${ACTOR}::uuid,${ROLE}::uuid,${P}::uuid)`;}
  });
  test("reporting leaves canonical stats, occupancy, finance and event tables unchanged",async()=>{
    const snapshot=()=>admin`SELECT (SELECT count(*) FROM stats_daily) stats,(SELECT sum(room_revenue_minor)::text FROM stats_daily) revenue,(SELECT count(*) FROM space_occupancy) occupancy,(SELECT count(*) FROM journal) journals,(SELECT count(*) FROM fact_log) facts,(SELECT count(*) FROM outbox) events`;
    const before=await snapshot();await database.withTenantTransaction(T,tx=>service.load(tx,{tenantId:T,propertyNode:P,period:"year"}));expect(await snapshot()).toEqual(before);
  });
  test("missing taxonomy retains separate recorded sources without inventing mappings",async()=>{
    await admin`UPDATE extension SET status='retired' WHERE tenant_id=${T}::uuid AND type='commercial_attribution'`;
    try {
      const value=await database.withTenantTransaction(T,tx=>service.load(tx,{tenantId:T,propertyNode:P,period:"today"}));
      const sources=value.groups.flatMap(group=>group.segments.flatMap(segment=>segment.sources));
      expect(sources.map(row=>row.source.code).sort()).toEqual(["MMT","WEBSITE"]);
      expect(sources.every(row=>row.source.reason==="NO_MAPPING"&&row.source.label.endsWith(" · Unmapped"))).toBe(true);
      expect(value.total.roomRevenueMinor).toBe("9007199254741494");
      expect(value.window.recordedDays).toBe(1);
    } finally { await admin`UPDATE extension SET status='active' WHERE tenant_id=${T}::uuid AND type='commercial_attribution'`; }
  });
});
