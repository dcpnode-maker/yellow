import { describe, expect, test } from "bun:test";
import { arrivalDraftToTuple, attemptApplied, prepareTaskAttempt, prepareTravelAttempt, readArrivalAttempt, travelTupleMatches, writeArrivalAttempt, type ArrivalTravel, type PickupTask } from "../frontend/yellow/src/arrival-pickup";

const propertyId = "69000000-0000-4000-8000-000000000001";
const reservationId = "69000000-0000-4000-8000-000000000002";
const staffId = "69000000-0000-4000-8000-000000000003";
const taskId = "69000000-0000-4000-8000-000000000004";
const key = "69000000-0000-4000-8000-000000000005";
const travel: ArrivalTravel = {travelId:key, mode:"flight", carrier:"Air India", serviceNo:"AI 101", scheduledAt:"2026-09-25T11:00:00.000000Z", pickupRequested:false, pickupTaskId:null};
const task: PickupTask = {taskId,reservationId,confirmationNo:"Y-690",status:"open",dueAt:"2026-09-25T11:00:00.000Z",priority:1,createdAt:"2026-09-24T11:00:00.000Z",completedAt:null,assigneePartyId:null,eligibleAction:"assign"};
describe("Order690 arrival pickup invariants", () => {
  test("local property time converts with DST gap and fold rejection", () => {
    expect(arrivalDraftToTuple({mode:"flight",carrier:" Air India ",serviceNo:"AI 101",localTime:"2026-09-25T16:30",pickupRequested:true},"Asia/Kolkata").scheduledAt).toBe("2026-09-25T11:00:00.000Z");
    expect(() => arrivalDraftToTuple({mode:"",carrier:"",serviceNo:"",localTime:"2025-03-09T02:30",pickupRequested:true},"America/New_York")).toThrow("arrival time");
    expect(() => arrivalDraftToTuple({mode:"",carrier:"",serviceNo:"",localTime:"2025-11-02T01:30",pickupRequested:true},"America/New_York")).toThrow("arrival time");
    expect(arrivalDraftToTuple({mode:"",carrier:"",serviceNo:"",localTime:"",pickupRequested:true},"Asia/Kolkata")).toEqual({mode:null,carrier:null,serviceNo:null,scheduledAt:null,pickupRequested:true});
  });
  test("exact expected tuple, no-op and linked-task lock", () => {
    const next = {...travel, pickupRequested:true};
    const attempt = prepareTravelAttempt(propertyId,reservationId,"Y-690",travel,next,key);
    expect(attempt.body).toEqual({expected:{mode:"flight",carrier:"Air India",serviceNo:"AI 101",scheduledAt:"2026-09-25T11:00:00.000000Z",pickupRequested:false},travel:next});
    expect(attemptApplied(attempt,next,null)).toBe(true);
    expect(travelTupleMatches({...next,scheduledAt:"2026-09-25T11:00:00.000Z"},next)).toBe(true);
    expect(travelTupleMatches({...next,scheduledAt:"2026-09-25T11:00:00.000001Z"},next)).toBe(false);
    expect(() => prepareTravelAttempt(propertyId,reservationId,"Y-690",travel,travel,key)).toThrow();
    expect(() => prepareTravelAttempt(propertyId,reservationId,"Y-690",{...travel,pickupTaskId:taskId},next,key)).toThrow();
  });
  test("task actions freeze exact CAS body and only target status confirms", () => {
    const assign = prepareTaskAttempt(propertyId,reservationId,"Y-690",task,staffId,key);
    expect(assign.body).toEqual({expectedTaskStatus:"open",expectedAssigneePartyId:null,staffPartyId:staffId});
    expect(attemptApplied(assign,null,{...task,status:"assigned",assigneePartyId:staffId,eligibleAction:"start"})).toBe(true);
    expect(attemptApplied(assign,null,{...task,status:"open"})).toBe(false);
    const start = prepareTaskAttempt(propertyId,reservationId,"Y-690",{...task,status:"assigned",assigneePartyId:staffId,eligibleAction:"start"},null,key);
    expect(start.body).toEqual({expectedTaskStatus:"assigned",expectedAssigneePartyId:staffId});
    const complete = prepareTaskAttempt(propertyId,reservationId,"Y-690",{...task,status:"in_progress",assigneePartyId:staffId,eligibleAction:"complete"},null,key);
    expect(complete.body).toEqual({expectedTaskStatus:"in_progress",expectedAssigneePartyId:staffId});
    expect(() => prepareTaskAttempt(propertyId,reservationId,"Y-690",task,"bad",key)).toThrow();
  });
  test("retained attempt is recovered only with exact typed command body", () => {
    const values = new Map<string,string>();
    Object.assign(globalThis,{sessionStorage:{getItem:(name:string)=>values.get(name)??null,setItem:(name:string,value:string)=>{values.set(name,value);},removeItem:(name:string)=>{values.delete(name);}}});
    const attempt=prepareTravelAttempt(propertyId,reservationId,"Y-690",null,{mode:"flight",carrier:null,serviceNo:null,scheduledAt:"2026-09-25T11:00:00.000Z",pickupRequested:true},key);
    writeArrivalAttempt(attempt);
    expect(readArrivalAttempt(propertyId,reservationId)).toEqual(attempt);
    values.set(`yellow-arrival-pickup:${propertyId}:${reservationId}`,JSON.stringify({...attempt,body:{expected:null,travel:{...(attempt.body.travel as object),pickupRequested:"true"}}}));
    expect(readArrivalAttempt(propertyId,reservationId)).toBeNull();
    values.set(`yellow-arrival-pickup:${propertyId}:${reservationId}`,JSON.stringify({...attempt,body:{expected:null,travel:{...(attempt.body.travel as object),mode:"spaceship"}}}));
    expect(readArrivalAttempt(propertyId,reservationId)).toBeNull();
  });
});
