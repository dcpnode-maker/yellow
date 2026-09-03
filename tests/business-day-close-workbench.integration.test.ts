import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { BusinessDayCloseWorkbenchService, BusinessDayCloseWorkbenchUnavailableError } from "../src/contexts/financials";
import { Database } from "../src/kernel";

const DEPLOY = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME = process.env.YELLOW_RUNTIME_DATABASE_URL;
const REQUIRED = process.env.YELLOW_REQUIRE_BUSINESS_DAY_CLOSE_WORKBENCH === "1";
if (REQUIRED && (!DEPLOY || !RUNTIME)) throw new Error("Order384 PostgreSQL proof requires deploy and runtime URLs");
const databaseDescribe = DEPLOY && RUNTIME ? describe.serial : describe.skip;
const T = "00000000-0000-0000-0000-000000038400";
const P = "00000000-0000-0000-0000-000000038401";
const P2 = "00000000-0000-0000-0000-000000038402";
const A = "00000000-0000-0000-0000-000000038403";
const IA = "00000000-0000-0000-0000-000000038404";
const S = "00000000-0000-0000-0000-000000038405";
let admin: SQL | undefined;
let database: Database | undefined;
let service: BusinessDayCloseWorkbenchService | undefined;
const input = (date: string, overrides: Record<string,string> = {}) => ({ tenantId:T,propertyNode:P,businessDate:date,actorId:A,...overrides });

async function reset() {
  await admin!`DELETE FROM business_day_discrepancy_carry WHERE tenant_id=${T}::uuid`;
  await admin!`DELETE FROM outbox WHERE tenant_id=${T}::uuid`;
  await admin!`DELETE FROM discrepancy WHERE tenant_id=${T}::uuid`;
  await admin!`DELETE FROM business_day WHERE tenant_id=${T}::uuid`;
}
async function day(date:string, property=P, sealed=false) {
  await admin!`INSERT INTO business_day(tenant_id,property_node,business_date,opened_at,sealed_at)
    VALUES(${T}::uuid,${property}::uuid,${date}::date,${date}::date+time '02:00',CASE WHEN ${sealed} THEN ${date}::date+time '23:00' ELSE NULL END)`;
}
async function discrepancy(id:string,date:string,eventCount=1,property=P) {
  await admin!`INSERT INTO discrepancy(id,tenant_id,space_id,reported,system_state,reported_by)
    VALUES(${id}::uuid,${T}::uuid,${S}::uuid,'occupied','vacant',${A}::uuid)`;
  for(let n=0;n<eventCount;n++) await admin!`INSERT INTO outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,actor_id,correlation_id,payload)
    VALUES(${T}::uuid,${property}::uuid,${date}::date,'discrepancy',${id}::uuid,'discrepancy.reported',${A}::uuid,${crypto.randomUUID()}::uuid,'{}')`;
}

