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
const S2 = "00000000-0000-0000-0000-000000038407";
const APPROVER = "00000000-0000-0000-0000-000000038406";
const CARRY_SOURCE = "00000000-0000-0000-0000-000000038420";
const CARRY_TARGET = "00000000-0000-0000-0000-000000038421";
const CARRY_APPROVAL = "00000000-0000-0000-0000-000000038422";
const CARRY_REQUEST = "00000000-0000-0000-0000-000000038423";
let admin: SQL | undefined;
let database: Database | undefined;
let service: BusinessDayCloseWorkbenchService | undefined;
const input = (date: string, overrides: Record<string,string> = {}) => ({ tenantId:T,propertyNode:P,businessDate:date,actorId:A,...overrides });

async function reset() {
  await admin!`DELETE FROM business_day_discrepancy_carry WHERE tenant_id=${T}::uuid`;
  await admin!`DELETE FROM outbox WHERE tenant_id=${T}::uuid`;
  await admin!`DELETE FROM discrepancy WHERE tenant_id=${T}::uuid`;
  await admin!`DELETE FROM approval_request WHERE tenant_id=${T}::uuid`;
  await admin!`DELETE FROM business_day WHERE tenant_id=${T}::uuid`;
}
async function day(date:string, property=P, sealed=false) {
  await admin!`INSERT INTO business_day(tenant_id,property_node,business_date,opened_at,sealed_at)
    VALUES(${T}::uuid,${property}::uuid,${date}::date,${date}::date+time '02:00',CASE WHEN ${sealed} THEN ${date}::date+time '23:00' ELSE NULL END)`;
}
async function discrepancy(id:string,date:string,eventCount=1,property=P,space=S) {
  await admin!`INSERT INTO discrepancy(id,tenant_id,space_id,reported,system_state,reported_by)
    VALUES(${id}::uuid,${T}::uuid,${space}::uuid,'occupied','vacant',${A}::uuid)`;
  for(let n=0;n<eventCount;n++) await admin!`INSERT INTO outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,actor_id,correlation_id,payload)
    VALUES(${T}::uuid,${property}::uuid,${date}::date,'discrepancy',${id}::uuid,'discrepancy.reported',${A}::uuid,${crypto.randomUUID()}::uuid,'{}')`;
}

