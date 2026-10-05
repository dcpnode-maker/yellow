import { afterEach, describe, expect, test } from "bun:test";
import { prepareTaskAttempt, prepareTravelAttempt, type PickupTask } from "../frontend/yellow/src/arrival-pickup";
Object.assign(globalThis, {window: {location: {search: "", pathname: "/p/69000000-0000-4000-8000-000000000001/reservations"}}});
const {loadArrivalPickupTask, putArrivalTravel, transitionArrivalPickupTask, ArrivalPickupRequestError} = await import("../frontend/yellow/src/" + "arrival-pickup-api");
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const property = "69000000-0000-4000-8000-000000000001", reservation = "69000000-0000-4000-8000-000000000002", taskId="69000000-0000-4000-8000-000000000003", staffId="69000000-0000-4000-8000-000000000004", key="69000000-0000-4000-8000-000000000005";
const task: PickupTask = {taskId,reservationId:reservation,confirmationNo:"Y-690",status:"open",dueAt:"2026-09-25T11:00:00.000Z",priority:1,createdAt:"2026-09-24T00:00:00.000Z",completedAt:null,assigneePartyId:null,eligibleAction:"assign"};
describe("Order690 HTTP command adapter", () => {
  test("travel PUT and task POST use exact route, immutable body and same key", async () => {
    const calls: {url:string; method:string; key:string|null; body:string|null}[]=[];
    globalThis.fetch = (async (input, init) => {
      const url=String(input);
      if (url.endsWith("/auth/demo:enter")) return Response.json({accessToken:"synthetic"});
      calls.push({url,method:init?.method??"GET",key:new Headers(init?.headers).get("idempotency-key"),body:typeof init?.body==="string"?init.body:null});
      if (url.endsWith("/travel/arrival")) return Response.json({travel:{reservationId:reservation,direction:"arrival",travel:{pickupRequested:true}}});
      return Response.json({taskId,reservationId:reservation,taskStatus:"assigned"});
    }) as typeof fetch;
    const travel=prepareTravelAttempt(property,reservation,"Y-690",null,{mode:"flight",carrier:null,serviceNo:null,scheduledAt:"2026-09-25T11:00:00.000Z",pickupRequested:true},key);
    await putArrivalTravel(travel); await putArrivalTravel(travel);
    const assign=prepareTaskAttempt(property,reservation,"Y-690",task,staffId,key);
    await transitionArrivalPickupTask(assign);
    expect(calls.map(call=>[call.method,call.url,call.key])).toEqual([
      ["PUT",`/api/v1/properties/${property}/reservations/${reservation}/travel/arrival`,key],
      ["PUT",`/api/v1/properties/${property}/reservations/${reservation}/travel/arrival`,key],
      ["POST",`/api/v1/properties/${property}/reservations/${reservation}/arrival-pickup-task/${taskId}/assign`,key],
    ]);
    expect(calls[0]?.body).toBe(calls[1]?.body);
    expect(JSON.parse(calls[2]!.body!)).toEqual(assign.body);
  });
  test("denial is definite, server failure uncertain, linked task ID checked", async () => {
    globalThis.fetch = (async (input) => String(input).endsWith("/auth/demo:enter") ? Response.json({accessToken:"synthetic"}) : Response.json({detail:"Forbidden"},{status:403})) as typeof fetch;
    const attempt=prepareTravelAttempt(property,reservation,"Y-690",null,{mode:"car",carrier:null,serviceNo:null,scheduledAt:null,pickupRequested:false},key);
    await expect(putArrivalTravel(attempt)).rejects.toMatchObject({uncertain:false,status:403});
    globalThis.fetch = (async (_input: RequestInfo | URL) => Response.json({detail:"Unavailable"},{status:503})) as typeof fetch;
    await expect(putArrivalTravel(attempt)).rejects.toMatchObject({uncertain:true,status:503});
    globalThis.fetch = (async (_input: RequestInfo | URL) => Response.json({pickupTask:{...task,taskId:"wrong"}})) as typeof fetch;
    await expect(loadArrivalPickupTask(property,reservation,taskId)).rejects.toThrow("incoherent");
    expect(ArrivalPickupRequestError.name).toBe("ArrivalPickupRequestError");
  });
  test("unknown response retries the exact travel body/key; conflict is definite", async () => {
    const sent: {body:string|null;key:string|null}[]=[];
    globalThis.fetch = (async (_input, init) => {
      sent.push({body:typeof init?.body==="string"?init.body:null,key:new Headers(init?.headers).get("idempotency-key")});
      if (sent.length===1) return Response.json({detail:"Response lost"},{status:503});
      if (sent.length===2) return Response.json({travel:{reservationId:reservation,direction:"arrival",travel:{pickupRequested:true}}});
      return Response.json({detail:"Stale expected tuple"},{status:409});
    }) as typeof fetch;
    const attempt=prepareTravelAttempt(property,reservation,"Y-690",null,{mode:"car",carrier:null,serviceNo:null,scheduledAt:"2026-09-25T11:00:00.000Z",pickupRequested:true},key);
    await expect(putArrivalTravel(attempt)).rejects.toMatchObject({uncertain:true,status:503});
    await putArrivalTravel(attempt);
    expect(sent[0]).toEqual(sent[1]);
    await expect(putArrivalTravel(attempt)).rejects.toMatchObject({uncertain:false,status:409});
  });
});