databaseDescribe("Order384 PostgreSQL close workbench",()=>{
  beforeAll(async()=>{
    admin=new SQL(DEPLOY!,{max:3,prepare:false}); database=Database.connect(RUNTIME!,{maxConnections:3,prepare:false}); service=new BusinessDayCloseWorkbenchService({database});
    await admin`INSERT INTO tenant(id,slug,name,tier,status) VALUES(${T}::uuid,'o384','Order384','shared','active')`;
    await admin`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
      (${P}::uuid,${T}::uuid,'o384.p1','property','Order384','UTC','USD'),(${P2}::uuid,${T}::uuid,'o384.p2','property','Other','UTC','USD')`;
    await admin`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES
      (${A}::uuid,${T}::uuid,'o384@example.invalid','Order384','active'),(${IA}::uuid,${T}::uuid,'o384i@example.invalid','Inactive','inactive')`;
    await admin`INSERT INTO space(id,tenant_id,property_node,code,profile_key,capacity,status) VALUES(${S}::uuid,${T}::uuid,${P}::uuid,'384','hotel',1,'active')`;
  });
  afterAll(async()=>{ await reset(); await admin!`DELETE FROM space WHERE tenant_id=${T}::uuid`; await admin!`DELETE FROM app_user WHERE tenant_id=${T}::uuid`; await admin!`DELETE FROM org_node WHERE tenant_id=${T}::uuid`; await admin!`DELETE FROM tenant WHERE id=${T}::uuid`; await database?.close(); await admin?.close(); },15000);

  test("parses one statement and binds active actor, property, selected unsealed day and persisted current",async()=>{
    await reset(); await day("2048-01-01"); await day("2048-01-02"); await day("2048-01-03"); await day("2047-12-31",P,true); await day("2048-01-04",P2);
    const result=await service!.read(input("2048-01-02"));
    expect(result.openDays.map(d=>[d.businessDate,d.isCurrent])).toEqual([["2048-01-01",false],["2048-01-02",false],["2048-01-03",true]]);
    expect(result.currentOpenBusinessDate).toBe("2048-01-03"); expect(result.carryCandidates).toEqual([]); expect(Object.isFrozen(result.openDays)).toBe(true);
    await expect(service!.read(input("2048-01-02",{actorId:IA}))).rejects.toBeInstanceOf(BusinessDayCloseWorkbenchUnavailableError);
  },15000);

  test("returns only unique ordinary selected-day lineage and fails duplicate selected lineage closed",async()=>{
    await reset(); await day("2048-02-01"); await day("2048-02-02");
    const id="00000000-0000-0000-0000-000000038410"; await discrepancy(id,"2048-02-01");
    expect((await service!.read(input("2048-02-01"))).carryCandidates).toEqual([{discrepancyId:id,spaceId:S,spaceCode:"384",reportedBusinessDate:"2048-02-01"}]);
    await admin!`INSERT INTO outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,actor_id,correlation_id,payload)
      VALUES(${T}::uuid,${P}::uuid,'2048-02-01','discrepancy',${id}::uuid,'discrepancy.reported',${A}::uuid,${crypto.randomUUID()}::uuid,'{}')`;
    await expect(service!.read(input("2048-02-01"))).rejects.toBeInstanceOf(BusinessDayCloseWorkbenchUnavailableError);
  });

  test("leaves missing and foreign lineage as approved readiness unknown and keeps current candidates empty",async()=>{
    await reset(); await day("2048-03-01"); await day("2048-03-02");
    await discrepancy("00000000-0000-0000-0000-000000038411","2048-03-01",0);
    const older=await service!.read(input("2048-03-01")); expect(older.carryCandidates).toEqual([]); expect(older.readiness.counts.unknownAttribution).toBeGreaterThan(0);
    await reset(); await day("2048-03-01"); await day("2048-03-02");
    await discrepancy("00000000-0000-0000-0000-000000038412","2048-03-02",1);
    expect((await service!.read(input("2048-03-02"))).carryCandidates).toEqual([]);
  });

  test("fails closed at 366/367 open-day boundary and performs zero writes",async()=>{
    await reset();
    await admin!.unsafe(`INSERT INTO business_day(tenant_id,property_node,business_date,opened_at)
      SELECT '${T}'::uuid,'${P}'::uuid,date '2049-01-01'+n,(date '2049-01-01'+n)+time '02:00' FROM generate_series(0,365) n`);
    const before=await admin!<Array<{n:number}>>`SELECT count(*)::int n FROM business_day WHERE tenant_id=${T}::uuid`;
    expect((await service!.read(input("2049-01-01"))).openDays).toHaveLength(366);
    expect(await admin!<Array<{n:number}>>`SELECT count(*)::int n FROM business_day WHERE tenant_id=${T}::uuid`).toEqual(before);
    await day("2050-01-02");
    await expect(service!.read(input("2049-01-01"))).rejects.toBeInstanceOf(BusinessDayCloseWorkbenchUnavailableError);
  });

  test("returns 500 minimized candidates and fails closed at candidate MAX+1",async()=>{
    await reset(); await day("2051-01-01"); await day("2051-01-02");
    await admin!.unsafe(`INSERT INTO space(id,tenant_id,property_node,code,profile_key,capacity,status)
      SELECT md5('o384-space-'||n)::uuid,'${T}'::uuid,'${P}'::uuid,'C'||lpad(n::text,3,'0'),'hotel',1,'active'
        FROM generate_series(1,501) n ON CONFLICT DO NOTHING;
      INSERT INTO discrepancy(id,tenant_id,space_id,reported,system_state,reported_by)
      SELECT md5('o384-disc-'||n)::uuid,'${T}'::uuid,md5('o384-space-'||n)::uuid,'occupied','vacant','${A}'::uuid
        FROM generate_series(1,500) n;
      INSERT INTO outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,actor_id,correlation_id,payload)
      SELECT '${T}'::uuid,'${P}'::uuid,date '2051-01-01','discrepancy',md5('o384-disc-'||n)::uuid,
        'discrepancy.reported','${A}'::uuid,gen_random_uuid(),'{}'::jsonb FROM generate_series(1,500) n;`);
    expect((await service!.read(input("2051-01-01"))).carryCandidates).toHaveLength(500);
    await admin!.unsafe(`INSERT INTO discrepancy(id,tenant_id,space_id,reported,system_state,reported_by)
      VALUES(md5('o384-disc-501')::uuid,'${T}'::uuid,md5('o384-space-501')::uuid,'occupied','vacant','${A}'::uuid);
      INSERT INTO outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,actor_id,correlation_id,payload)
      VALUES('${T}'::uuid,'${P}'::uuid,date '2051-01-01','discrepancy',md5('o384-disc-501')::uuid,
        'discrepancy.reported','${A}'::uuid,gen_random_uuid(),'{}'::jsonb);`);
    await expect(service!.read(input("2051-01-01"))).rejects.toBeInstanceOf(BusinessDayCloseWorkbenchUnavailableError);
  },15000);
});
