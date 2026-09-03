import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { OwnerTrustExpenseWorkbenchService, OwnerTrustExpenseWorkbenchUnavailableError } from "../src/contexts/financials";
import { Database, PostgresEventBus, PostgresIdempotency } from "../src/kernel";

const DEPLOY=process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME=process.env.YELLOW_OWNER_TRUST_DATABASE_URL??process.env.YELLOW_RUNTIME_DATABASE_URL;
const T="00000000-0000-0000-0000-000000038601",P="00000000-0000-0000-0000-000000038611";
const MAKER="00000000-0000-0000-0000-000000038621",CHECKER="00000000-0000-0000-0000-000000038622",OWNER="00000000-0000-0000-0000-000000038631";
const TRUST="00000000-0000-0000-0000-000000038641",PAYABLE="00000000-0000-0000-0000-000000038642";
const MAKER_ROLE="00000000-0000-0000-0000-000000038651",CHECKER_ROLE="00000000-0000-0000-0000-000000038652";
const databaseDescribe=DEPLOY&&RUNTIME?describe.serial:describe.skip;
let deploy:SQL|undefined,database:Database|undefined,eventPool:SQL|undefined,service:OwnerTrustExpenseWorkbenchService|undefined,businessDate="";

databaseDescribe("Order 386 owner-trust workbench PostgreSQL authority",()=>{
  beforeAll(async()=>{
    deploy=new SQL(DEPLOY!);database=Database.connect(RUNTIME!);eventPool=new SQL(RUNTIME!);service=new OwnerTrustExpenseWorkbenchService({events:new PostgresEventBus(eventPool),idempotency:new PostgresIdempotency()});
    businessDate=(await deploy<{d:string}[]>`SELECT (transaction_timestamp() AT TIME ZONE 'UTC')::date::text d`)[0]!.d;
    await deploy`INSERT INTO tenant(id,slug,name,tier,status) VALUES(${T}::uuid,'order386','Order 386','shared','active')`;
    await deploy`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES(${P}::uuid,${T}::uuid,'order386','property','Order 386','UTC','USD')`;
    await deploy`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES(${MAKER}::uuid,${T}::uuid,'maker@order386.test','Trust maker','active'),(${CHECKER}::uuid,${T}::uuid,'checker@order386.test','Trust checker','active')`;
    await deploy`INSERT INTO permission(code,description) VALUES('financials.trust:post','Post owner trust expense'),('financials.trust:approve-negative','Approve negative owner trust') ON CONFLICT DO NOTHING`;
    await deploy`INSERT INTO role(id,tenant_id,name) VALUES(${MAKER_ROLE}::uuid,${T}::uuid,'Order 386 maker'),(${CHECKER_ROLE}::uuid,${T}::uuid,'Order 386 checker')`;
    await deploy`INSERT INTO role_permission(role_id,permission_code) VALUES(${MAKER_ROLE}::uuid,'financials.trust:post'),(${CHECKER_ROLE}::uuid,'financials.trust:approve-negative')`;
    await deploy`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node) VALUES(${T}::uuid,${MAKER}::uuid,${MAKER_ROLE}::uuid,${P}::uuid),(${T}::uuid,${CHECKER}::uuid,${CHECKER_ROLE}::uuid,${P}::uuid)`;
    await deploy`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES(${OWNER}::uuid,${T}::uuid,'person','Order 386 Owner','active')`;
    await deploy`INSERT INTO party_role(tenant_id,party_id,role) VALUES(${T}::uuid,${OWNER}::uuid,'owner')`;
    await deploy`INSERT INTO account(id,tenant_id,property_node,role,party_id,name,currency,status) VALUES(${TRUST}::uuid,${T}::uuid,${P}::uuid,'trust',${OWNER}::uuid,'Owner trust','USD','open'),(${PAYABLE}::uuid,${T}::uuid,${P}::uuid,'payable',NULL,'Owner payable','USD','open')`;
    await deploy`INSERT INTO tx_code_route(tenant_id,property_node,currency,tx_code,debit_account_id,credit_account_id) VALUES(${T}::uuid,${P}::uuid,'USD','OWNER_TRUST_EXPENSE',${TRUST}::uuid,${PAYABLE}::uuid)`;
    await deploy`INSERT INTO business_day(tenant_id,property_node,business_date) VALUES(${T}::uuid,${P}::uuid,${businessDate}::date)`;
    await deploy.begin(async tx=>{const journal=(await tx<{id:string}[]>`INSERT INTO journal(tenant_id,property_node,business_date,kind,description,currency,source,created_by) VALUES(${T}::uuid,${P}::uuid,${businessDate}::date,'paidout','Opening owner funds','USD','{}',${MAKER}::uuid) RETURNING id`)[0]!.id;await tx`INSERT INTO posting_line(tenant_id,journal_id,seq,account_id,tx_code,amount_minor,business_date,currency) VALUES(${T}::uuid,${journal}::uuid,1,${TRUST}::uuid,'OWNER_TRUST_EXPENSE',-10000,${businessDate}::date,'USD'),(${T}::uuid,${journal}::uuid,2,${PAYABLE}::uuid,'OWNER_TRUST_EXPENSE',10000,${businessDate}::date,'USD')`;});
  },30000);
  afterAll(async()=>{await database?.close();await eventPool?.close({timeout:0});await deploy?.close({timeout:0});});

  test("P1 migration exposes only the read-only app-mediated capability",async()=>{
    const rows=await deploy!`SELECT count(*)::int migrations,has_function_privilege('app_role','prepare_owner_trust_expense(uuid,uuid,uuid,bigint,text)','EXECUTE') app_exec,has_function_privilege('yellow_runtime','prepare_owner_trust_expense(uuid,uuid,uuid,bigint,text)','EXECUTE') runtime_exec,prosecdef,provolatile FROM schema_migration,pg_proc WHERE proname='prepare_owner_trust_expense' GROUP BY prosecdef,provolatile`;
    expect(rows).toEqual([{migrations:68,app_exec:true,runtime_exec:false,prosecdef:true,provolatile:"v"}]);
  });

  test("P2 discovery and preparation are minimized, exact-property and zero-write",async()=>{
    await database!.withTenantTransaction(T,async tx=>{
      const before=await tx`SELECT (SELECT count(*)::int FROM journal WHERE tenant_id=${T}::uuid) journals,(SELECT count(*)::int FROM posting_line WHERE tenant_id=${T}::uuid) lines,(SELECT count(*)::int FROM approval_request WHERE tenant_id=${T}::uuid) approvals,(SELECT count(*)::int FROM fact_log WHERE tenant_id=${T}::uuid) facts,(SELECT count(*)::int FROM outbox WHERE tenant_id=${T}::uuid) events`;
      expect(await service!.listAccounts(tx,{tenantId:T,propertyNode:P,actorId:MAKER})).toEqual([{accountReference:TRUST,accountLabel:"Owner trust",ownerLabel:"Order 386 Owner",currency:"USD",availableBalanceMinor:"10000",canPost:true}]);
      expect(await service!.listAccounts(tx,{tenantId:T,propertyNode:P,actorId:CHECKER})).toEqual([]);
      expect(await service!.previewExpense(tx,{tenantId:T,propertyNode:P,actorId:MAKER,trustAccountId:TRUST,amountMinor:"4000",reason:"Owner maintenance"})).toEqual({accountReference:TRUST,accountLabel:"Owner trust",ownerLabel:"Order 386 Owner",currency:"USD",amountMinor:"4000",availableBalanceMinor:"10000",projectedBalanceMinor:"6000",approvalRequired:false});
      expect((await service!.previewExpense(tx,{tenantId:T,propertyNode:P,actorId:MAKER,trustAccountId:TRUST,amountMinor:"11000",reason:"Owner maintenance"})).approvalRequired).toBeTrue();
      expect(await tx`SELECT (SELECT count(*)::int FROM journal WHERE tenant_id=${T}::uuid) journals,(SELECT count(*)::int FROM posting_line WHERE tenant_id=${T}::uuid) lines,(SELECT count(*)::int FROM approval_request WHERE tenant_id=${T}::uuid) approvals,(SELECT count(*)::int FROM fact_log WHERE tenant_id=${T}::uuid) facts,(SELECT count(*)::int FROM outbox WHERE tenant_id=${T}::uuid) events`).toEqual(before);
    });
  });

  test("P3 server-derived request, different checker decision and final post remain lock coherent",async()=>{
    const requestEnvelope={tenantId:T,propertyNode:P,actorId:MAKER,requestId:crypto.randomUUID(),operation:"approval.requested"} as const;
    const requested=await database!.withTenantTransaction(T,tx=>service!.requestApproval(tx,{tenantId:T,propertyNode:P,actorId:MAKER,trustAccountId:TRUST,amountMinor:"11000",reason:"Owner capital work",idempotencyKey:"order386-request-approval",envelope:requestEnvelope}));
    expect(requested.status).toBe("pending");
    const inbox=await database!.withTenantTransaction(T,tx=>service!.listApprovals(tx,{tenantId:T,propertyNode:P,actorId:CHECKER}));
    expect(inbox[0]).toMatchObject({approvalId:requested.approvalId,accountReference:TRUST,requesterLabel:"Trust maker",canDecide:true,canPost:false});
    await expect(database!.withTenantTransaction(T,tx=>service!.decideApproval(tx,{tenantId:T,propertyNode:P,approvalId:requested.approvalId,decision:"approved",idempotencyKey:"order386-self-approval",envelope:{tenantId:T,propertyNode:P,actorId:MAKER,requestId:crypto.randomUUID(),operation:"approval.decided"}}))).rejects.toBeInstanceOf(OwnerTrustExpenseWorkbenchUnavailableError);
    const decisionEnvelope={tenantId:T,propertyNode:P,actorId:CHECKER,requestId:crypto.randomUUID(),operation:"approval.decided"} as const;
    expect(await database!.withTenantTransaction(T,tx=>service!.decideApproval(tx,{tenantId:T,propertyNode:P,approvalId:requested.approvalId,decision:"approved",idempotencyKey:"order386-approve-expense",envelope:decisionEnvelope}))).toMatchObject({status:"approved",replayed:false});
    const postEnvelope={tenantId:T,propertyNode:P,actorId:MAKER,requestId:crypto.randomUUID(),operation:"journal.posted"} as const;
    const posted=await database!.withTenantTransaction(T,tx=>service!.postExpense(tx,{tenantId:T,propertyNode:P,trustAccountId:TRUST,amountMinor:"11000",reason:"Owner capital work",approvalId:requested.approvalId,idempotencyKey:"order386-post-expense",envelope:postEnvelope}));
    expect(posted).toMatchObject({trustAccountId:TRUST,amountMinor:"11000",availableBeforeMinor:"10000",projectedAvailableMinor:"-1000",approvalRequestId:requested.approvalId,replayed:false});
    await expect(database!.withTenantTransaction(T,tx=>service!.postExpense(tx,{tenantId:T,propertyNode:P,trustAccountId:TRUST,amountMinor:"1",reason:"Reuse",approvalId:requested.approvalId,idempotencyKey:"order386-reuse-expense",envelope:{...postEnvelope,requestId:crypto.randomUUID()}}))).rejects.toBeInstanceOf(OwnerTrustExpenseWorkbenchUnavailableError);
  });

  test("P4 stale locked balance evidence and maker self-decision fail closed",async()=>{
    const request=await database!.withTenantTransaction(T,tx=>service!.requestApproval(tx,{tenantId:T,propertyNode:P,actorId:MAKER,trustAccountId:TRUST,amountMinor:"1",reason:"Stale approval",idempotencyKey:"order386-stale-request",envelope:{tenantId:T,propertyNode:P,actorId:MAKER,requestId:crypto.randomUUID(),operation:"approval.requested"}}));
    await deploy!.begin(async tx=>{const journal=(await tx<{id:string}[]>`INSERT INTO journal(tenant_id,property_node,business_date,kind,description,currency,source,created_by) VALUES(${T}::uuid,${P}::uuid,${businessDate}::date,'adjustment','Balance changed','USD','{}',${MAKER}::uuid) RETURNING id`)[0]!.id;await tx`INSERT INTO posting_line(tenant_id,journal_id,seq,account_id,tx_code,amount_minor,business_date,currency) VALUES(${T}::uuid,${journal}::uuid,1,${TRUST}::uuid,'OWNER_TRUST_EXPENSE',-100,${businessDate}::date,'USD'),(${T}::uuid,${journal}::uuid,2,${PAYABLE}::uuid,'OWNER_TRUST_EXPENSE',100,${businessDate}::date,'USD')`;});
    await expect(database!.withTenantTransaction(T,tx=>service!.decideApproval(tx,{tenantId:T,propertyNode:P,approvalId:request.approvalId,decision:"approved",idempotencyKey:"order386-stale-decision",envelope:{tenantId:T,propertyNode:P,actorId:CHECKER,requestId:crypto.randomUUID(),operation:"approval.decided"}}))).rejects.toBeInstanceOf(OwnerTrustExpenseWorkbenchUnavailableError);
  });

  test("P5 account and approval MAX+1 fail complete rather than truncating",async()=>{
    const values=Array.from({length:100},(_,index)=>({id:`00000000-0000-0000-0000-${(386700+index).toString().padStart(12,"0")}`,name:`Trust ${String(index).padStart(3,"0")}`}));
    for(const value of values){await deploy!`INSERT INTO account(id,tenant_id,property_node,role,party_id,name,currency,status) VALUES(${value.id}::uuid,${T}::uuid,${P}::uuid,'trust',${OWNER}::uuid,${value.name},'USD','open')`;}
    await expect(database!.withTenantTransaction(T,tx=>service!.listAccounts(tx,{tenantId:T,propertyNode:P,actorId:MAKER}))).rejects.toBeInstanceOf(OwnerTrustExpenseWorkbenchUnavailableError);
    const payload={ownerPartyId:OWNER,trustAccountId:TRUST,payableAccountId:PAYABLE,amountMinor:"1",availableBeforeMinor:"-1000",projectedAvailableMinor:"-1001",reason:"Bounded approval"};
    for(let index=0;index<100;index+=1){await deploy!`INSERT INTO approval_request(tenant_id,kind,subject_type,subject_id,requested_by,payload) VALUES(${T}::uuid,'owner_trust_negative_expense','account',${TRUST}::uuid,${MAKER}::uuid,${payload}::jsonb)`;}
    await expect(database!.withTenantTransaction(T,tx=>service!.listApprovals(tx,{tenantId:T,propertyNode:P,actorId:CHECKER}))).rejects.toBeInstanceOf(OwnerTrustExpenseWorkbenchUnavailableError);
  });
});
