import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { SQL } from "bun";

import {
  IndiaIrpAccommodationFiscalActionReadinessConflictError,
  IndiaIrpAccommodationFiscalActionReadinessNotFoundError,
  IndiaIrpAccommodationFiscalActionReadinessService,
  type IndiaIrpAccommodationFiscalActionReadinessInput,
} from "../src/contexts/tax-fiscal";
import { Database } from "../src/kernel";
import { order413Fixtures, type Fixture } from "./india-irp-accommodation-source.integration.test";

setDefaultTimeout(300_000);
const deployUrl = process.env.YELLOW_ORDER429_DATABASE_URL ?? process.env.YELLOW_ORDER413_DATABASE_URL ?? process.env.YELLOW_DEPLOY_DATABASE_URL;
const runtimeUrl = process.env.YELLOW_ORDER429_RUNTIME_DATABASE_URL ?? process.env.YELLOW_ORDER413_RUNTIME_DATABASE_URL ?? process.env.YELLOW_RUNTIME_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_ORDER429_DATABASE === "1" && (!deployUrl || !runtimeUrl)) throw new Error("Order429 PostgreSQL proof requires deploy and runtime database URLs");
const live = deployUrl && runtimeUrl ? describe.serial : describe.skip;
type Mutable = Record<string, any>;
const freeze = <T>(value:T, seen=new Set<object>()):T => { if(value!==null&&typeof value==="object"&&!seen.has(value)){seen.add(value);for(const child of Object.values(value as Record<string,unknown>))freeze(child,seen);Object.freeze(value);}return value; };
const selected = (x:Fixture): IndiaIrpAccommodationFiscalActionReadinessInput => freeze({tenantId:x.tenant_id,propertyNode:x.property_node,reservationId:x.reservation_id,folioId:x.folio_id,journalId:x.journal_id,recipientPartyId:x.buyer_party_id,recipientRegistrationId:x.recipient_registration_id,classificationId:x.classification_id,supplyNatureAtTimeOfSupplyInput:x.supplyInput,supplyNatureAtTimeOfSupplyResult:x.supplyResult});

live("Order429 real PostgreSQL India IRP fiscal-action readiness", () => {
  let deploy:SQL, database:Database;
  const service = new IndiaIrpAccommodationFiscalActionReadinessService();
  async function census(tenant:string) { const [row]=await deploy<Array<Record<string,string>>>`SELECT (SELECT count(*)::text FROM document) documents,(SELECT count(*)::text FROM document_series) series,(SELECT count(*)::text FROM fact_log) facts,(SELECT count(*)::text FROM outbox) events,(SELECT count(*)::text FROM api_idempotency) idempotency`; return JSON.stringify(row); }
  beforeAll(() => { deploy=new SQL(deployUrl!,{max:2,prepare:false}); database=Database.connect(runtimeUrl!,{maxConnections:4,prepare:false}); });
  afterAll(async()=>{await database.close();await deploy.close({timeout:0});});
  test("runs current Order413 through Order426 for 5/12/18, every family, multi-night and zero-tax fixtures",async()=>{
    expect(order413Fixtures.length).toBeGreaterThanOrEqual(3);expect(new Set(order413Fixtures.flatMap(x=>x.rates))).toEqual(new Set([500,1200,1800]));expect(new Set(order413Fixtures.map(x=>x.family))).toEqual(new Set(["igst","cgst_sgst","cgst_utgst"]));expect(order413Fixtures.some(x=>x.nights>1)).toBeTrue();expect(order413Fixtures.some(x=>x.zeroes>0)).toBeTrue();
    for(const fixture of order413Fixtures){const before=await census(fixture.tenant_id),input=selected(fixture),first=await database.withTenantTransaction(fixture.tenant_id,tx=>service.resolve(tx,input)),replay=await database.withTenantTransaction(fixture.tenant_id,tx=>service.resolve(tx,input));expect(first).toEqual(replay);expect(first.state).toBe("blocked_pending_fiscal_document_origin_policy");expect(first.submissionReady).toBeFalse();expect(first.permittedActions).toEqual([]);expect(first.blockers).toEqual(["FISCAL_DOCUMENT_ORIGIN_UNSELECTED","LEGAL_DOCUMENT_NUMBER_FORMAT_UNCONFIGURED","DOCUMENT_SERIES_UNBOUND"]);expect(first.preDocumentEvidence.sections.ItemList).toHaveLength(fixture.nights);expect(JSON.stringify(first)).not.toContain(fixture.tenant_id);expect(JSON.stringify(first)).not.toContain("DocNum");expect(Object.isFrozen(first)).toBeTrue();expect(Object.isFrozen(first.preDocumentEvidence)).toBeTrue();expect(await census(fixture.tenant_id)).toBe(before);}
  });
  test("keeps absent and conflicted current-source selectors distinct",async()=>{const own=order413Fixtures[0]!,foreign=order413Fixtures.find(x=>x.tenant_id!==own.tenant_id);if(!foreign)return;await expect(database.withTenantTransaction(own.tenant_id,tx=>service.resolve(tx,freeze({...selected(own),journalId:foreign.journal_id})))).rejects.toBeInstanceOf(IndiaIrpAccommodationFiscalActionReadinessNotFoundError);const mixed=structuredClone(selected(own)) as Mutable;mixed.supplyNatureAtTimeOfSupplyResult.evidenceHash="0".repeat(64);freeze(mixed);await expect(database.withTenantTransaction(own.tenant_id,tx=>service.resolve(tx,mixed as IndiaIrpAccommodationFiscalActionReadinessInput))).rejects.toBeInstanceOf(IndiaIrpAccommodationFiscalActionReadinessConflictError);});
});
