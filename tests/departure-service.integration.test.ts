import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { SQL, type TransactionSQL } from "bun";
import { createApp } from "../src/app";
import { BearerTenantResolver, Hs256TokenSigner, LocalLoginService } from "../src/contexts/identity";
import { Database, PostgresIdempotency } from "../src/kernel";
import { DepartureServiceCoordinationService, type DepartureServiceRequest, type DepartureServiceKind } from "../src/contexts/stay-operations";
import { OperatorHttpApi } from "../src/http/operator";

setDefaultTimeout(60000);
// Explicit opt-in and dedicated URLs only: never fall back to the serving database.
const deployUrl=process.env.YELLOW_DEPARTURE_SERVICE_DEPLOY_URL;
const runtimeUrl=process.env.YELLOW_DEPARTURE_SERVICE_RUNTIME_URL;
if(process.env.YELLOW_REQUIRE_DEPARTURE_SERVICE==="1" && (!deployUrl || !runtimeUrl)) throw new Error("Dedicated departure-service proof URLs required");
const suite=deployUrl && runtimeUrl ? describe.serial : describe.skip;
const tenant=crypto.randomUUID(), property=crypto.randomUUID(), actor=crypto.randomUUID(), staff=crypto.randomUUID();
const cashierColleague=crypto.randomUUID();
const role=crypto.randomUUID(), cashier=crypto.randomUUID(), unitType=crypto.randomUUID(), rate=crypto.randomUUID();
const identity={tenantId:tenant,propertyNode:property,actorId:actor};
let admin:SQL; let db:Database;
let loginPool:SQL; let httpTokens:Hs256TokenSigner; let httpApp:ReturnType<typeof createApp>;
const service=new DepartureServiceCoordinationService();
const actionBody=(version:number,staffPartyId:string|null=null,outcome:string|null=null)=>({expectedVersion:version,staffPartyId,outcome});
async function command(reservationId:string,requestId:string|null,action:"propose"|"confirm"|"withdraw"|"assign"|"start"|"complete",body:unknown,key=crypto.randomUUID(),target=identity) {
  return db.withTenantTransaction(target.tenantId,tx=>service.command(tx,target,reservationId,requestId,action,body,key,crypto.randomUUID()));
}
async function stay(departureHours=24) {
  const reservationId=crypto.randomUUID(),segmentId=crypto.randomUUID(),spaceId=crypto.randomUUID(),unit=crypto.randomUUID();
  const start=new Date(Date.now()-86400000).toISOString(),end=new Date(Date.now()+departureHours*3600000).toISOString();
  await admin`INSERT INTO reservation(id,tenant_id,property_node,confirmation_no,status,primary_party,currency)
    VALUES(${reservationId}::uuid,${tenant}::uuid,${property}::uuid,${reservationId},'in_house',${staff}::uuid,'USD')`;
  await admin`INSERT INTO space(id,tenant_id,property_node,code,profile_key,capacity,status)
    VALUES(${spaceId}::uuid,${tenant}::uuid,${property}::uuid,${spaceId},'order593-room',2,'active')`;
  await admin`INSERT INTO sellable_unit(id,tenant_id,unit_type_id,name,status)
    VALUES(${unit}::uuid,${tenant}::uuid,${unitType}::uuid,${unit},'active')`;
  await admin`INSERT INTO sellable_unit_space(tenant_id,sellable_unit_id,space_id,claim_mode)
    VALUES(${tenant}::uuid,${unit}::uuid,${spaceId}::uuid,'exclusive')`;
  await admin`INSERT INTO reservation_segment(id,tenant_id,reservation_id,seq,unit_type_id,sellable_unit_id,period,rate_plan_id,status)
    VALUES(${segmentId}::uuid,${tenant}::uuid,${reservationId}::uuid,1,${unitType}::uuid,${unit}::uuid,
      tstzrange(${start}::timestamptz,${end}::timestamptz,'[)'),${rate}::uuid,'in_house')`;
  await db.withTenantTransaction(tenant,tx=>tx`SELECT public.record_occupancy(${tenant}::uuid,${spaceId}::uuid,
    tstzrange(${start}::timestamptz,${end}::timestamptz,'[)'),${segmentId}::uuid,'segment',true)`);
  return {reservationId,expected:{segmentId,spaceId,departureAt:end}};
}
async function propose(fixture:Awaited<ReturnType<typeof stay>>,kind:DepartureServiceKind="luggage_pickup",parentRequestId:string|null=null,targetRoleId=role) {
 return command(fixture.reservationId,null,"propose",{serviceKind:kind,targetRoleId,parentRequestId,
  schedule:{mode:"immediate",minutes:null,localAt:null,utcOffsetMinutes:null},expected:fixture.expected});
}
async function alternateRoom(fixture:Awaited<ReturnType<typeof stay>>) {
 const movedSpace=crypto.randomUUID(),movedUnit=crypto.randomUUID();
 await admin`INSERT INTO space(id,tenant_id,property_node,code,profile_key,capacity,status)
   VALUES(${movedSpace}::uuid,${tenant}::uuid,${property}::uuid,${movedSpace},'order593-moved-room',2,'active')`;
 await admin`INSERT INTO sellable_unit(id,tenant_id,unit_type_id,name,status)
   VALUES(${movedUnit}::uuid,${tenant}::uuid,${unitType}::uuid,${movedUnit},'active')`;
 await admin`INSERT INTO sellable_unit_space(tenant_id,sellable_unit_id,space_id,claim_mode)
   VALUES(${tenant}::uuid,${movedUnit}::uuid,${movedSpace}::uuid,'exclusive')`;
 const period=(await admin<{period:string}[]>`SELECT period::text FROM reservation_segment WHERE id=${fixture.expected.segmentId}::uuid`)[0]?.period;
 if(!period) throw new Error('Order593 moved-room fixture omitted period');
 return {movedSpace,movedUnit,period};
}
async function counts(reservationId:string) {
 return (await admin`SELECT
  (SELECT count(*)::int FROM task WHERE tenant_id=${tenant}::uuid AND subject_id=${reservationId}::uuid) tasks,
  (SELECT count(*)::int FROM outbox WHERE tenant_id=${tenant}::uuid AND payload @> jsonb_build_object('reservation_id',${reservationId}::uuid)) events,
  (SELECT count(*)::int FROM fact_log WHERE tenant_id=${tenant}::uuid AND payload @> jsonb_build_object('reservation_id',${reservationId}::uuid)) facts`)[0];
}
const allDepartureScopes=[
 "stay-operations.departure-services:read","stay-operations.departure-services:request",
 "stay-operations.departure-services:confirm","stay-operations.departure-services:dispatch",
 "stay-operations.departure-services:work","stay-operations.departure-services:escalate",
];
async function httpToken(scopes:readonly string[]=allDepartureScopes) {
 return httpTokens.issue({userId:actor,tenantId:tenant,scopes});
}
async function httpRequest(path:string,method:"GET"|"POST",body:unknown=undefined,key:string|null=crypto.randomUUID(),
 token:Promise<string>|string=httpToken(),correlation=crypto.randomUUID()) {
 const headers=new Headers({authorization:`Bearer ${await token}`,"x-correlation-id":correlation});
 if(body!==undefined) headers.set("content-type","application/json");
 if(key!==null) headers.set("idempotency-key",key);
 return httpApp.handle(new Request(`http://yellow.test${path}`,{
   method,headers,body:body===undefined?undefined:JSON.stringify(body),
 }));
}
async function reservationLockedRace(
 fixture:Awaited<ReturnType<typeof stay>>,
 requestId:string,
 mutate:(tx:TransactionSQL)=>Promise<void>,
 label:string,
) {
 let release!:()=>void;let locked!:()=>void;
 const acquired=new Promise<void>(resolve=>{locked=resolve;});
 const gate=new Promise<void>(resolve=>{release=resolve;});
 const mutation=admin.begin(async tx=>{
   await tx`SELECT id FROM reservation WHERE id=${fixture.reservationId}::uuid FOR UPDATE`;
   locked();await gate;await mutate(tx);
 });
 await acquired;
 const confirmation=command(fixture.reservationId,requestId,"confirm",actionBody(1));
 await expectLockWait(confirmation,1,label);
 release();
 const [mutationResult,confirmationResult]=await Promise.all([mutation,Promise.allSettled([confirmation])]);
 expect(mutationResult).toBeUndefined();
 return confirmationResult[0];
}
async function expectLockWait(promise:Promise<unknown>,minimum:number,label:string) {
 let settled=false;
 void promise.then(()=>{settled=true;},()=>{settled=true;});
 for(let attempt=0;attempt<100;attempt+=1){
  const waiting=(await admin<{count:number}[]>`SELECT count(*)::int count FROM pg_stat_activity
   WHERE datname=current_database() AND pid<>pg_backend_pid() AND wait_event_type='Lock'`)[0]?.count ?? 0;
  if(waiting>=minimum){expect(settled,label).toBe(false);return;}
  if(settled) throw new Error(`${label} settled before encountering the competing PostgreSQL lock`);
  await Bun.sleep(10);
 }
 throw new Error(`${label} did not expose ${minimum} competing PostgreSQL lock wait(s)`);
}
async function targetRoleLockedRace(
 fixture:Awaited<ReturnType<typeof stay>>,
 requestId:string,
 lockAndMutate:(tx:TransactionSQL,gate:Promise<void>,locked:()=>void)=>Promise<void>,
 label:string,
) {
 let release!:()=>void;let locked!:()=>void;
 const acquired=new Promise<void>(resolve=>{locked=resolve;});
 const gate=new Promise<void>(resolve=>{release=resolve;});
 const mutation=admin.begin(tx=>lockAndMutate(tx,gate,locked));
 await acquired;
 const confirmation=command(fixture.reservationId,requestId,"confirm",actionBody(1));
 await expectLockWait(confirmation,1,label);
 release();
 const [mutationResult,confirmationResult]=await Promise.all([mutation,Promise.allSettled([confirmation])]);
 expect(mutationResult).toBeUndefined();
 return confirmationResult[0];
}
suite("departure-service real PostgreSQL proof",()=>{
 beforeAll(async()=>{
  admin=new SQL(deployUrl!,{prepare:false,max:8}); db=Database.connect(runtimeUrl!,{prepare:false,maxConnections:32});
  loginPool=new SQL(runtimeUrl!,{prepare:false,max:4});
  httpTokens=new Hs256TokenSigner("order593-http-proof-secret-20260922-long-enough");
  httpApp=createApp({database:db,tenantResolver:new BearerTenantResolver(httpTokens),
    operatorApi:new OperatorHttpApi(new LocalLoginService(loginPool,httpTokens))});
  const database=(await admin`SELECT current_database() name`)[0]?.name as string;
  if(!/593|departure|test/i.test(database)) throw new Error("Refusing non-proof database name");
  expect((await admin`SELECT to_regclass('public.departure_service_request') relation`)[0]?.relation).not.toBeNull();
  await admin`INSERT INTO tenant(id,slug,name,tier,status) VALUES(${tenant}::uuid,${tenant},'Order593 synthetic proof','shared','active')`;
  await admin`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency)
   VALUES(${property}::uuid,${tenant}::uuid,${'o593_'+tenant.replaceAll('-','')}::ltree,'property','Order593','UTC','USD')`;
  await admin`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES
   (${actor}::uuid,${tenant}::uuid,${actor+'@example.test'},'Order593 synthetic operator','active'),
   (${cashierColleague}::uuid,${tenant}::uuid,${cashierColleague+'@example.test'},'Order593 synthetic cashier colleague','active')`;
  await admin`INSERT INTO role(id,tenant_id,name) VALUES(${role}::uuid,${tenant}::uuid,'Duty Manager'),(${cashier}::uuid,${tenant}::uuid,'Front Desk Cashier')`;
  for(const permission of ['read','request','confirm','dispatch','work','escalate']) await admin`INSERT INTO role_permission(role_id,permission_code)
   VALUES(${role}::uuid,${'stay-operations.departure-services:'+permission})`;
  await admin`INSERT INTO role_permission(role_id,permission_code) VALUES(${cashier}::uuid,'stay-operations.departure-services:read')`;
  await admin`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node) VALUES
   (${tenant}::uuid,${actor}::uuid,${role}::uuid,${property}::uuid),
   (${tenant}::uuid,${cashierColleague}::uuid,${cashier}::uuid,${property}::uuid)`;
  await admin`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES(${staff}::uuid,${tenant}::uuid,'person','Order593 synthetic staff','active')`;
  await admin`INSERT INTO party_role(tenant_id,party_id,role) VALUES(${tenant}::uuid,${staff}::uuid,'staff')`;
  await admin`INSERT INTO unit_type(id,tenant_id,property_node,code,name,profile_key)
   VALUES(${unitType}::uuid,${tenant}::uuid,${property}::uuid,'O593','Order593','order593-room')`;
  await admin`INSERT INTO rate_plan(id,tenant_id,property_node,code,name,currency,tax_inclusive)
   VALUES(${rate}::uuid,${tenant}::uuid,${property}::uuid,'O593','Order593','USD',false)`;
 });
 afterAll(async()=>{await db?.close();await loginPool?.close({timeout:0});await admin?.close({timeout:0});});
 test("proposal has no operational task; mixed-key twenty-way confirmation creates one task/fact/event",async()=>{
  const f=await stay(),p=await propose(f); expect(p.request.proposalStatus).toBe('pending');
  expect(await counts(f.reservationId)).toEqual({tasks:0,events:0,facts:1});
  const results=await Promise.allSettled(Array.from({length:20},()=>command(f.reservationId,p.request.requestId,'confirm',actionBody(1))));
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  expect(await counts(f.reservationId)).toEqual({tasks:1,events:1,facts:2});
 });
 test("exact replay, changed request/actor conflict, and expired idempotency cannot duplicate confirmation",async()=>{
  const f=await stay(),p=await propose(f),key=crypto.randomUUID();
  const first=await command(f.reservationId,p.request.requestId,'confirm',actionBody(1),key);
  expect((await command(f.reservationId,p.request.requestId,'confirm',actionBody(1),key)).replayed).toBe(true);
  await expect(command(f.reservationId,p.request.requestId,'confirm',actionBody(2),key)).rejects.toThrow();
  await expect(command(f.reservationId,p.request.requestId,'confirm',actionBody(1),key,{...identity,actorId:crypto.randomUUID()})).rejects.toThrow();
  const afterRetention=new DepartureServiceCoordinationService(new PostgresIdempotency({now:()=>new Date(Date.now()+25*3600000)}));
  await expect(db.withTenantTransaction(tenant,tx=>afterRetention.command(tx,identity,f.reservationId,p.request.requestId,
    'confirm',actionBody(1),key,crypto.randomUUID()))).rejects.toThrow();
  expect(first.request.taskId).toBeString();expect(await counts(f.reservationId)).toEqual({tasks:1,events:1,facts:2});
 });
 test("all services progress; physical outcomes only for checks; escalation role does not need work permission",async()=>{
  const f=await stay();
  for(const kind of ['luggage_pickup','minibar_check','room_inspection'] as const){
   const proposal=await propose(f,kind);let r=(await command(f.reservationId,proposal.request.requestId,'confirm',actionBody(1))).request;
   if(kind==='luggage_pickup'){
    const escalation=await propose(f,'escalation',r.requestId,cashier);
    let e=(await command(f.reservationId,escalation.request.requestId,'confirm',actionBody(1))).request;
    e=(await command(f.reservationId,e.requestId,'assign',actionBody(e.version,staff))).request;
    e=(await command(f.reservationId,e.requestId,'start',actionBody(e.version))).request;
    expect((await command(f.reservationId,e.requestId,'complete',actionBody(e.version))).request.outcome).toBeNull();
   }
   const attempts=await Promise.allSettled(Array.from({length:20},()=>command(f.reservationId,r.requestId,'assign',actionBody(r.version,staff))));
   expect(attempts.filter(x=>x.status==='fulfilled')).toHaveLength(1);
   r=(attempts.find(x=>x.status==='fulfilled') as PromiseFulfilledResult<{request:DepartureServiceRequest}>).value.request;
   r=(await command(f.reservationId,r.requestId,'start',actionBody(r.version))).request;
   if(kind!=='luggage_pickup') await expect(command(f.reservationId,r.requestId,'complete',actionBody(r.version))).rejects.toThrow();
   r=(await command(f.reservationId,r.requestId,'complete',actionBody(r.version,null,kind==='luggage_pickup'?null:'finding_reported'))).request;
   expect(r.taskStatus).toBe('done');expect(r.completedAt).toBeString();
  }
  expect((await admin`SELECT status FROM reservation WHERE id=${f.reservationId}::uuid`)[0]?.status).toBe('in_house');
  expect((await admin`SELECT count(*)::int n FROM unit_condition WHERE space_id=${f.expected.spaceId}::uuid`)[0]?.n).toBe(0);
  expect((await admin`SELECT count(*)::int n FROM journal WHERE tenant_id=${tenant}::uuid`)[0]?.n).toBe(0);
  expect((await admin`SELECT count(*)::int n FROM space_occupancy WHERE slot_ref=${f.expected.segmentId}::uuid`)[0]?.n).toBe(1);
 });
 test("withdrawal, expiry, changed stay and role removal invalidate pending confirmation",async()=>{
  for(const change of ['withdraw','expiry','checkout','departure','role'] as const){
   const f=await stay(),p=await propose(f,'luggage_pickup',null,cashier);
   if(change==='withdraw') await command(f.reservationId,p.request.requestId,'withdraw',actionBody(1));
   if(change==='expiry') await admin`UPDATE departure_service_request SET expires_at=clock_timestamp()-interval '1 second' WHERE id=${p.request.requestId}::uuid`;
   if(change==='checkout') await admin`UPDATE reservation SET status='checked_out' WHERE id=${f.reservationId}::uuid`;
   if(change==='departure') await admin`UPDATE reservation_segment SET period=tstzrange(lower(period),upper(period)+interval '1 hour','[)') WHERE id=${f.expected.segmentId}::uuid`;
   if(change==='role') await admin`DELETE FROM user_role WHERE role_id=${cashier}::uuid AND user_id=${cashierColleague}::uuid`;
   await expect(command(f.reservationId,p.request.requestId,'confirm',actionBody(1))).rejects.toThrow();
   expect((await counts(f.reservationId)).tasks).toBe(0);
   if(change==='role') await admin`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node) VALUES(${tenant}::uuid,${cashierColleague}::uuid,${cashier}::uuid,${property}::uuid)`;
 }
 });
 test("mounted HTTP journey enforces body/scope/property/idempotency contracts and minimizes the queue",async()=>{
  const f=await stay();
  const reservationPath=`/api/v1/properties/${property}/reservations/${f.reservationId}/departure-services`;
  const full=await httpToken();
  const noRead=await httpToken(["stay-operations.departure-services:request"]);
  let response=await httpRequest(`/api/v1/properties/${property}/departure-services`,"GET",undefined,undefined,noRead);
  expect(response.status).toBe(403);
  response=await httpRequest(`/api/v1/properties/${crypto.randomUUID()}/departure-services`,"GET",undefined,undefined,full);
  expect(response.status).toBe(404);
  const proposal={serviceKind:"luggage_pickup",targetRoleId:role,parentRequestId:null,
   schedule:{mode:"immediate",minutes:null,localAt:null,utcOffsetMinutes:null},expected:f.expected};
  response=await httpRequest(`${reservationPath}/proposals`,"POST",proposal,null,full);
  expect(response.status).toBe(400);
  expect((await response.json()).type).toBe("request/invalid");
  response=await httpRequest(`${reservationPath}/proposals`,"POST",{...proposal,surplus:"reject-me"},crypto.randomUUID(),full);
  expect(response.status).toBe(400);
  expect((await response.json()).type).toBe("departure-services/invalid");
  const correlation=crypto.randomUUID(),proposalKey=crypto.randomUUID();
  response=await httpRequest(`${reservationPath}/proposals`,"POST",proposal,proposalKey,full,correlation);
  expect(response.status).toBe(201);
  expect(response.headers.get("idempotency-replayed")).toBe("false");
  expect(response.headers.get("x-correlation-id")).toBe(correlation);
  const created=await response.json() as {request:DepartureServiceRequest;replayed:boolean};
  expect(created.replayed).toBe(false);
  expect(created.request.proposalStatus).toBe("pending");
  const requestKeys=Object.keys(created.request).sort();
  expect(requestKeys).toEqual([
   "assigneePartyId","completedAt","departureAt","dueAt","dueLocal","eligibleActions","expiresAt",
   "outcome","parentRequestId","proposalStatus","requestId","reservationId","serviceKind","segmentId",
   "spaceId","targetRoleId","targetRoleName","taskId","taskStatus","timezone","version",
  ].sort());
  expect(JSON.stringify(created)).not.toMatch(/guest|email|phone|payload/i);
  response=await httpRequest(`${reservationPath}/${created.request.requestId}/confirm`,"POST",actionBody(2),crypto.randomUUID(),full);
  expect(response.status).toBe(409);
  expect((await response.json()).type).toBe("departure-services/conflict");
  const confirmKey=crypto.randomUUID();
  response=await httpRequest(`${reservationPath}/${created.request.requestId}/confirm`,"POST",actionBody(1),confirmKey,full);
  expect(response.status).toBe(200);
  expect(response.headers.get("idempotency-replayed")).toBe("false");
  response=await httpRequest(`${reservationPath}/${created.request.requestId}/confirm`,"POST",actionBody(1),confirmKey,full);
  expect(response.status).toBe(200);
  expect(response.headers.get("idempotency-replayed")).toBe("true");
  response=await httpRequest(`/api/v1/properties/${property}/departure-services`,"GET",undefined,undefined,full);
  expect(response.status).toBe(200);
  const queue=await response.json() as {requests:DepartureServiceRequest[];roles:{roleId:string;name:string}[];staff:{partyId:string;name:string}[]};
  expect(queue.requests.length).toBeGreaterThanOrEqual(1);
  expect(queue.requests.some(item=>item.requestId===created.request.requestId && item.proposalStatus==="confirmed")).toBe(true);
  expect(queue.roles.map(item=>item.name)).toEqual(["Duty Manager","Front Desk Cashier"]);
  expect(queue.staff).toEqual([{partyId:staff,name:"Order593 synthetic staff"}]);
  expect(JSON.stringify(queue)).not.toMatch(/guest|email|phone|payload/i);
 });
 test("confirmation races amendment, room move, expiry, withdrawal, and grant revocation without partial evidence",async()=>{
  const staleCases:[string,(fixture:Awaited<ReturnType<typeof stay>>,requestId:string)=>Promise<PromiseSettledResult<unknown>>][]=[];
  staleCases.push(["departure amendment",async(f,requestId)=>reservationLockedRace(f,requestId,async tx=>{
   await tx`SELECT public.release_occupancy(${tenant}::uuid,${f.expected.segmentId}::uuid)`;
   await tx`UPDATE reservation_segment SET period=tstzrange(lower(period),upper(period)+interval '1 hour','[)')
    WHERE tenant_id=${tenant}::uuid AND reservation_id=${f.reservationId}::uuid AND id=${f.expected.segmentId}::uuid`;
   await tx`SELECT public.record_occupancy(${tenant}::uuid,${f.expected.spaceId}::uuid,
    (SELECT period FROM reservation_segment WHERE id=${f.expected.segmentId}::uuid),${f.expected.segmentId}::uuid,'segment',true)`;
  },"confirmation versus departure amendment")]);
  staleCases.push(["room move",async(f,requestId)=>{
   const moved=await alternateRoom(f);
   return reservationLockedRace(f,requestId,async tx=>{
    await tx`SELECT public.release_occupancy(${tenant}::uuid,${f.expected.segmentId}::uuid)`;
    await tx`UPDATE reservation_segment SET sellable_unit_id=${moved.movedUnit}::uuid
     WHERE tenant_id=${tenant}::uuid AND reservation_id=${f.reservationId}::uuid AND id=${f.expected.segmentId}::uuid`;
    await tx`SELECT public.record_occupancy(${tenant}::uuid,${moved.movedSpace}::uuid,
     (SELECT period FROM reservation_segment WHERE id=${f.expected.segmentId}::uuid),${f.expected.segmentId}::uuid,'segment',true)`;
   },"confirmation versus room move");
  }]);
  staleCases.push(["expiry",async(f,requestId)=>reservationLockedRace(f,requestId,tx=>tx`UPDATE departure_service_request
   SET expires_at=clock_timestamp()-interval '1 second' WHERE tenant_id=${tenant}::uuid AND id=${requestId}::uuid`,
   "confirmation versus expiry")]);
  for(const [label,race] of staleCases){
   const f=await stay(),p=await propose(f,"luggage_pickup");
   const result=await race(f,p.request.requestId);
   expect(result.status,label).toBe("rejected");
   expect((await counts(f.reservationId)).tasks,label).toBe(0);
   expect((await counts(f.reservationId)).events,label).toBe(0);
   expect((await counts(f.reservationId)).facts,label).toBe(1);
  }
  const withdrawal=await stay(),withdrawProposal=await propose(withdrawal,"luggage_pickup");
  let releaseGuard!:()=>void;let guardLocked!:()=>void;
  const guardAcquired=new Promise<void>(resolve=>{guardLocked=resolve;});
  const guardGate=new Promise<void>(resolve=>{releaseGuard=resolve;});
  const guard=admin.begin(async tx=>{
   await tx`SELECT id FROM reservation WHERE tenant_id=${tenant}::uuid AND id=${withdrawal.reservationId}::uuid FOR UPDATE`;
   guardLocked();await guardGate;
  });
  await guardAcquired;
  const confirming=command(withdrawal.reservationId,withdrawProposal.request.requestId,"confirm",actionBody(1));
  const withdrawing=command(withdrawal.reservationId,withdrawProposal.request.requestId,"withdraw",actionBody(1));
  const contenders=Promise.allSettled([confirming,withdrawing]);
  await expectLockWait(contenders,2,"confirmation versus withdrawal");
  releaseGuard();await guard;
  const [confirmResult,withdrawResult]=await Promise.allSettled([
   confirming,withdrawing,
  ]);
  expect([confirmResult,withdrawResult].filter(result=>result.status==="fulfilled")).toHaveLength(1);
  const withdrawalCounts=await counts(withdrawal.reservationId);
  expect(withdrawalCounts.tasks).toBe(confirmResult.status==="fulfilled"?1:0);
  expect(withdrawalCounts.events).toBe(confirmResult.status==="fulfilled"?1:0);
  expect(withdrawalCounts.facts).toBe(2);
  const roleRaces=[
   {label:"target colleague deactivation",
    race:(f:Awaited<ReturnType<typeof stay>>,requestId:string)=>targetRoleLockedRace(f,requestId,async(tx,gate,locked)=>{
     await tx`SELECT id FROM app_user WHERE tenant_id=${tenant}::uuid AND id=${cashierColleague}::uuid FOR UPDATE`;
     locked();await gate;
     await tx`UPDATE app_user SET status='disabled' WHERE tenant_id=${tenant}::uuid AND id=${cashierColleague}::uuid`;
   },"confirmation versus target colleague deactivation"),
    assertMutation:async()=>expect((await admin`SELECT status FROM app_user WHERE id=${cashierColleague}::uuid`)[0]?.status).toBe("disabled"),
    restore:()=>admin`UPDATE app_user SET status='active' WHERE tenant_id=${tenant}::uuid AND id=${cashierColleague}::uuid`},
   {label:"target property membership revocation",
    race:(f:Awaited<ReturnType<typeof stay>>,requestId:string)=>targetRoleLockedRace(f,requestId,async(tx,gate,locked)=>{
     await tx`SELECT role_id FROM user_role WHERE tenant_id=${tenant}::uuid AND user_id=${cashierColleague}::uuid
      AND role_id=${cashier}::uuid AND scope_node=${property}::uuid FOR UPDATE`;
     locked();await gate;
     await tx`DELETE FROM user_role WHERE tenant_id=${tenant}::uuid AND user_id=${cashierColleague}::uuid
      AND role_id=${cashier}::uuid AND scope_node=${property}::uuid`;
    },"confirmation versus target property membership revocation"),
    assertMutation:async()=>expect((await admin`SELECT count(*)::int n FROM user_role WHERE tenant_id=${tenant}::uuid
     AND user_id=${cashierColleague}::uuid AND role_id=${cashier}::uuid AND scope_node=${property}::uuid`)[0]?.n).toBe(0),
    restore:()=>admin`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node) VALUES
     (${tenant}::uuid,${cashierColleague}::uuid,${cashier}::uuid,${property}::uuid)`},
   {label:"target role read-grant removal",
    race:(f:Awaited<ReturnType<typeof stay>>,requestId:string)=>targetRoleLockedRace(f,requestId,async(tx,gate,locked)=>{
     await tx`SELECT role_id FROM role_permission WHERE role_id=${cashier}::uuid
      AND permission_code='stay-operations.departure-services:read' FOR UPDATE`;
     locked();await gate;
     await tx`DELETE FROM role_permission WHERE role_id=${cashier}::uuid
      AND permission_code='stay-operations.departure-services:read'`;
    },"confirmation versus target role read-grant removal"),
    assertMutation:async()=>expect((await admin`SELECT count(*)::int n FROM role_permission WHERE role_id=${cashier}::uuid
     AND permission_code='stay-operations.departure-services:read'`)[0]?.n).toBe(0),
    restore:()=>admin`INSERT INTO role_permission(role_id,permission_code)
     VALUES(${cashier}::uuid,'stay-operations.departure-services:read')`},
  ];
  for(const roleRace of roleRaces){
   const f=await stay(),p=await propose(f,"luggage_pickup",null,cashier);
   try {
    const result=await roleRace.race(f,p.request.requestId);
    expect(result?.status,roleRace.label).toBe("rejected");
    await roleRace.assertMutation();
    expect(await counts(f.reservationId),roleRace.label).toEqual({tasks:0,events:0,facts:1});
   } finally {await roleRace.restore();}
  }
 });
 test("SQL/session/raw-DML authority and foreign property are denied",async()=>{
  const f=await stay();
  await expect((async()=>await admin`SELECT command_departure_service(${tenant}::uuid,${property}::uuid,${f.reservationId}::uuid,NULL,
   ${actor}::uuid,${crypto.randomUUID()}::uuid,'propose','{}'::jsonb)`)()).rejects.toThrow();
  for(const table of ['task','departure_service_request']) await expect(db.withTenantTransaction(tenant,tx=>tx.unsafe(`DELETE FROM public.${table} WHERE false`))).rejects.toThrow();
  await expect(db.withTenantTransaction(tenant,tx=>service.list(tx,{...identity,propertyNode:crypto.randomUUID()},f.reservationId))).rejects.toThrow();
  await expect(db.withTenantTransaction(crypto.randomUUID(),tx=>service.list(tx,identity,f.reservationId))).rejects.toThrow();
 });
 test("canonical reads expose exact property evidence and admitted read-only routing roles",async()=>{
  const f=await stay(),p=await propose(f);
  const overview=await db.withTenantTransaction(tenant,tx=>service.list(tx,identity,f.reservationId));
  expect(overview.requests[0]?.requestId).toBe(p.request.requestId);
  expect(overview.roles.map(r=>r.name)).toEqual(['Duty Manager','Front Desk Cashier']);
  expect(overview.staff).toEqual([{partyId:staff,name:'Order593 synthetic staff'}]);
  expect('evidence' in overview && overview.evidence).toMatchObject({segmentId:f.expected.segmentId,spaceId:f.expected.spaceId});
  expect((await db.withTenantTransaction(tenant,tx=>service.list(tx,identity,null))).requests.every(r=>r.proposalStatus==='confirmed')).toBe(true);
 });
 test("SQL rejects nested surplus authority, past-window immediate, invalid offsets and arbitrary roles",async()=>{
  const f=await stay(); const input={serviceKind:'luggage_pickup',targetRoleId:role,parentRequestId:null,
   schedule:{mode:'immediate',minutes:null,localAt:null,utcOffsetMinutes:null},expected:f.expected};
  for(const body of [{...input,expected:{...f.expected,guest:'injected'}},
   {...input,schedule:{...input.schedule,amount:12}},
   {...input,schedule:{mode:'custom',minutes:null,localAt:'2026-09-22T12:00',utcOffsetMinutes:330}}]) {
   await expect(db.withTenantTransaction(tenant,tx=>tx`SELECT command_departure_service(${tenant}::uuid,${property}::uuid,
    ${f.reservationId}::uuid,NULL,${actor}::uuid,${crypto.randomUUID()}::uuid,'propose',${JSON.stringify(body)}::jsonb)`)).rejects.toThrow();
  }
  await expect(propose(await stay(-7))).rejects.toThrow();
  const arbitrary=crypto.randomUUID();
  await admin`INSERT INTO role(id,tenant_id,name) VALUES(${arbitrary}::uuid,${tenant}::uuid,'Not A Duty Role')`;
  await admin`INSERT INTO role_permission(role_id,permission_code) VALUES(${arbitrary}::uuid,'stay-operations.departure-services:read')`;
  await admin`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node) VALUES(${tenant}::uuid,${actor}::uuid,${arbitrary}::uuid,${property}::uuid)`;
  await expect(propose(f,'luggage_pickup',null,arbitrary)).rejects.toThrow();
  expect((await counts(f.reservationId)).tasks).toBe(0);
 });
 test("start and complete contenders preserve adjacent states and inactive staff is revalidated",async()=>{
  const f=await stay(),p=await propose(f,'room_inspection');
  let r=(await command(f.reservationId,p.request.requestId,'confirm',actionBody(1))).request;
  r=(await command(f.reservationId,r.requestId,'assign',actionBody(r.version,staff))).request;
  await admin`UPDATE party SET status='anonymised' WHERE id=${staff}::uuid`;
  await expect(command(f.reservationId,r.requestId,'start',actionBody(r.version))).rejects.toThrow();
  await admin`UPDATE party SET status='active' WHERE id=${staff}::uuid`;
  for(const action of ['start','complete'] as const){
   const attempts=await Promise.allSettled(Array.from({length:20},()=>command(f.reservationId,r.requestId,action,
     actionBody(r.version,null,action==='complete'?'unable_to_complete':null))));
   expect(attempts.filter(x=>x.status==='fulfilled')).toHaveLength(1);
   r=(attempts.find(x=>x.status==='fulfilled') as PromiseFulfilledResult<{request:DepartureServiceRequest}>).value.request;
  }
  expect(r.taskStatus).toBe('done');expect(r.outcome).toBe('unable_to_complete');
 });
 test("confirmation waits behind checkout, then rejects; confirmed work can finish after checkout",async()=>{
  const f=await stay(),p=await propose(f);let release!:()=>void;let locked!:()=>void;
  const acquired=new Promise<void>(resolve=>{locked=resolve;});const gate=new Promise<void>(resolve=>{release=resolve;});
  const checkout=admin.begin(async tx=>{
   await tx`SELECT id FROM reservation WHERE id=${f.reservationId}::uuid FOR UPDATE`;locked();await gate;
   await tx`UPDATE reservation SET status='checked_out' WHERE id=${f.reservationId}::uuid`;
  });
  await acquired;
  const confirmation=command(f.reservationId,p.request.requestId,'confirm',actionBody(1));
  const observed=confirmation.then(()=>false,()=>true);release();await checkout;expect(await observed).toBe(true);
  expect((await counts(f.reservationId)).tasks).toBe(0);
  const kept=await stay(),kp=await propose(kept);let r=(await command(kept.reservationId,kp.request.requestId,'confirm',actionBody(1))).request;
  await admin`UPDATE reservation SET status='checked_out' WHERE id=${kept.reservationId}::uuid`;
  r=(await command(kept.reservationId,r.requestId,'assign',actionBody(r.version,staff))).request;
  r=(await command(kept.reservationId,r.requestId,'start',actionBody(r.version))).request;
  expect((await command(kept.reservationId,r.requestId,'complete',actionBody(r.version))).request.taskStatus).toBe('done');
  await expect(propose(kept,'minibar_check')).rejects.toThrow();
 });
 test("outbox error rolls back request/task/fact/idempotency and exact retry succeeds",async()=>{
  const f=await stay(),p=await propose(f),key=crypto.randomUUID();const before=await counts(f.reservationId);
  const trigger='departure_service_fail_'+tenant.replaceAll('-','');
  await admin.unsafe(`CREATE FUNCTION public.${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${tenant}'::uuid AND NEW.payload @> jsonb_build_object('reservation_id','${f.reservationId}'::uuid) THEN RAISE EXCEPTION 'Order593 injected publication failure'; END IF; RETURN NEW; END $$`);
  await admin.unsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON public.outbox FOR EACH ROW EXECUTE FUNCTION public.${trigger}()`);
  try {await expect(command(f.reservationId,p.request.requestId,'confirm',actionBody(1),key)).rejects.toThrow('Order593 injected publication failure');}
  finally {await admin.unsafe(`DROP TRIGGER ${trigger} ON public.outbox`);await admin.unsafe(`DROP FUNCTION public.${trigger}()`);}
  expect(await counts(f.reservationId)).toEqual(before);
  expect((await command(f.reservationId,p.request.requestId,'confirm',actionBody(1),key)).replayed).toBe(false);
 });
});
