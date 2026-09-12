import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { readFileSync } from "node:fs";
import { Database, type Tx } from "../src/kernel";
import { FiscalSubmissionRepository } from "../src/contexts/tax-fiscal/fiscal-submission-repository";
import { FiscalSubmissionWorker, VerifiedIndiaIrpAdapterRegistry } from "../src/contexts/tax-fiscal/fiscal-submission-worker";
import { creditSqlState } from "./fixtures/india-native-fiscal-credit-note-fixture";
import { createOrder447CreditProtocol, creditSubmissionFinancialFingerprint } from "./fixtures/india-native-credit-submission-fixture";
import { createOrder440ClearIrpProtocol, type Order440ClearIrpProtocol } from "./fixtures/order440-clearirp-protocol";
import { assertCreditDeliveryTargets, createCreditDeliveryScenario, creditDeliveryProtocolDocument,
  creditDeliveryRows, creditDeliveryCatalogue, parseCreditDeliveryTargetMode, readCreditDelivery, requestCreditDelivery,
  type CreditDeliveryScenario } from "./fixtures/india-native-credit-delivery-fixture";

const deployUrl = process.env.YELLOW_ORDER452_DEPLOY_DATABASE_URL;
const runtimeUrl = process.env.YELLOW_ORDER452_RUNTIME_DATABASE_URL;
const required = process.env.YELLOW_REQUIRE_ORDER452_DATABASE === "1";
const mode = required || deployUrl || runtimeUrl ? parseCreditDeliveryTargetMode(process.env.YELLOW_ORDER452_TARGET_MODE) : undefined;
if (required || deployUrl || runtimeUrl) {
  if (!deployUrl || !runtimeUrl) throw new Error("Required Order452 SQL proof needs paired admitted credentials");
  assertCreditDeliveryTargets(deployUrl, runtimeUrl, "runtime", mode!, process.env.YELLOW_REQUIRE_ORDER452_CI_CANONICAL === "1",
    process.env.YELLOW_ORDER452_CI_DATABASE_ADDRESS, process.env.YELLOW_ORDER452_NATIVE_EXECUTION_ADMITTED === "1");
}

