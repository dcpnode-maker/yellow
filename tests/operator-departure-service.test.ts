import { describe, expect, test } from "bun:test";
import { OperatorHttpApi } from "../src/http/operator";
import type { LocalLoginService } from "../src/contexts/identity";
import type { TenantRequestContext, Tx } from "../src/kernel";

const id="00000000-0000-0000-0000-000000059301";
const action={expectedVersion:1,staffPartyId:null,outcome:null};
function fixture(scopes:string[],granted=true,key:string|null='order593-test-key') {
 const queries:string[]=[];
 const tx=(async(strings:TemplateStringsArray)=>{
  const sql=strings.join('?');queries.push(sql);
  if(sql.includes('assert_departure_service_authority')) throw new Error('unexpected command authority');
  return granted?[{id,name:'Synthetic',timezone:'UTC',currency:'USD'}]:[];
 }) as unknown as Tx;
 const headers=new Headers();if(key!==null)headers.set('idempotency-key',key);
 const context={tenantId:id,tx,identity:{tenantId:id,actorId:id,scopes},
  request:new Request(`http://yellow.test/api/v1/properties/${id}/departure-services/${id}/confirm`,{method:'POST',headers})} as TenantRequestContext;
 return {context,queries,api:new OperatorHttpApi({} as LocalLoginService)};
}
describe('departure-service HTTP authority',()=>{
 test('existing checkout/arrival/financial scopes do not authorize departure work',async()=>{
  const f=fixture(['stay-operations.checkout:commit','stay-operations.pickup-tasks:work']);
  const response=await f.api.commandDepartureService(f.context,id,id,id,'confirm',action);
  expect(response.status).toBe(403);expect(f.queries).toHaveLength(0);
 });
 test('exact property scope is required and foreign existence is concealed',async()=>{
  const f=fixture(['stay-operations.departure-services:confirm'],false);
  expect((await f.api.commandDepartureService(f.context,id,null,id,'confirm',action)).status).toBe(404);
  expect(f.queries.some(q=>q.includes('departure_service_request'))).toBe(false);
 });
 test('missing key and invented action fail before SQL',async()=>{
  const f=fixture(['stay-operations.departure-services:confirm'],true,null);
  expect((await f.api.commandDepartureService(f.context,id,id,id,'confirm',action)).status).toBe(400);
  expect((await f.api.commandDepartureService(f.context,id,id,id,'reopen',action)).status).toBe(400);
  expect(f.queries).toHaveLength(0);
 });
});
