// Loopback-only actual built React UI with synthetic hotel commands. Never proxies writes.
import { resolve, sep } from "node:path";
const root = resolve(import.meta.dir, "../../../public/yellow-next");
const property = "6081b544-22a1-534f-a86d-bb1ae0519e14";
const id = (n: number) => `68300000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const [reservationId, partyId, unitId, rateId, typeId, segmentId] = [1,2,3,4,5,6].map(id) as [string,string,string,string,string,string];
let scenario = "success", searches = 0, writes: { body: string; key: string | null }[] = [], assigned = true;
let releaseAction: (() => void) | undefined;
let stay = { from: "2026-09-24T15:00:00.000Z", to: "2026-09-25T11:00:00.000Z" };
const json = (body: unknown, status = 200) => Response.json(body, { status });
const detail = () => ({ actions: { canCancel: false, canManageAlerts: false, canModify: false, canOpenPrimaryFolio: false, canReinstate: false }, reservation: {
  reservationId, primaryPartyId: partyId, confirmationNo: "Y-683-PROOF", status: "due_in", channelCode: "direct", currency: "INR",
  bookerPartyId:null,groupId:null,marketCode:null,sourceCode:null,originCode:null,guaranteePolicyId:null,eta:null,etd:null,notes:null,createdAt:"2026-09-24T00:00:00.000Z",cancelledAt:null,cancelReason:null,cancellationNo:null,
  guests: [{partyId,displayName:"Synthetic Guest 683",role:"primary",sharePct:null}],
  segments: [{ segmentId,sequence:1,unitTypeId:typeId,sellableUnitId:assigned?unitId:null,ratePlanId:rateId,from:stay.from.replace(".000Z",".000000Z"),to:stay.to.replace(".000Z",".000000Z"),adults:1,childAges:[],priceOverride:null,status:"booked" }],
  folios:[],alerts:[],travel:[],history:[]
} });
const server = Bun.serve({hostname:"127.0.0.1",port:4174, async fetch(request) {
  const url = new URL(request.url), path = url.pathname;
  if(path==="/__proof/reset") {scenario=url.searchParams.get("scenario")??"success";searches=0;writes=[];assigned=scenario!=="unassigned";return json({scenario});}
  if(path==="/__proof/status") return json({scenario,searches,writes,assigned});
  if(path==="/__proof/release") { releaseAction?.(); return json({released:true}); }
  if(path.endsWith("/auth/demo:enter"))return json({accessToken:"«REDACTED-SECRET»"});
  if(path.endsWith("/me/properties"))return json({properties:[{id:property,name:"Synthetic review hotel",timezone:"UTC"}]});
  if(path.endsWith("/reservation-board"))return json({reservations:[],nextCursor:null});
  if(path.endsWith("/group-blocks"))return json({groups:[]});
  if(path.endsWith("/parties:search"))return json({profiles:[{partyId,displayName:"Synthetic Guest 683",legalName:null,kind:"person",status:"active",roles:["guest"],contacts:[]}]});
  if(path.endsWith("/availability:search")) {
    searches++; const input=await request.json() as {stay:typeof stay}; stay=input.stay;
    return json({options:writes.length?[]:[{option_ref:`fresh-ref-${searches}`,bookable:true,sellable_unit:{id:unitId,name:"Deluxe King 107"},unit_type:{code:"DLX"},rate_plan:{id:rateId,code:"BAR"},available_count:1,promise:false,commit_arbitration_required:true,stay,
      total:{amount_minor:scenario==="changed"&&searches>1?"450000":"420000",currency:"INR",kind:"stay_total"},
      release:{id:"release-683",version:1,content_hash:"hash"},policies:{cancellation:null,deposit:null,guarantee:null,no_show:null},per_night:[],taxes:[],tax_assignment_state:"complete",tax_preview:[],package:null,selected_promotion_codes:[],applied_promotion_codes:[],refund_treatment:null,restrictions_applied:[],operational_blocks_applied:[],party:{adults:1,children:[]}
    }]});
  }
  if(path==="/api/v1/reservations:commit"&&request.method==="POST") {
    writes.push({body:await request.text(),key:request.headers.get("idempotency-key")});
    if(scenario==="uncertain"&&writes.length===1)return json({detail:"Synthetic interrupted response after commit"},503);
    return json({reservation:{reservationId,confirmationNo:"Y-683-PROOF",status:"reserved"}});
  }
  if(path.endsWith("/due-in-room-assignment")&&request.method==="POST") {
    writes.push({body:await request.text(),key:request.headers.get("idempotency-key")});
    if(writes.length===1) { await new Promise<void>(resolve=>{releaseAction=resolve;}); return json({detail:"Synthetic unknown assignment response"},503); }
    assigned=true; return json({assigned:true});
  }
  if(path.endsWith(`/reservations/${reservationId}`))return json(detail());
  if(path.endsWith("/reservation-segments"))return json({reservation:{reservationId,confirmationNo:"Y-683-PROOF",status:"due_in",segments:[]}});
  if(path.endsWith("/check-in/readiness"))return json({canCheckIn:false,blockers:assigned?["identity_evidence_missing"]:["room_assignment_missing"],roomCondition:assigned?"inspected":null,primaryFolioId:null,identityGate:{satisfied:false,requirements:[]}});
  if(path.endsWith("/due-in-room-assignment/candidates"))return json({candidates:[{sellableUnitId:unitId,spaceCode:"107",sellableUnitName:"Deluxe King",floor:1,roomCondition:"inspected"},{sellableUnitId:id(7),spaceCode:"108",sellableUnitName:"Deluxe Twin",floor:1,roomCondition:"clean"}]});
  if(path.startsWith("/api/"))return json({detail:"Unsupported synthetic route; no live requests are forwarded"},404);
  const relative=path.startsWith("/yellow-next/assets/")?path.slice("/yellow-next/".length):"index.html", target=resolve(root,relative);
  if(!target.startsWith(root+sep))return new Response("Forbidden",{status:403});
  const file=Bun.file(target);return await file.exists()?new Response(file):new Response("Not found",{status:404});
} });
console.log(`Order683 synthetic proof only: http://127.0.0.1:${server.port}/p/${property}/reservations`);
