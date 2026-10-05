import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { OperatorHttpApi } from "../src/http/operator";
import type { TenantRequestContext, Tx } from "../src/kernel";

const tenant="00000000-0000-0000-0000-000000387001", property="00000000-0000-0000-0000-000000387002", actor="00000000-0000-0000-0000-000000387003", approval="00000000-0000-0000-0000-000000387004";
let received: unknown;
const carry = {
  async requestApproval(tx: Tx, input: unknown) { received={tx,input}; return {approvalId:approval,createdAt:"2026-09-03T10:00:00.000Z",replayed:false,requestHash:"secret",discrepancyStateHash:"secret"}; },
  async listApprovals() { return {approvals:[],nextCursor:null}; },
  async decideApproval() { return {approvalId:approval,status:"approved" as const,decidedAt:"2026-09-03T10:01:00.000Z",replayed:false}; },
  async carry(tx: Tx, input: unknown) { received={tx,input}; return {carryId:"00000000-0000-0000-0000-000000387005",sourceDiscrepancyId:"00000000-0000-0000-0000-000000387006",targetDiscrepancyId:"00000000-0000-0000-0000-000000387007",propertyNode:property,sourceBusinessDate:"2026-09-02",targetBusinessDate:"2026-09-03",resolution:"carried_forward" as const,requestHash:"secret",replayed:false}; },
};
const api=new (OperatorHttpApi as unknown as new (...args: unknown[])=>OperatorHttpApi)({}, {}, ...Array.from({length:39}), undefined, undefined, carry);
function context(scope:string,url:string):TenantRequestContext { const tx=(async()=>[{id:property,name:"Hotel",timezone:"UTC",currency:"USD"}]) as unknown as Tx; return {tenantId:tenant,tx,request:new Request(url,{method:"POST",headers:{"idempotency-key":"order387-key"}}),identity:{tenantId:tenant,actorId:actor,scopes:[scope]}}; }

describe("Order387 HTTP and browser boundary",()=>{
 test("request reuses caller tx and minimizes hashes",async()=>{ const ctx=context("financials.business-day:carry-discrepancy","http://yellow.test/x"); const response=await api.requestBusinessDayCarryApproval(ctx,property,"2026-09-02","00000000-0000-0000-0000-000000387006",{reason:"Night audit handoff"}); expect(response.status).toBe(201); expect(await response.json()).toEqual({approvalId:approval,createdAt:"2026-09-03T10:00:00.000Z",replayed:false}); expect(JSON.stringify(received)).not.toContain("requestHash"); expect((received as {tx:Tx}).tx).toBe(ctx.tx); });
 test("carry uses exact operation and minimized response",async()=>{ const ctx=context("financials.business-day:carry-discrepancy","http://yellow.test/x"); const response=await api.carryApprovedBusinessDayDiscrepancy(ctx,property,approval,{}); const body=await response.json(); expect(JSON.stringify(body)).not.toContain("requestHash"); expect((received as {input:{envelope:{operation:string}}}).input.envelope.operation).toBe("discrepancy.carried"); });
 test("UI retains ambiguous keys, suppresses stale inbox and uses an accessible dialog",()=>{ const js=readFileSync(new URL("../src/http/operator/operator.js",import.meta.url),"utf8"); expect(js).toContain("dayCloseCarryDialog.showModal()"); expect(js).toContain("dayCloseCarryCancel"); expect(js).toContain("dayCloseCarryKeys.delete(identity)"); expect(js).toContain('generation !== dayCloseApprovalGeneration || activeView !== "day-close" || property !== propertySelect.value'); expect(js).not.toContain("window.prompt"); });
});