async function coherentCarry() {
  await day("2060-01-01"); await day("2060-01-02");
  await day("2060-01-01",P2); await day("2060-01-02",P2);
  await admin!.unsafe(`
    INSERT INTO discrepancy(id,tenant_id,space_id,reported,system_state,reported_by,reported_at,resolved_at,resolution)
    VALUES
      ('${CARRY_SOURCE}'::uuid,'${T}'::uuid,'${S}'::uuid,'occupied','vacant','${A}'::uuid,
       '2060-01-01 03:00:00+00','2060-01-02 04:00:00+00','carried_forward'),
      ('${CARRY_TARGET}'::uuid,'${T}'::uuid,'${S}'::uuid,'occupied','vacant','${A}'::uuid,
       '2060-01-02 04:00:00+00',NULL,NULL);
    WITH state AS (
      SELECT encode(digest(jsonb_build_object(
        'v',1,'tenantId','${T}'::uuid,'discrepancyId','${CARRY_SOURCE}'::uuid,
        'spaceId','${S}'::uuid,'reported','occupied','systemState','vacant',
        'reportedBy','${A}'::uuid,'reportedAt','2060-01-01 03:00:00+00'::timestamptz,
        'resolvedAt',NULL)::text,'sha256'),'hex') AS state_hash
    ), binding AS (
      SELECT state_hash,encode(digest(jsonb_build_object(
        'v',1,'tenantId','${T}'::uuid,'propertyNode','${P}'::uuid,
        'discrepancyId','${CARRY_SOURCE}'::uuid,'sourceBusinessDate','2060-01-01'::date,
        'targetBusinessDate','2060-01-02'::date,'reason','Carry for close',
        'discrepancyStateHash',state_hash,'targetOpenedAt','2060-01-02 02:00:00+05:30'::timestamptz
      )::text,'sha256'),'hex') AS request_hash FROM state
    ), approval AS (
      INSERT INTO approval_request(id,tenant_id,kind,subject_type,subject_id,requested_by,payload,status,decided_by,decided_at,created_at)
      SELECT '${CARRY_APPROVAL}'::uuid,'${T}'::uuid,'business_day_discrepancy_carry','discrepancy',
        '${CARRY_SOURCE}'::uuid,'${A}'::uuid,
        jsonb_build_object('propertyNode','${P}','sourceDiscrepancyId','${CARRY_SOURCE}',
          'sourceBusinessDate','2060-01-01','targetBusinessDate','2060-01-02','reason','Carry for close',
          'discrepancyStateHash',state_hash,'requestHash',request_hash,
          'targetOpenedAt','2060-01-01T20:30:00.000000Z'),
        'approved','${APPROVER}'::uuid,'2060-01-02 03:50:00+00','2060-01-02 03:40:00+00'
      FROM binding RETURNING id
    )
    INSERT INTO business_day_discrepancy_carry(
      tenant_id,id,request_id,property_node,source_discrepancy_id,target_discrepancy_id,
      source_business_date,target_business_date,target_opened_at,space_id,
      discrepancy_state_hash,reason,request_hash,approval_request_id,requested_by,approved_by,
      approval_requested_at,approval_decided_at,carried_at,resolution)
    SELECT '${T}'::uuid,gen_random_uuid(),'${CARRY_REQUEST}'::uuid,'${P}'::uuid,
      '${CARRY_SOURCE}'::uuid,'${CARRY_TARGET}'::uuid,'2060-01-01','2060-01-02',
      '2060-01-02 02:00:00+05:30','${S}'::uuid,state_hash,'Carry for close',request_hash,
      '${CARRY_APPROVAL}'::uuid,'${A}'::uuid,'${APPROVER}'::uuid,
      '2060-01-02 03:40:00+00','2060-01-02 03:50:00+00','2060-01-02 04:00:00+00','carried_forward'
    FROM binding;
    INSERT INTO outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,
      actor_id,correlation_id,payload,created_at)
    VALUES
      ('${T}'::uuid,'${P}'::uuid,'2060-01-01','discrepancy','${CARRY_SOURCE}'::uuid,
       'discrepancy.reported','${A}'::uuid,gen_random_uuid(),'{}','2060-01-01 03:00:00+00'),
      ('${T}'::uuid,'${P}'::uuid,'2060-01-02','discrepancy','${CARRY_TARGET}'::uuid,
       'discrepancy.carried','${A}'::uuid,'${CARRY_REQUEST}'::uuid,'{}','2060-01-02 04:00:00+00');
  `);
}

