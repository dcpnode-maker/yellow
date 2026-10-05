import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { OwnerTrustExpenseWorkbenchService, OwnerTrustExpenseWorkbenchValidationError } from "../src/contexts/financials";
import type { EventBus, PostgresIdempotency, Tx } from "../src/kernel";

const T="00000000-0000-0000-0000-000000038601",P="00000000-0000-0000-0000-000000038611",A="00000000-0000-0000-0000-000000038621",ACCOUNT="00000000-0000-0000-0000-000000038641";
const service=new OwnerTrustExpenseWorkbenchService({events:undefined as unknown as EventBus,idempotency:undefined as unknown as PostgresIdempotency});

describe("Order 386 owner-trust workbench contract",()=>{
  test("rejects noncanonical money, reason and input authority before querying",async()=>{
    for(const amountMinor of ["0","-1","01","9223372036854775808"]){await expect(service.previewExpense(undefined as unknown as Tx,{tenantId:T,propertyNode:P,actorId:A,trustAccountId:ACCOUNT,amountMinor,reason:"Expense"})).rejects.toBeInstanceOf(OwnerTrustExpenseWorkbenchValidationError);}
    await expect(service.previewExpense(undefined as unknown as Tx,{tenantId:T,propertyNode:P,actorId:A,trustAccountId:ACCOUNT,amountMinor:"1",reason:" padded "})).rejects.toBeInstanceOf(OwnerTrustExpenseWorkbenchValidationError);
    await expect(service.previewExpense(undefined as unknown as Tx,{tenantId:T,propertyNode:P,actorId:A,trustAccountId:ACCOUNT,amountMinor:"1",reason:"Expense",balanceBeforeMinor:"1"} as never)).rejects.toBeInstanceOf(OwnerTrustExpenseWorkbenchValidationError);
  });

  test("pins app-mediated zero-write preparation and complete-or-unavailable bounds",()=>{
    const migration=readFileSync(join(import.meta.dir,"..","migrations","0068_prepare_owner_trust_expense.sql"),"utf8");
    const source=readFileSync(join(import.meta.dir,"..","src","contexts","financials","trust-workbench.ts"),"utf8");
    expect(migration).toContain("session_user <> 'yellow_runtime'");
    expect(migration).toContain("public.lock_financial_rows(p_tenant,ARRAY[p_trust_account,v_payable]");
    expect(migration).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|TRUNCATE)\b(?!(?:[\s\S]*REVOKE))/i);
    expect(source).toContain("LIMIT ${MAX+1}");
    expect(source).toContain("if(rows.length>MAX)throw new OwnerTrustExpenseWorkbenchUnavailableError()");
    expect(source).not.toContain("approvalEvidence");
  });
});