describe("Order452 draft read-only capability", () => {
  test("requires both current scopes before absence and a bounded owner-only head lookup", () => {
    const sql = readFileSync(new URL("../handoff/drafts/order452/0089_native_credit_delivery_discovery.sql", import.meta.url), "utf8");
    expect(sql).toContain("ARRAY['tax-fiscal.documents:read','tax-fiscal.submissions:read']");
    expect(sql).toContain("ORDER BY id LIMIT 2");
    expect(sql).toContain("SET search_path=pg_catalog,public,pg_temp");
    expect(sql).not.toMatch(/\b(?:INSERT INTO|UPDATE public|DELETE FROM|CREATE TABLE|CREATE INDEX|ALTER TABLE)\b/i);
    expect(sql).not.toContain("assert_india_native_credit_complete");
  });
  test("native execution stays closed without Q241 and CI identities cannot alias native or old prefix targets", () => {
    const url = (role: string, name = "yellow_order452_current89_ci", port = "5544") => `postgres://${role}:synthetic@127.0.0.1:${port}/${name}`;
    expect(() => assertCreditDeliveryTargets(url("yellow_deploy"), url("yellow_runtime"), "runtime", "native-draft")).toThrow("Q241");
    expect(() => assertCreditDeliveryTargets(url("yellow_deploy"), url("yellow_runtime"), "runtime", "ci-canonical", true, "127.0.0.1:5544")).not.toThrow();
    for (const name of ["yellow_order447_current88_ci", "yellow_order452_upgrade88_ci"]) {
      expect(() => assertCreditDeliveryTargets(url("yellow_deploy", name), url("yellow_runtime", name), "runtime", "ci-canonical", true, "127.0.0.1:5544")).toThrow();
    }
    expect(() => assertCreditDeliveryTargets(url("yellow_deploy", undefined, "55503"), url("yellow_runtime", undefined, "55503"), "runtime", "ci-canonical", true, "127.0.0.1:55503")).toThrow();
  });
  test("native guard admits only the explicit clone pair and both ordered proof operations", () => {
    const candidate = "yellow_order452_credit_delivery_candidate_20260908";
    const deploy = `postgres://yellow_deploy:synthetic-deploy@127.0.0.1:55503/${candidate}`;
    const runtime = `postgres://yellow_runtime:synthetic-runtime@127.0.0.1:55503/${candidate}`;
    const check = (d = deploy, r = runtime, purpose: "runtime" | "rollback" = "runtime", admitted = true) =>
      assertCreditDeliveryTargets(d, r, purpose, "native-draft", false, undefined, admitted);
    expect(() => check(deploy, runtime, "runtime", false)).toThrow("Q241");
    for (const purpose of ["runtime", "rollback"] as const) expect(() => check(deploy, runtime, purpose)).not.toThrow();
    for (const [d, r] of [
      [deploy.replace(":55503/", ":55504/"), runtime],
      [deploy, runtime.replace("127.0.0.1", "localhost")],
      [deploy.replace(candidate, "yellow_order446_credit_upgrade_20260907"), runtime],
      [deploy, runtime.replace(candidate, "yellow_order452_upgrade88_ci")],
      [deploy.replace("yellow_deploy:", "yellow_runtime:"), runtime],
      [deploy, runtime.replace("yellow_runtime:", "yellow_deploy:")],
      [deploy.replace(":synthetic-deploy@", "@"), runtime],
      [deploy, runtime.replace(":synthetic-runtime@", "@")],
      [deploy + "?sslmode=disable", runtime], [deploy, runtime + "#fragment"],
      [runtime, deploy],
    ]) expect(() => check(d, r)).toThrow();
    expect(() => check(deploy, runtime, "canonical-upgrade" as "runtime")).toThrow("operation");
    expect(() => assertCreditDeliveryTargets(deploy, runtime, "runtime", "ci-canonical", true, "127.0.0.1:55503", true)).toThrow();
  });
  test("genuine legacy NULL-version heads cannot claim a property; no constraint bypass is used", () => {
    const predecessor = readFileSync(new URL("../migrations/0078_fiscal_submission_durability.sql", import.meta.url), "utf8");
    expect(predecessor).toMatch(/delivery_version IS NULL[\s\S]*?num_nonnulls\(property_node[\s\S]*?\)=0/);
    const request = readFileSync(new URL("../migrations/0079_fiscal_immutable_command_receipts.sql", import.meta.url), "utf8");
    expect(request).toContain("'reporting','pending',1,p_property");
    expect(request).toContain("issued fiscal document already has a submission, including legacy evidence");
  });
});

