// Synthetic loopback-only Order690 UI fixture. It never proxies or forwards requests.
import { resolve, sep } from "node:path";
const root = resolve(import.meta.dir, "../../../public/yellow-next");
// The SPA's showcase-property selector accepts this ID; every record remains synthetic.
const property = "6081b544-22a1-534f-a86d-bb1ae0519e14";
const reservationId = "69000000-0000-4000-8000-000000000002";
const partyId = "69000000-0000-4000-8000-000000000003";
const taskId = "69000000-0000-4000-8000-000000000004";
const staffId = "69000000-0000-4000-8000-000000000005";
const unitId = "69000000-0000-4000-8000-000000000006";
const typeId = "69000000-0000-4000-8000-000000000007";
const segmentId = "69000000-0000-4000-8000-000000000008";
const rateId = "69000000-0000-4000-8000-000000000009";
type Travel = {mode:string|null;carrier:string|null;serviceNo:string|null;scheduledAt:string|null;pickupRequested:boolean};
let scenario = "success";
let travel: Travel | null = null;
let linked = false;
let taskStatus: "open"|"assigned"|"in_progress"|"done" = "open";
let assignee: string | null = null;
let writes: {path:string; method:string; body:string; key:string|null}[] = [];
const json = (body: unknown, status = 200) => Response.json(body, {status});
const task = () => ({taskId,reservationId,confirmationNo:"Y-690-PROOF",status:taskStatus,dueAt:travel?.scheduledAt??"2026-09-25T11:00:00.000Z",priority:1,createdAt:"2026-09-24T00:00:00.000Z",completedAt:taskStatus==="done"?"2026-09-25T11:10:00.000Z":null,assigneePartyId:assignee,eligibleAction:taskStatus==="open"?"assign":taskStatus==="assigned"?"start":taskStatus==="in_progress"?"complete":null});
const detail = () => ({actions:{canCancel:false,canManageAlerts:false,canModify:true,canOpenPrimaryFolio:false,canReinstate:false},reservation:{
  reservationId,primaryPartyId:partyId,confirmationNo:"Y-690-PROOF",status:"due_in",channelCode:"direct",currency:"INR",
  bookerPartyId:null,groupId:null,marketCode:null,sourceCode:null,originCode:null,guaranteePolicyId:null,eta:null,etd:null,notes:null,
  createdAt:"2026-09-24T00:00:00.000Z",cancelledAt:null,cancelReason:null,cancellationNo:null,
  guests:[{partyId,displayName:"Synthetic Guest 690",role:"primary",sharePct:null}],
  segments:[{segmentId,sequence:1,unitTypeId:typeId,sellableUnitId:unitId,ratePlanId:rateId,from:"2026-09-25T15:00:00.000000Z",to:"2026-09-26T11:00:00.000000Z",adults:1,childAges:[],priceOverride:null,status:"booked"}],
  folios:[],alerts:[],travel:travel?[{travelId:"69000000-0000-4000-8000-000000000010",direction:"arrival",...travel,pickupTaskId:linked?taskId:null,notes:null}]:[],history:[]
}});
const server = Bun.serve({hostname:"127.0.0.1",port:4175,async fetch(request) {
  const url = new URL(request.url), path = url.pathname;
  if (path === "/__proof/reset") {scenario=url.searchParams.get("scenario")??"success";travel=null;linked=false;taskStatus="open";assignee=null;writes=[];return json({scenario});}
  if (path === "/__proof/link") {if(!travel?.pickupRequested)return json({detail:"Pickup intent not recorded"},409);linked=true;return json({linked:true});}
  if (path === "/__proof/status") return json({scenario,travel,linked,taskStatus,assignee,writes});
  if (path.endsWith("/auth/demo:enter")) return json({accessToken:"«REDACTED-SECRET»"});
  if (path.endsWith("/me/properties")) return json({properties:[{id:property,name:"Synthetic arrival hotel",timezone:"Asia/Kolkata"}]});
  if (path.endsWith("/reservation-board")) return json({reservations:[],nextCursor:null});
  if (path.endsWith("/group-blocks")) return json({groups:[]});
  if (path.endsWith("/parties:search")) return json({profiles:[{partyId:staffId,displayName:"Synthetic Driver 690",legalName:null,kind:"person",status:"active",roles:["staff"],contacts:[]}]});
  if (path.endsWith(`/reservations/${reservationId}/travel/arrival`) && request.method === "PUT") {
    const body = await request.text(); writes.push({path,method:"PUT",body,key:request.headers.get("idempotency-key")});
    if (scenario === "denial") return json({detail:"Synthetic scope denied"},403);
    if (scenario === "conflict") return json({detail:"Synthetic stale expected tuple"},409);
    if (scenario === "unknown-retry" && writes.length === 1) return json({detail:"Synthetic response lost before commit"},503);
    const input = JSON.parse(body) as {expected:Travel|null;travel:Travel};
    if (JSON.stringify(input.expected) !== JSON.stringify(travel)) return json({detail:"Synthetic tuple conflict"},409);
    travel = input.travel;
    if (scenario === "instant-link" && travel.pickupRequested) linked = true;
    return json({travel:{reservationId,status:"due_in",direction:"arrival",travel,changed:true}});
  }
  const taskAction = new RegExp(`/reservations/${reservationId}/arrival-pickup-task/${taskId}/(assign|start|complete)$`).exec(path);
  if (taskAction && request.method === "POST") {
    const action=taskAction[1], body=await request.text(); writes.push({path,method:"POST",body,key:request.headers.get("idempotency-key")});
    const input=JSON.parse(body) as {expectedTaskStatus:string;expectedAssigneePartyId:string|null;staffPartyId?:string};
    if (!linked || taskStatus!==input.expectedTaskStatus || assignee!==input.expectedAssigneePartyId) return json({detail:"Synthetic stale task"},409);
    if (action==="assign" && taskStatus==="open" && input.staffPartyId===staffId) {taskStatus="assigned";assignee=staffId;}
    else if (action==="start" && taskStatus==="assigned") taskStatus="in_progress";
    else if (action==="complete" && taskStatus==="in_progress") taskStatus="done";
    else return json({detail:"Synthetic task action denied"},409);
    return json({taskId,reservationId,taskStatus,assigneePartyId:assignee,completedAt:task().completedAt,eligibleAction:task().eligibleAction,replayed:false});
  }
  if (path.endsWith(`/reservations/${reservationId}/arrival-pickup-task/${taskId}`)) return linked?json({pickupTask:task()}):json({detail:"Task not linked"},404);
  if (path.endsWith(`/reservations/${reservationId}`)) return json(detail());
  if (path.endsWith("/check-in/readiness")) return json({canCheckIn:false,blockers:["identity_evidence_missing"],roomCondition:"inspected",primaryFolioId:null,identityGate:{satisfied:false,requirements:[]}});
  if (path.endsWith("/reservation-segments")) return json({reservationId,confirmationNo:"Y-690-PROOF",status:"due_in",segments:[]});
  if (path.startsWith("/api/")) return json({detail:"Unsupported synthetic route; no forwarding"},404);
  const relative=path.startsWith("/yellow-next/assets/")?path.slice("/yellow-next/".length):"index.html";
  const target=resolve(root,relative);
  if (!target.startsWith(root+sep)) return new Response("Forbidden",{status:403});
  const file=Bun.file(target); return await file.exists()?new Response(file):new Response("Not found",{status:404});
}});
console.log(`Order690 synthetic only: http://127.0.0.1:${server.port}/p/${property}/res/${reservationId}`);