databaseDescribe("Order384 PostgreSQL close workbench",()=>{
  beforeAll(async()=>{
    admin=new SQL(DEPLOY!,{max:3,prepare:false}); database=Database.connect(RUNTIME!,{maxConnections:3,prepare:false}); service=new BusinessDayCloseWorkbenchService({database});
    await admin`INSERT INTO tenant(id,slug,name,tier,status) VALUES(${T}::uuid,'o384','Order384','shared','active')`;
    await admin`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
      (${P}::uuid,${T}::uuid,'o384.p1','property','Order384','UTC','USD'),(${P2}::uuid,${T}::uuid,'o384.p2','property','Other','UTC','USD')`;
    await admin`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES
      (${A}::uuid,${T}::uuid,'o384@example.invalid','Order384','active'),(${IA}::uuid,${T}::uuid,'o384i@example.invalid','Inactive','inactive'),
      (${APPROVER}::uuid,${T}::uuid,'o384a@example.invalid','Approver','active')`;
    await admin`INSERT INTO space(id,tenant_id,property_node,code,profile_key,capacity,status) VALUES
      (${S}::uuid,${T}::uuid,${P}::uuid,'384','hotel',1,'active'),
      (${S2}::uuid,${T}::uuid,${P}::uuid,'385','hotel',1,'active')`;
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

  test("excludes a fully coherent source and target carry while retaining an ordinary candidate",async()=>{
    await reset(); await coherentCarry();
    const ordinary="00000000-0000-0000-0000-000000038424";
    await discrepancy(ordinary,"2060-01-01",1,P,S2);
    expect((await service!.read(input("2060-01-01"))).carryCandidates).toEqual([
      {discrepancyId:ordinary,spaceId:S2,spaceCode:"385",reportedBusinessDate:"2060-01-01"},
    ]);
    await day("2060-01-03");
    expect((await service!.read(input("2060-01-02"))).carryCandidates).toEqual([]);
  });

  test("fails D1124 source/target orphan, duplicate and mixed carried evidence closed with zero writes",async()=>{
    const orphan="00000000-0000-0000-0000-000000038425";
    const cases: Array<readonly [string,()=>Promise<void>,string]> = [
      ["source-day carried-only orphan",async()=>{
        await day("2061-01-01"); await day("2061-01-02");
        await discrepancy(orphan,"2061-01-01",0);
        await admin!`INSERT INTO outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,actor_id,correlation_id,payload)
          VALUES(${T}::uuid,${P}::uuid,'2061-01-01','discrepancy',${orphan}::uuid,'discrepancy.carried',${A}::uuid,gen_random_uuid(),'{}')`;
      },"2061-01-01"],
      ["target-day orphan after its otherwise coherent link is absent",async()=>{
        await coherentCarry();
        await admin!`DELETE FROM business_day_discrepancy_carry WHERE tenant_id=${T}::uuid`;
      },"2060-01-01"],
      ["duplicate carried evidence",async()=>{
        await coherentCarry();
        await admin!`INSERT INTO outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,actor_id,correlation_id,payload,created_at)
          VALUES(${T}::uuid,${P}::uuid,'2060-01-02','discrepancy',${CARRY_TARGET}::uuid,'discrepancy.carried',${A}::uuid,gen_random_uuid(),'{}','2060-01-02 04:00:00+00')`;
      },"2060-01-01"],
      ["exact D1124 mixed ordinary plus source-day orphan",async()=>{
        await day("2061-01-01"); await day("2061-01-02");
        await discrepancy(orphan,"2061-01-01");
        await admin!`INSERT INTO outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,actor_id,correlation_id,payload)
          VALUES(${T}::uuid,${P}::uuid,'2061-01-01','discrepancy',${orphan}::uuid,'discrepancy.carried',${A}::uuid,gen_random_uuid(),'{}')`;
      },"2061-01-01"],
    ];
    for (const [name,arrange,selectedDate] of cases) {
      await reset(); await arrange();
      const before=await admin!<Array<{n:number}>>`SELECT
        (SELECT count(*) FROM discrepancy WHERE tenant_id=${T}::uuid)+
        (SELECT count(*) FROM business_day_discrepancy_carry WHERE tenant_id=${T}::uuid)+
        (SELECT count(*) FROM outbox WHERE tenant_id=${T}::uuid) n`;
      await expect(service!.read(input(selectedDate)),name)
        .rejects.toBeInstanceOf(BusinessDayCloseWorkbenchUnavailableError);
      expect(await admin!<Array<{n:number}>>`SELECT
        (SELECT count(*) FROM discrepancy WHERE tenant_id=${T}::uuid)+
        (SELECT count(*) FROM business_day_discrepancy_carry WHERE tenant_id=${T}::uuid)+
        (SELECT count(*) FROM outbox WHERE tenant_id=${T}::uuid) n`).toEqual(before);
    }
  });

  test("permanently rejects D1127 carried evidence whose aggregate and carry link are both absent",async()=>{
    await reset(); await day("2062-01-01"); await day("2062-01-02");
    const missing="00000000-0000-0000-0000-000000038426";
    await admin!`INSERT INTO outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,actor_id,correlation_id,payload)
      VALUES(${T}::uuid,${P}::uuid,'2062-01-01','discrepancy',${missing}::uuid,'discrepancy.carried',${A}::uuid,gen_random_uuid(),'{}')`;
    const before=await admin!<Array<{n:number}>>`SELECT
      (SELECT count(*) FROM discrepancy WHERE tenant_id=${T}::uuid)+
      (SELECT count(*) FROM business_day_discrepancy_carry WHERE tenant_id=${T}::uuid)+
      (SELECT count(*) FROM outbox WHERE tenant_id=${T}::uuid) n`;
    await expect(service!.read(input("2062-01-01")))
      .rejects.toBeInstanceOf(BusinessDayCloseWorkbenchUnavailableError);
    expect(await admin!<Array<{n:number}>>`SELECT
      (SELECT count(*) FROM discrepancy WHERE tenant_id=${T}::uuid)+
      (SELECT count(*) FROM business_day_discrepancy_carry WHERE tenant_id=${T}::uuid)+
      (SELECT count(*) FROM outbox WHERE tenant_id=${T}::uuid) n`).toEqual(before);
  });

  test("rejects selected carried evidence bound to a foreign-property aggregate with zero writes",async()=>{
    await reset(); await day("2062-02-01"); await day("2062-02-02");
    const foreignSpace="00000000-0000-0000-0000-000000038427";
    const foreignDiscrepancy="00000000-0000-0000-0000-000000038428";
    await admin!`INSERT INTO space(id,tenant_id,property_node,code,profile_key,capacity,status)
      VALUES(${foreignSpace}::uuid,${T}::uuid,${P2}::uuid,'386','hotel',1,'active') ON CONFLICT DO NOTHING`;
    await admin!`INSERT INTO discrepancy(id,tenant_id,space_id,reported,system_state,reported_by)
      VALUES(${foreignDiscrepancy}::uuid,${T}::uuid,${foreignSpace}::uuid,'occupied','vacant',${A}::uuid)`;
    await admin!`INSERT INTO outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,actor_id,correlation_id,payload)
      VALUES(${T}::uuid,${P}::uuid,'2062-02-01','discrepancy',${foreignDiscrepancy}::uuid,'discrepancy.carried',${A}::uuid,gen_random_uuid(),'{}')`;
    const before=await admin!<Array<{n:number}>>`SELECT
      (SELECT count(*) FROM discrepancy WHERE tenant_id=${T}::uuid)+
      (SELECT count(*) FROM business_day_discrepancy_carry WHERE tenant_id=${T}::uuid)+
      (SELECT count(*) FROM outbox WHERE tenant_id=${T}::uuid) n`;
    await expect(service!.read(input("2062-02-01")))
      .rejects.toBeInstanceOf(BusinessDayCloseWorkbenchUnavailableError);
    expect(await admin!<Array<{n:number}>>`SELECT
      (SELECT count(*) FROM discrepancy WHERE tenant_id=${T}::uuid)+
      (SELECT count(*) FROM business_day_discrepancy_carry WHERE tenant_id=${T}::uuid)+
      (SELECT count(*) FROM outbox WHERE tenant_id=${T}::uuid) n`).toEqual(before);
  });

  test("turns D1121 and every load-bearing carry mutation into complete-read unavailable",async()=>{
    const mutations = [
      `UPDATE business_day_discrepancy_carry SET discrepancy_state_hash=repeat('a',64) WHERE tenant_id='${T}'`,
      `UPDATE business_day_discrepancy_carry SET request_hash=repeat('b',64) WHERE tenant_id='${T}'`,
      `UPDATE business_day_discrepancy_carry SET reason='changed' WHERE tenant_id='${T}'`,
      `UPDATE business_day_discrepancy_carry SET property_node='${P2}' WHERE tenant_id='${T}'`,
      `UPDATE business_day_discrepancy_carry SET space_id='${S2}' WHERE tenant_id='${T}'`,
      `UPDATE business_day_discrepancy_carry SET source_business_date='2060-01-02' WHERE tenant_id='${T}'`,
      `UPDATE business_day_discrepancy_carry SET target_business_date='2060-01-01' WHERE tenant_id='${T}'`,
      `UPDATE business_day_discrepancy_carry SET request_id=gen_random_uuid() WHERE tenant_id='${T}'`,
      `UPDATE business_day_discrepancy_carry SET requested_by='${APPROVER}',approved_by='${A}' WHERE tenant_id='${T}'`,
      `UPDATE business_day_discrepancy_carry SET approval_requested_at=approval_requested_at+interval '1 microsecond' WHERE tenant_id='${T}'`,
      `UPDATE business_day_discrepancy_carry SET approval_decided_at=approval_decided_at+interval '1 microsecond' WHERE tenant_id='${T}'`,
      `UPDATE business_day_discrepancy_carry SET carried_at=carried_at+interval '1 microsecond' WHERE tenant_id='${T}'`,
      `UPDATE business_day_discrepancy_carry SET target_opened_at=target_opened_at+interval '1 microsecond' WHERE tenant_id='${T}'`,
      `UPDATE discrepancy SET resolved_at=resolved_at+interval '1 microsecond' WHERE id='${CARRY_SOURCE}'`,
      `UPDATE discrepancy SET resolution=NULL WHERE id='${CARRY_SOURCE}'`,
      `UPDATE discrepancy SET reported='vacant' WHERE id='${CARRY_SOURCE}'`,
      `UPDATE discrepancy SET system_state='occupied' WHERE id='${CARRY_SOURCE}'`,
      `UPDATE discrepancy SET reported_by='${APPROVER}' WHERE id='${CARRY_SOURCE}'`,
      `UPDATE discrepancy SET reported_at=reported_at+interval '1 microsecond' WHERE id='${CARRY_SOURCE}'`,
      `UPDATE discrepancy SET space_id='${S2}' WHERE id='${CARRY_SOURCE}'`,
      `UPDATE discrepancy SET reported_at=reported_at+interval '1 microsecond' WHERE id='${CARRY_TARGET}'`,
      `UPDATE discrepancy SET reported_by='${APPROVER}' WHERE id='${CARRY_TARGET}'`,
      `UPDATE discrepancy SET system_state='occupied' WHERE id='${CARRY_TARGET}'`,
      `UPDATE discrepancy SET resolved_at='2060-01-02 04:01:00+00',resolution='carried_forward' WHERE id='${CARRY_TARGET}'`,
      `UPDATE discrepancy SET space_id='${S2}' WHERE id='${CARRY_TARGET}'`,
      `UPDATE approval_request SET kind='wrong' WHERE id='${CARRY_APPROVAL}'`,
      `UPDATE approval_request SET subject_type='wrong' WHERE id='${CARRY_APPROVAL}'`,
      `UPDATE approval_request SET subject_id='${CARRY_TARGET}' WHERE id='${CARRY_APPROVAL}'`,
      `UPDATE approval_request SET requested_by='${APPROVER}' WHERE id='${CARRY_APPROVAL}'`,
      `UPDATE approval_request SET status='rejected' WHERE id='${CARRY_APPROVAL}'`,
      `UPDATE approval_request SET decided_by='${A}' WHERE id='${CARRY_APPROVAL}'`,
      `UPDATE approval_request SET decided_at=decided_at+interval '1 microsecond' WHERE id='${CARRY_APPROVAL}'`,
      `UPDATE approval_request SET created_at=created_at+interval '1 microsecond' WHERE id='${CARRY_APPROVAL}'`,
      `UPDATE approval_request SET payload=payload||'{"requestHash":"${"c".repeat(64)}"}'::jsonb WHERE id='${CARRY_APPROVAL}'`,
      `UPDATE approval_request SET payload=payload-'targetOpenedAt' WHERE id='${CARRY_APPROVAL}'`,
      `UPDATE approval_request SET created_at='2060-01-02 03:30:00+00',decided_at='2060-01-02 03:40:00+00' WHERE id='${CARRY_APPROVAL}'`,
      `UPDATE outbox SET aggregate_type='wrong' WHERE aggregate_id='${CARRY_SOURCE}'`,
      `UPDATE outbox SET aggregate_id='${CARRY_TARGET}' WHERE aggregate_id='${CARRY_SOURCE}'`,
      `UPDATE outbox SET property_node='${P2}' WHERE aggregate_id='${CARRY_SOURCE}'`,
      `UPDATE outbox SET business_date='2060-01-02' WHERE aggregate_id='${CARRY_SOURCE}'`,
      `INSERT INTO outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,actor_id,correlation_id,payload,created_at) SELECT tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,actor_id,gen_random_uuid(),payload,created_at FROM outbox WHERE aggregate_id='${CARRY_SOURCE}'`,
      `UPDATE outbox SET aggregate_type='wrong' WHERE aggregate_id='${CARRY_TARGET}'`,
      `UPDATE outbox SET property_node='${P2}' WHERE aggregate_id='${CARRY_TARGET}'`,
      `UPDATE outbox SET business_date='2060-01-01' WHERE aggregate_id='${CARRY_TARGET}'`,
      `UPDATE outbox SET actor_id='${APPROVER}' WHERE aggregate_id='${CARRY_TARGET}'`,
      `UPDATE outbox SET correlation_id=gen_random_uuid() WHERE aggregate_id='${CARRY_TARGET}'`,
      `UPDATE outbox SET created_at=created_at+interval '1 microsecond' WHERE aggregate_id='${CARRY_TARGET}'`,
      `INSERT INTO outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,actor_id,correlation_id,payload,created_at) SELECT tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,actor_id,gen_random_uuid(),payload,created_at FROM outbox WHERE aggregate_id='${CARRY_TARGET}'`,
    ];
    for (const mutation of mutations) {
      await reset(); await coherentCarry();
      await admin!.unsafe(mutation);
      const before=await admin!<Array<{n:number}>>`SELECT
        (SELECT count(*) FROM discrepancy WHERE tenant_id=${T}::uuid)+
        (SELECT count(*) FROM business_day_discrepancy_carry WHERE tenant_id=${T}::uuid)+
        (SELECT count(*) FROM outbox WHERE tenant_id=${T}::uuid) n`;
      await expect(service!.read(input("2060-01-01"))).rejects.toBeInstanceOf(BusinessDayCloseWorkbenchUnavailableError);
      expect(await admin!<Array<{n:number}>>`SELECT
        (SELECT count(*) FROM discrepancy WHERE tenant_id=${T}::uuid)+
        (SELECT count(*) FROM business_day_discrepancy_carry WHERE tenant_id=${T}::uuid)+
        (SELECT count(*) FROM outbox WHERE tenant_id=${T}::uuid) n`).toEqual(before);
    }
  },30000);

  test("permanently rejects D1121 unresolved source with shape-valid forged hashes",async()=>{
    await reset(); await coherentCarry();
    await admin!.unsafe(`UPDATE discrepancy SET resolved_at='2060-01-02 04:01:00+00',resolution='carried_forward'
       WHERE id='${CARRY_TARGET}';
      UPDATE discrepancy SET resolved_at=NULL,resolution=NULL WHERE id='${CARRY_SOURCE}';
      UPDATE business_day_discrepancy_carry SET discrepancy_state_hash=repeat('a',64),request_hash=repeat('b',64)
       WHERE tenant_id='${T}'`);
    await expect(service!.read(input("2060-01-01")))
      .rejects.toBeInstanceOf(BusinessDayCloseWorkbenchUnavailableError);
  });
});