(required ? describe.serial : describe.skip)("Order452 genuine native CRN delivery discovery", () => {
  let deploy: SQL; let runtime: Database; let workerPool: SQL;
  beforeAll(async () => {
    deploy = new SQL(deployUrl!, { max: 2, prepare: false });
    runtime = Database.connect(runtimeUrl!, { maxConnections: 2, prepare: false });
    workerPool = new SQL(runtimeUrl!, { max: 1, prepare: false });
    const [row] = await deploy<{ version: number; installed: boolean }[]>`SELECT max(version)::int version,
      to_regprocedure('public.read_india_native_credit_delivery_by_document(uuid,uuid,uuid,uuid)') IS NOT NULL installed FROM public.schema_migration`;
    expect(row).toEqual({ version: mode === "native-draft" ? 88 : 89, installed: true });
  });
  afterAll(async () => { await runtime?.close(); await workerPool?.close(); await deploy?.close(); });
  const read = (s: CreditDeliveryScenario) => runtime.withTenantTransaction(s.tenantId, tx => readCreditDelivery(tx, s));
  async function sameReceipt(s: CreditDeliveryScenario & { submissionId: string }) {
    const before = await creditDeliveryRows(deploy);
    const expected = await runtime.withTenantTransaction(s.tenantId, async tx => {
      const [row] = await tx<{ receipt: Record<string, unknown> }[]>`SELECT public.read_india_fiscal_submission_delivery_receipt(
        ${s.tenantId}::uuid,${s.propertyNode}::uuid,${s.submissionId}::uuid,${s.actorId}::uuid) receipt`;
      return row!.receipt;
    });
    expect(await read(s)).toEqual({ kind: "receipt", documentId: s.documentId, receipt: expected });
    expect(await creditDeliveryRows(deploy)).toEqual(before);
    return expected;
  }
  async function run(s: CreditDeliveryScenario & { submissionId: string }, protocol: Order440ClearIrpProtocol) {
    return new FiscalSubmissionWorker(new FiscalSubmissionRepository(workerPool),
      new VerifiedIndiaIrpAdapterRegistry([await protocol.createRegistration(s.provider)])).runOnce({
      tenantId: s.tenantId, submissionId: s.submissionId, ...s.provider, leaseSeconds: 60, transportDeadlineMs: 20_000 });
  }
  async function waitForLookupDue(s: CreditDeliveryScenario & { submissionId: string }): Promise<void> {
    // Same natural database-clock wait as Order447; never retime a claim or bypass the worker.
    const expiresAt = performance.now() + 20_000;
    while (performance.now() < expiresAt) {
      const [row] = await deploy<{ due: boolean; remainingMs: number }[]>`
        SELECT claim_expires_at + interval '15 seconds' <= clock_timestamp() AS due,
          ceil(greatest(0,extract(epoch FROM (
            claim_expires_at + interval '15 seconds' - clock_timestamp()
          )) * 1000))::integer AS "remainingMs"
        FROM public.fiscal_submission
        WHERE tenant_id=${s.tenantId}::uuid AND id=${s.submissionId}::uuid
          AND status='submitted' AND disposition='lookup'`;
      if (!row || typeof row.due !== "boolean" || !Number.isInteger(row.remainingMs) || row.remainingMs < 0) {
        throw new Error("Order452 credit submission lookup state is invalid");
      }
      if (row.due) return;
      const remainingBudget = Math.floor(expiresAt - performance.now());
      if (remainingBudget < 1) break;
      await Bun.sleep(Math.max(1, Math.min(row.remainingMs, remainingBudget, 250)));
    }
    throw new Error("Order452 credit submission did not naturally become lookup-due");
  }
  async function denied(s: CreditDeliveryScenario) {
    for (const documentId of [s.documentId, crypto.randomUUID()]) {
      let state: string | undefined;
      try { await read({ ...s, documentId }); } catch (error) { state = creditSqlState(error); }
      expect(state).toBe("42501");
    }
  }

  test("not_requested and authorized missing/foreign credit are read-only; both scopes authorize before absence", async () => {
    const s = await createCreditDeliveryScenario(deploy, runtime);
    const foreign = await createCreditDeliveryScenario(deploy, runtime);
    const before = await creditDeliveryRows(deploy);
    expect(await read(s)).toEqual({ kind: "not_requested", documentId: s.documentId });
    expect(await read({ ...s, documentId: crypto.randomUUID() })).toBeNull();
    expect(await read({ ...s, documentId: foreign.documentId })).toBeNull();
    expect(await read({ ...s, documentId: s.candidate.invoice.documentId })).toBeNull();
    await denied({ ...s, actorId: s.unauthorizedActorId });
    await denied({ ...s, propertyNode: foreign.propertyNode });
    const readonly = await workerPool.begin(async tx => {
      await tx.unsafe("SET TRANSACTION READ ONLY");
      await tx.unsafe("SET LOCAL ROLE app_role");
      await tx`SELECT set_config('app.tenant_id',${s.tenantId},true)`;
      return readCreditDelivery(tx as unknown as Tx, s);
    });
    expect(readonly).toEqual({ kind: "not_requested", documentId: s.documentId });
    for (const [actorId, expected] of [[s.actorId, "22023"], [s.unauthorizedActorId, "42501"]] as const) {
      let state: string | undefined;
      try { await runtime.withTenantTransaction(s.tenantId, tx => tx`SELECT public.read_india_native_credit_delivery_by_document(
        ${s.tenantId}::uuid,${s.propertyNode}::uuid,${actorId}::uuid,NULL::uuid)`); }
      catch (error) { state = creditSqlState(error); }
      expect(state).toBe(expected);
    }
    for (const statement of ["SELECT id,property_node FROM public.fiscal_submission LIMIT 0",
      "SELECT * FROM public.fiscal_submission_history LIMIT 0",
      "DELETE FROM public.india_native_fiscal_credit_note WHERE false"]) {
      let state: string | undefined;
      try { await runtime.withTenantTransaction(s.tenantId, tx => tx.unsafe(statement)); }
      catch (error) { state = creditSqlState(error); }
      expect(state).toBe("42501");
    }
    expect(await creditDeliveryRows(deploy)).toEqual(before);
    // Alter only our synthetic role; restore exactly, including on assertion failure.
    for (const missing of [["tax-fiscal.documents:read"], ["tax-fiscal.submissions:read"],
      ["tax-fiscal.documents:read", "tax-fiscal.submissions:read"]]) {
      try {
        for (const code of missing) await deploy`DELETE FROM public.role_permission WHERE role_id=${s.roleId}::uuid AND permission_code=${code}`;
        const revoked = await creditDeliveryRows(deploy); await denied(s);
        expect(await creditDeliveryRows(deploy)).toEqual(revoked);
      } finally {
        for (const code of missing) await deploy`INSERT INTO public.role_permission(role_id,permission_code) VALUES(${s.roleId}::uuid,${code})`;
      }
      expect(await creditDeliveryRows(deploy)).toEqual(before);
    }
    try {
      await deploy`UPDATE public.app_user SET status='inactive' WHERE tenant_id=${s.tenantId}::uuid AND id=${s.actorId}::uuid`;
      const revoked = await creditDeliveryRows(deploy); await denied(s); expect(await creditDeliveryRows(deploy)).toEqual(revoked);
    } finally { await deploy`UPDATE public.app_user SET status='active' WHERE tenant_id=${s.tenantId}::uuid AND id=${s.actorId}::uuid`; }
    const membership = await deploy<{ row: Record<string, unknown> }[]>`SELECT to_jsonb(u) row FROM public.user_role u
      WHERE tenant_id=${s.tenantId}::uuid AND user_id=${s.actorId}::uuid`;
    try {
      await deploy`DELETE FROM public.user_role WHERE tenant_id=${s.tenantId}::uuid AND user_id=${s.actorId}::uuid`;
      const revoked = await creditDeliveryRows(deploy); await denied(s); expect(await creditDeliveryRows(deploy)).toEqual(revoked);
    } finally {
      for (const { row } of membership) await deploy`INSERT INTO public.user_role SELECT (jsonb_populate_record(NULL::public.user_role,${JSON.stringify(row)}::jsonb)).*`;
    }
    expect(await creditDeliveryRows(deploy)).toEqual(before);
  }, 120_000);

  test("pending then real encrypted response-loss lookup and accepted CRN return exactly unchanged0086 receipt with zero read effects", async () => {
    const s = await requestCreditDelivery(runtime, await createCreditDeliveryScenario(deploy, runtime));
    const financial = await creditSubmissionFinancialFingerprint(deploy, s.tenantId);
    expect(await sameReceipt(s)).toMatchObject({ kind: "pending", status: "pending", disposition: "send" });
    const protocol = await createOrder447CreditProtocol(await creditDeliveryProtocolDocument(deploy, s), "accepted_after_response_loss");
    expect(await run(s, protocol)).toMatchObject({ ok: true, kind: "reconciled", status: "submitted", disposition: "lookup" });
    const submittedMetrics = protocol.metrics();
    expect(submittedMetrics).toMatchObject({ submissionPosts: 1, documentLookups: 0 });
    expect(await run(s, protocol)).toEqual({ ok: true, kind: "idle", reason: "busy" });
    expect(protocol.metrics()).toEqual({ ...submittedMetrics, adapterInstances: submittedMetrics.adapterInstances + 1 });
    const lookupMetrics = protocol.metrics();
    expect(await sameReceipt(s)).toMatchObject({ kind: "pending", disposition: "lookup" });
    expect(protocol.metrics()).toEqual(lookupMetrics);
    await waitForLookupDue(s);
    expect(protocol.metrics()).toEqual(lookupMetrics);
    expect(await run(s, protocol)).toMatchObject({ ok: true, kind: "reconciled", action: "lookup", status: "accepted" });
    const metrics = protocol.metrics();
    expect(metrics).toMatchObject({ submissionPosts: 1, documentLookups: 1,
      submittedWireSha256: submittedMetrics.submittedWireSha256 });
    expect(await sameReceipt(s)).toMatchObject({ kind: "accepted_signed_v1", documentId: s.documentId });
    expect(protocol.metrics()).toEqual(metrics);
    expect(await creditSubmissionFinancialFingerprint(deploy, s.tenantId)).toBe(financial);
  }, 120_000);

  test("authenticated rejection remains terminal and GET neither resends nor invents IRN", async () => {
    const s = await requestCreditDelivery(runtime, await createCreditDeliveryScenario(deploy, runtime));
    const protocol = await createOrder440ClearIrpProtocol(await creditDeliveryProtocolDocument(deploy, s), "rejected");
    expect(await run(s, protocol)).toMatchObject({ ok: true, kind: "reconciled", status: "rejected", disposition: "none" });
    const metrics = protocol.metrics(); const receipt = await sameReceipt(s);
    expect(receipt).toMatchObject({ kind: "rejected", errorCodes: ["2150"] }); expect(receipt).not.toHaveProperty("irn");
    expect(protocol.metrics()).toEqual(metrics);
    expect(await run(s, protocol)).toEqual({ ok: true, kind: "idle", reason: "terminal" });
    const terminalMetrics = protocol.metrics();
    expect(terminalMetrics.adapterInstances).toBe(metrics.adapterInstances + 1);
    expect(terminalMetrics).toMatchObject({ authenticationRequests: metrics.authenticationRequests,
      submissionPosts: metrics.submissionPosts, documentLookups: metrics.documentLookups,
      submittedWireSha256: metrics.submittedWireSha256 });
  }, 120_000);

  test("governed known-not-sent preserves the exact existing provider retry binding without granting retry", async () => {
    const s = await requestCreditDelivery(runtime, await createCreditDeliveryScenario(deploy, runtime));
    const claim = await workerPool.begin(async tx => {
      await tx`SELECT set_config('app.tenant_id',${s.tenantId},true)`;
      const [row] = await tx<{ value: Record<string, unknown> }[]>`SELECT public.claim_india_fiscal_submission(${s.tenantId}::uuid,${s.submissionId}::uuid,60) value`;
      return row!.value;
    });
    expect(claim.claimed).toBe(true);
    await workerPool.begin(async tx => {
      await tx`SELECT set_config('app.tenant_id',${s.tenantId},true)`;
      await tx`SELECT public.reconcile_india_fiscal_submission(${s.tenantId}::uuid,${s.submissionId}::uuid,
        ${claim.attemptId as string}::uuid,${claim.claimToken as string}::uuid,${JSON.stringify({ type: "transport_result",
          tenantId: s.tenantId, providerKey: claim.providerKey, attemptId: claim.attemptId, documentId: s.documentId,
          payloadSha256: claim.wireSha256, outcome: "known_not_sent" })}::jsonb)`;
    });
    expect(await sameReceipt(s)).toMatchObject({ kind: "pending", status: "error", disposition: "retry",
      retryBinding: { providerExtensionId: s.provider.providerExtensionId, providerExtensionVersion: 1 } });
  }, 120_000);

  test("a second governed provider request is rejected rather than fabricating an unreachable multi-head credit", async () => {
    const s = await requestCreditDelivery(runtime, await createCreditDeliveryScenario(deploy, runtime));
    const provider = { ...s.provider, providerKey: "order452-secondary", providerExtensionId: crypto.randomUUID() };
    await deploy`INSERT INTO public.extension(id,tenant_id,type,key,version,effective,content,status)
      VALUES(${provider.providerExtensionId}::uuid,${s.tenantId}::uuid,'fiscal_provider',${`secondary-${provider.providerExtensionId}`},1,
        tstzrange(NULL,NULL,'[)'),${JSON.stringify({ jurisdiction: "IN", mode: "in_house_reporting",
          provider_key: provider.providerKey, document_formats: ["irp_json_1_1"] })}::jsonb,'active')`;
    const before = await creditDeliveryRows(deploy);
    let state: string | undefined;
    try { await requestCreditDelivery(runtime, { ...s, provider }); }
    catch (error) { state = creditSqlState(error); }
    expect(state).toBe("23505");
    expect(await creditDeliveryRows(deploy)).toEqual(before);
    expect(await sameReceipt(s)).toMatchObject({ kind: "pending", submissionId: s.submissionId });
  }, 120_000);

  test("signed credit discovery survives real strictly owned outbox pruning including issuance events", async () => {
    const s = await requestCreditDelivery(runtime, await createCreditDeliveryScenario(deploy, runtime));
    const protocol = await createOrder447CreditProtocol(await creditDeliveryProtocolDocument(deploy, s), "accepted");
    expect(await run(s, protocol)).toMatchObject({ ok: true, kind: "reconciled", status: "accepted" });
    const receipt = await sameReceipt(s); const metrics = protocol.metrics();
    const financial = await creditSubmissionFinancialFingerprint(deploy, s.tenantId);
    const owned = await deploy<{ id: string }[]>`SELECT id::text id FROM public.outbox WHERE tenant_id=${s.tenantId}::uuid ORDER BY id`;
    expect(owned.length).toBeGreaterThan(3);
    const [issuance] = await deploy<{ count: number }[]>`SELECT count(*)::int count FROM public.outbox
      WHERE tenant_id=${s.tenantId}::uuid AND aggregate_id=${s.documentId}::uuid`;
    expect(issuance!.count).toBeGreaterThan(0);
    await deploy.begin(async tx => {
      await tx.unsafe("SET LOCAL lock_timeout='5s'"); await tx.unsafe("SET LOCAL statement_timeout='15s'");
      await tx.unsafe("LOCK TABLE public.outbox,public.consumer_processed IN SHARE ROW EXCLUSIVE MODE");
      // Never retime prior publications; this cohort is newly created by this test.
      const prior = await tx<{ count: number }[]>`SELECT count(*)::int count FROM public.outbox
        WHERE tenant_id=${s.tenantId}::uuid AND published_at IS NOT NULL`;
      expect(prior[0]!.count).toBe(0);
      // runtime_prune_outbox uses transaction now(); obtain eligibility using that
      // exact clock, not elapsed-time assumptions or a blanket tenant exception.
      await tx`UPDATE public.outbox SET published_at=now() - interval '1 microsecond'
        WHERE tenant_id=${s.tenantId}::uuid AND published_at IS NULL`;
      const eligible = await tx<{ id: string; tenant: string }[]>`SELECT id::text id,tenant_id::text tenant FROM public.outbox
        WHERE published_at IS NOT NULL AND published_at<now() ORDER BY id`;
      expect(eligible.map(e => ({ id: e.id }))).toEqual(owned.map(e => ({ id: e.id })));
      expect(eligible.every(e => e.tenant === s.tenantId)).toBe(true);
      const consumers = await tx<{ id: string }[]>`SELECT p.outbox_id::text id FROM public.consumer_processed p
        JOIN public.outbox e ON e.id=p.outbox_id WHERE e.published_at IS NOT NULL AND e.published_at<now()`;
      expect(consumers.every(p => owned.some(e => e.id === p.id))).toBe(true);
      const outside = await tx`SELECT to_jsonb(e)::text body FROM public.outbox e WHERE tenant_id<>${s.tenantId}::uuid ORDER BY id`;
      const outsideConsumers = await tx`SELECT to_jsonb(p)::text body FROM public.consumer_processed p
        WHERE NOT EXISTS(SELECT 1 FROM public.outbox e WHERE e.id=p.outbox_id AND e.tenant_id=${s.tenantId}::uuid)
        ORDER BY to_jsonb(p)::text COLLATE "C"`;
      await tx.unsafe("SET LOCAL ROLE yellow_runtime");
      const [pruned] = await tx<{ processed: number; outbox: bigint }[]>`SELECT * FROM public.runtime_prune_outbox(0)`;
      expect(pruned!.processed).toBe(consumers.length); expect(String(pruned!.outbox)).toBe(String(owned.length));
      await tx.unsafe("RESET ROLE");
      expect(await tx`SELECT to_jsonb(e)::text body FROM public.outbox e ORDER BY id`).toEqual(outside);
      expect(await tx`SELECT to_jsonb(p)::text body FROM public.consumer_processed p ORDER BY to_jsonb(p)::text COLLATE "C"`).toEqual(outsideConsumers);
    });
    expect(await sameReceipt(s)).toEqual(receipt); expect(protocol.metrics()).toEqual(metrics);
    expect(await creditSubmissionFinancialFingerprint(deploy, s.tenantId)).toBe(financial);
  }, 120_000);

  test("fixed owner fault helpers reach actual runtime read and roll back corrupt binding, hash, reference, receipt and head", async () => {
    const s = await requestCreditDelivery(runtime, await createCreditDeliveryScenario(deploy, runtime));
    const [binding] = await deploy<{ id: string }[]>`SELECT id::text id FROM public.india_native_fiscal_credit_note
      WHERE tenant_id=${s.tenantId}::uuid AND document_id=${s.documentId}::uuid`;
    expect(binding).toBeDefined();
    const uuid = (value: string) => {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)) throw new Error("Fault fixture UUID invalid");
      return `'${value}'::uuid`;
    };
    const tenant = uuid(s.tenantId); const document = uuid(s.documentId); const credit = uuid(binding!.id);
    const property = uuid(s.propertyNode); const actor = uuid(s.actorId); const submission = uuid(s.submissionId);
    const whereCredit = `tenant_id=${tenant} AND id=${credit} AND document_id=${document}`;
    const whereDocument = `tenant_id=${tenant} AND id=${document}`;
    // Fixed closed cases only: no SQL received from a caller or environment.
    const cases = [
      { name: "planned_binding", tables: ["india_native_fiscal_credit_note"], sql:
        `UPDATE public.india_native_fiscal_credit_note SET planned_document=planned_document||'{"forged":true}'::jsonb WHERE ${whereCredit};` },
      { name: "credit_hash", tables: ["document", "india_native_fiscal_credit_note"], sql:
        `UPDATE public.document SET sha256=repeat('0',64) WHERE ${whereDocument};
         UPDATE public.india_native_fiscal_credit_note SET planned_document=(SELECT to_jsonb(d) FROM public.document d WHERE ${whereDocument}) WHERE ${whereCredit};` },
      { name: "original_reference", tables: ["document", "india_native_fiscal_credit_note"], sql:
        `UPDATE public.document SET content=jsonb_set(content,'{RefDtls,PrecDocDtls,0,InvNo}','"WRONG452"'::jsonb) WHERE ${whereDocument};
         UPDATE public.document SET sha256=encode(public.digest(convert_to(content::text,'UTF8'),'sha256'),'hex') WHERE ${whereDocument};
         UPDATE public.india_native_fiscal_credit_note SET planned_document=(SELECT to_jsonb(d) FROM public.document d WHERE ${whereDocument}) WHERE ${whereCredit};` },
      { name: "issuance_receipt", tables: ["india_native_fiscal_credit_note"], sql:
        `UPDATE public.india_native_fiscal_credit_note SET receipt_json=jsonb_set(receipt_json::jsonb,'{sha256}',to_jsonb(repeat('0',64)))::text WHERE ${whereCredit};` },
      { name: "head_hash", tables: ["fiscal_submission"], sql:
        `UPDATE public.fiscal_submission SET document_sha256=repeat('0',64) WHERE tenant_id=${tenant} AND id=${submission} AND document_id=${document};` },
    ] as const;
    for (const fault of cases) {
      const helper = `order452_read_fault_${crypto.randomUUID().replaceAll("-", "")}`;
      expect(helper).toMatch(/^order452_read_fault_[0-9a-f]{32}$/);
      const before = { rows: await creditDeliveryRows(deploy), catalogue: await creditDeliveryCatalogue(deploy) };
      const [collision] = await deploy<{ absent: boolean }[]>`SELECT to_regprocedure(${`public.${helper}()`}) IS NULL absent`;
      expect(collision!.absent).toBe(true);
      let installed = false;
      try {
        await deploy.begin(async tx => {
          await tx.unsafe(`CREATE FUNCTION public.${helper}() RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
            SET search_path=pg_catalog,public,pg_temp SET timezone='UTC' SET datestyle='ISO,YMD' AS $fault$
            BEGIN
              PERFORM public.assert_india_native_credit_authority(${tenant},${property},${actor},
                ARRAY['tax-fiscal.documents:read','tax-fiscal.submissions:read']);
              LOCK TABLE ${fault.tables.map(t => `public.${t}`).join(",")} IN ACCESS EXCLUSIVE MODE;
              ${fault.tables.map(t => `ALTER TABLE public.${t} DISABLE TRIGGER USER;`).join("\n")}
              ${fault.sql}
              ${fault.tables.map(t => `ALTER TABLE public.${t} ENABLE TRIGGER USER;`).join("\n")}
              RETURN public.read_india_native_credit_delivery_by_document(${tenant},${property},${actor},${document});
            END $fault$;
            ALTER FUNCTION public.${helper}() OWNER TO yellow_owner;
            REVOKE ALL ON FUNCTION public.${helper}() FROM PUBLIC,app_role,yellow_runtime;
            GRANT EXECUTE ON FUNCTION public.${helper}() TO app_role;`);
        });
        installed = true;
        const [acl] = await deploy<{ safe: boolean }[]>`SELECT NOT EXISTS(
          SELECT 1 FROM pg_catalog.pg_proc p, LATERAL pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
          WHERE p.oid=to_regprocedure(${`public.${helper}()`}) AND (a.is_grantable OR a.privilege_type<>'EXECUTE'
            OR a.grantee NOT IN ('yellow_owner'::regrole::oid,'app_role'::regrole::oid))) safe`;
        expect(acl!.safe).toBe(true);
        let state: string | undefined;
        try {
          await runtime.withTenantTransaction(s.tenantId, async tx => {
            await tx.unsafe("SET LOCAL lock_timeout='5s'"); await tx.unsafe("SET LOCAL statement_timeout='15s'");
            await tx.unsafe(`SELECT public.${helper}()`);
            // A missing rejection must still roll back every privileged change.
            throw new Error(`Order452 ${fault.name} unexpectedly returned`);
          });
        } catch (error) { state = creditSqlState(error); }
        expect(state).toBe("55000");
        expect(await creditDeliveryRows(deploy)).toEqual(before.rows);
      } finally {
        if (installed) await deploy.unsafe(`DROP FUNCTION public.${helper}()`);
      }
      expect({ rows: await creditDeliveryRows(deploy), catalogue: await creditDeliveryCatalogue(deploy) }).toEqual(before);
      expect(await sameReceipt(s)).toMatchObject({ kind: "pending", documentId: s.documentId });
    }
  }, 120_000);
});
