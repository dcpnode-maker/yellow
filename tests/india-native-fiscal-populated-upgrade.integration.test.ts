import { describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { runMigrations } from "../scripts/migrate";
import { IssueIndiaNativeFiscalInvoiceCommand } from "../src/commands/issue-india-native-fiscal-invoice";
import { Hs256TokenSigner } from "../src/contexts/identity";
import { IndiaNativeFiscalDocumentReadService } from "../src/contexts/tax-fiscal/india-native-fiscal-document-read";
import { IndiaNativeFiscalOperatorReadService } from "../src/contexts/tax-fiscal/india-native-fiscal-operator";
import { Database } from "../src/kernel";
import { createNativeIssuanceCohort, createNativeIssuanceFixture } from "./fixtures/india-native-fiscal-source-completion-fixture";
import {
  createFiscalSubmissionHttpScenario, fiscalRequest, fiscalRetryRequest,
  fiscalSubmissionHttpApp, fiscalToken, type FiscalSubmissionHttpBody,
} from "./fixtures/order440-fiscal-submission-http";
import {
  claimSignedFiscalSubmission, createSignedFiscalReceiptFactory, readSignedFiscalReceipt,
  reconcileSignedFiscalSubmission, type SignedFiscalScenario,
} from "./fixtures/order440-signed-fiscal-receipt";
import { issueOperatorInvoice } from "./fixtures/order440-operator-invoices";

// Allocation belongs to the caller. In particular this test never runs 1-12 on
// the retained native cluster, creates a database, or changes global roles.
const deployUrl = process.env.YELLOW_ORDER440_Q209_DEPLOY_DATABASE_URL;
const runtimeUrl = process.env.YELLOW_ORDER440_Q209_RUNTIME_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_ORDER440_Q209_DATABASE === "1" && (!deployUrl || !runtimeUrl)) {
  throw new Error("Q209 populated upgrade requires explicit deploy and runtime targets");
}
function assertTargets(deploy: string, runtime: string): void {
  const targets = [new URL(deploy), new URL(runtime)];
  for (const [index, target] of targets.entries()) {
    if (!/^(postgres|postgresql):$/.test(target.protocol)
      || !["127.0.0.1", "[::1]"].includes(target.hostname)
      || !/^\d{1,5}$/.test(target.port) || Number(target.port) < 1 || Number(target.port) > 65535
      || decodeURIComponent(target.username) !== (index === 0 ? "yellow_deploy" : "yellow_runtime")
      || !target.password || target.search || target.hash
      || !/^\/yellow_order440_q209_[a-z0-9_]+$/.test(target.pathname)) {
      throw new Error("Q209 requires a dedicated loopback proof target with split database authority");
    }
  }
  if (targets[0]!.host !== targets[1]!.host || targets[0]!.pathname !== targets[1]!.pathname) {
    throw new Error("Q209 database targets must match");
  }
}
if (deployUrl || runtimeUrl) {
  if (!deployUrl || !runtimeUrl) throw new Error("Q209 requires both database targets");
  assertTargets(deployUrl, runtimeUrl);
}
const databaseDescribe = deployUrl && runtimeUrl ? describe.serial : describe.skip;
const migrationDirectory = new URL("../migrations/", import.meta.url);
const forwardHashes = [
  "702f66b3e05547f397e2393ae5a608a6f0c3069ec534b2c947bfc309983bf185",
  "5a8ac565f3aaebfee4245121a434dba5867f558091a58aad87f23bed5dee0705",
  "e9d8b75f832e687f567806e82faaece7672cdbcf4ee8813c9c7b56cfc78ecd69",
  "c94c97efbb237fb99c5a35caf01faefa4d7fee98a07d8b30b89bec3ce0a7670c",
] as const;
const sha256 = (value: string | Uint8Array) => new Bun.CryptoHasher("sha256").update(value).digest("hex");

async function inputs() {
  const files = (await readdir(migrationDirectory)).filter(name => /^\d{4}_.*\.sql$/.test(name)).sort();
  expect(files).toHaveLength(85);
  expect(files.map(name => Number(name.slice(0, 4)))).toEqual(Array.from({ length: 85 }, (_, i) => i + 1));
  return Promise.all(files.map(async filename => ({ filename,
    checksum_sha256: sha256(await readFile(new URL(filename, migrationDirectory))) })));
}
async function ledger(sql: SQL) {
  return sql<{ version: number; filename: string; checksum_sha256: string; bytes: string }[]>`
    SELECT version::integer,filename,checksum_sha256,to_jsonb(m)::text AS bytes
    FROM public.schema_migration m ORDER BY version`;
}
async function assignments(sql: SQL) {
  return (await sql<{ bytes: string }[]>`
    SELECT to_jsonb(p)::text AS bytes FROM public.role_permission p ORDER BY to_jsonb(p)::text`).map(row => row.bytes);
}
async function clusterMetadata(sql: SQL) {
  const roles = await sql<{ bytes: string }[]>`SELECT to_jsonb(r)::text AS bytes FROM pg_roles r ORDER BY rolname`;
  const memberships = await sql<{ bytes: string }[]>`SELECT to_jsonb(m)::text AS bytes FROM pg_auth_members m
    ORDER BY roleid,member,grantor`;
  const databases = await sql<{ bytes: string }[]>`SELECT to_jsonb(d)::text AS bytes FROM pg_database d ORDER BY datname`;
  return { roles: roles.map(row => row.bytes), memberships: memberships.map(row => row.bytes),
    databases: databases.map(row => row.bytes) };
}
// All retained tenant rows, not just counts or a handpicked subset. JSONB text
// preserves PostgreSQL numeric/timestamp representation without JS bigint coercion.
async function tenantRows(sql: SQL, tenants: readonly string[]) {
  const tables = await sql<{ name: string }[]>`SELECT c.relname AS name FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid
    WHERE n.nspname='public' AND c.relkind='r' AND a.attname='tenant_id' AND NOT a.attisdropped
    ORDER BY c.relname`;
  const result: Record<string, readonly string[]> = {};
  for (const { name } of tables) {
    if (!/^[a-z0-9_]+$/.test(name)) throw new Error("Unexpected proof table identifier");
    const rows = await sql.unsafe<{ bytes: string }[]>(
      `SELECT to_jsonb(r)::text AS bytes FROM public.${name} r WHERE tenant_id=ANY($1::uuid[]) ORDER BY to_jsonb(r)::text`,
      [`{${tenants.join(",")}}`]);
    result[name] = rows.map(row => row.bytes);
  }
  return result;
}
async function documentBytes(sql: SQL, scenario: { tenantId: string; documentId: string }) {
  const [row] = await sql<{ content: string; sha256: string; previous: string | null; date: string; nextDate: string }[]>`
    SELECT content::text AS content,sha256,prev_hash AS previous,business_date::text AS date,
      (business_date+1)::text AS "nextDate" FROM public.document
    WHERE tenant_id=${scenario.tenantId}::uuid AND id=${scenario.documentId}::uuid`;
  if (!row) throw new Error("Genuine retained invoice is missing");
  return row;
}

test("Q209 target guard denies retained, mismatched and unsplit authority without connecting", () => {
  const deploy = "postgres://yellow_deploy:fictional@127.0.0.1:55503/yellow_order440_q209_ci";
  const runtime = deploy.replace("yellow_deploy:", "yellow_runtime:");
  expect(() => assertTargets(deploy, runtime)).not.toThrow();
  for (const invalid of [runtime.replace("q209_ci", "q208_ci"), runtime.replace("55503", "55504"),
    runtime.replace("yellow_runtime:", "yellow_deploy:"), runtime + "?sslmode=disable"]) {
    expect(() => assertTargets(deploy, invalid)).toThrow();
  }
});

databaseDescribe("Q209 genuine populated canonical81 to85 preservation", () => {
  test("preserves original signed receipts, every retry response and financial rows, then composes current85", async () => {
    const deploy = new SQL(deployUrl!, { max: 2, prepare: false, connectionTimeout: 5 });
    const runtime = new SQL(runtimeUrl!, { max: 2, prepare: false, connectionTimeout: 5 });
    const database = Database.connect(runtimeUrl!, { maxConnections: 3, prepare: false });
    try {
      const sourceBefore = await inputs();
      expect(sourceBefore.slice(81).map(row => row.checksum_sha256)).toEqual([...forwardHashes]);
      const oldLedger = await ledger(deploy);
      expect(oldLedger).toHaveLength(81);
      expect(oldLedger.map(({ filename, checksum_sha256 }) => ({ filename, checksum_sha256 })))
        .toEqual(sourceBefore.slice(0, 81));
      const [empty] = await deploy<{ tenants: string; permission: boolean }[]>`SELECT
        (SELECT count(*)::text FROM public.tenant) AS tenants,
        EXISTS(SELECT 1 FROM public.permission WHERE code='tax-fiscal.documents:read') AS permission`;
      expect(empty).toEqual({ tenants: "0", permission: false });
      const [login] = await runtime<{ name: string }[]>`SELECT session_user AS name`;
      expect(login?.name).toBe("yellow_runtime");
      const globalBefore = await clusterMetadata(deploy);
      const tokens = new Hs256TokenSigner("q209-populated-upgrade-only-fictional-session-key-48-bytes");
      const signed = await createSignedFiscalReceiptFactory();
      const retained: Array<{
        scenario: SignedFiscalScenario;
        replay: () => Promise<void>;
        receipt: unknown;
        document: Awaited<ReturnType<typeof documentBytes>>;
      }> = [];

      for (const outcome of ["accepted", "rejected", "pending", "in_flight"] as const) {
        const base = await createFiscalSubmissionHttpScenario(deploy, database);
        await deploy`INSERT INTO public.role_permission(role_id,permission_code)
          VALUES(${base.roleId}::uuid,'tax-fiscal.submissions:read')`;
        const token = await fiscalToken(tokens, base);
        const app = fiscalSubmissionHttpApp(database, tokens, [base.provider]);
        const requestKey = `q209-request-${crypto.randomUUID()}`;
        const first = await app.handle(fiscalRequest(base, token, requestKey));
        expect(first.status).toBe(201);
        const requestBytes = await first.text();
        const body = JSON.parse(requestBytes) as FiscalSubmissionHttpBody;
        const scenario: SignedFiscalScenario = { ...base, submissionId: body.fiscalSubmission.submissionId,
          requestIdempotencyKey: requestKey, requestReceipt: body.fiscalSubmission };
        const retries: { key: string; bytes: string }[] = [];
        // Real claim/reconcile/retry transactions establish three distinct durable
        // command keys before the signed fourth attempt. No terminal row fabrication.
        if (outcome === "accepted") for (let i = 0; i < 3; i++) {
          const claim = await claimSignedFiscalSubmission(runtime, scenario);
          await reconcileSignedFiscalSubmission(runtime, scenario, claim, {
            type: "transport_result", tenantId: claim.tenantId, providerKey: claim.providerKey,
            attemptId: claim.attemptId, documentId: claim.documentId,
            payloadSha256: claim.wireSha256, outcome: "known_not_sent",
          });
          const key = `q209-retry-${crypto.randomUUID()}`;
          const response = await app.handle(fiscalRetryRequest(base, token, scenario.submissionId, key));
          expect(response.status).toBe(201);
          retries.push({ key, bytes: await response.text() });
        }
        if (outcome !== "pending") {
          const claim = await claimSignedFiscalSubmission(runtime, scenario);
          if (outcome !== "in_flight") {
            // The reused factory signs fresh fictional RSA artifacts and executes
            // the real immutable-issued-source binding verifier before returning.
            const result = outcome === "accepted" ? await signed.accepted(claim) : signed.rejected(claim);
            await reconcileSignedFiscalSubmission(runtime, scenario, claim, result);
          }
        }
        const receipt = await readSignedFiscalReceipt(runtime, scenario);
        expect(receipt).toMatchObject({ kind: outcome === "accepted" ? "accepted_signed_v1"
          : outcome === "rejected" ? "rejected" : "pending" });
        const [state] = await deploy<{ status: string; attempts: number; retries: number }[]>`
          SELECT status,attempt_number AS attempts,retry_count AS retries FROM public.fiscal_submission
          WHERE tenant_id=${base.tenantId}::uuid AND id=${scenario.submissionId}::uuid`;
        expect(state).toMatchObject({ status: outcome === "in_flight" ? "submitted"
          : outcome === "pending" ? "pending" : outcome,
          attempts: outcome === "accepted" ? 4 : 1, retries: outcome === "accepted" ? 3 : 0 });
        const replay = async () => {
          for (const command of [{ key: requestKey, bytes: requestBytes, initial: true },
            ...retries.map(row => ({ ...row, initial: false }))]) {
            const response = await app.handle(command.initial ? fiscalRequest(base, token, command.key)
              : fiscalRetryRequest(base, token, scenario.submissionId, command.key));
            expect(response.status).toBe(201);
            expect(response.headers.get("idempotency-replayed")).toBe("true");
            expect(response.headers.get("cache-control")).toBe("no-store");
            expect(await response.text()).toBe(command.bytes);
          }
        };
        await replay(); // Positive predecessor replay, not solely an after-upgrade claim.
        retained.push({ scenario, replay, receipt, document: await documentBytes(deploy, scenario) });
      }
      const cohort = await createNativeIssuanceCohort(deploy, database, {
        label: `q209-native-${crypto.randomUUID().slice(0, 12)}`, count: 2,
      });
      const oldNative = cohort[0]!, nextNative = cohort[1]!;
      const command = new IssueIndiaNativeFiscalInvoiceCommand(database);
      const nativeReceipt = await command.execute(oldNative.request);
      const nextReceipt = await command.execute(nextNative.request);
      expect(nextReceipt.seriesId).toBe(nativeReceipt.seriesId);
      expect(nextReceipt.prevHash).toBe(nativeReceipt.sha256);
      expect(nextReceipt.docNo).not.toBe(nativeReceipt.docNo);
      const nativeReplay = await command.execute(oldNative.request);
      expect(nativeReplay).toEqual({ ...nativeReceipt, replayed: true });
      // This complete statutory/valuation/series graph exists at81, unissued.
      const unissued = await createNativeIssuanceFixture(deploy, database, {
        label: `q209-unissued-${crypto.randomUUID().slice(0, 12)}`,
        statutoryOriginalConfiguration: "karnataka_supplier_karnataka_property",
      });
      const tenants = [...retained.map(({ scenario }) => scenario.tenantId), oldNative.fixture.tenant,
        unissued.fixture.tenant];
      const before = await tenantRows(deploy, tenants);
      for (const table of ["document", "document_series", "journal", "posting_line", "fact_log", "outbox",
        "fiscal_submission", "fiscal_submission_history", "api_idempotency"]) {
        expect(before[table]!.length, `nonvacuous retained ${table}`).toBeGreaterThan(0);
      }
      const grantsBefore = await assignments(deploy);
      expect(grantsBefore.length).toBeGreaterThan(0);
      const upgrade = await runMigrations({ databaseUrl: deployUrl!,
        migrationsDirectory: fileURLToPath(migrationDirectory), logger: () => {} });
      expect(upgrade.appliedFiles).toEqual(sourceBefore.slice(81).map(row => row.filename));
      expect(upgrade.transactionBackendPids).toEqual(Array(4).fill(upgrade.backendPid));
      const finalLedger = await ledger(deploy);
      expect(finalLedger.slice(0, 81)).toEqual(oldLedger);
      expect(finalLedger.map(({ filename, checksum_sha256 }) => ({ filename, checksum_sha256 }))).toEqual(sourceBefore);
      expect(await tenantRows(deploy, tenants)).toEqual(before);
      expect(await assignments(deploy)).toEqual(grantsBefore);
      expect((await deploy<{ count: string }[]>`SELECT count(*)::text AS count FROM public.role_permission
        WHERE permission_code='tax-fiscal.documents:read'`)[0]?.count).toBe("0");

      for (const row of retained) {
        await row.replay();
        expect(await readSignedFiscalReceipt(runtime, row.scenario)).toEqual(row.receipt);
        expect(await documentBytes(deploy, row.scenario)).toEqual(row.document);
      }
      expect(await command.execute(oldNative.request)).toEqual(nativeReplay);
      expect(await command.execute(nextNative.request)).toEqual({ ...nextReceipt, replayed: true });
      expect(await tenantRows(deploy, tenants)).toEqual(before);

      const reader = new IndiaNativeFiscalDocumentReadService();
      const operator = new IndiaNativeFiscalOperatorReadService();
      const first = retained[0]!;
      const scope = { tenantId: first.scenario.tenantId, propertyNode: first.scenario.propertyNode,
        actorId: first.scenario.actorId, documentId: first.scenario.documentId };
      expect(await database.withTenantTransaction(scope.tenantId, tx => reader.read(tx, scope)))
        .toEqual({ ok: true, value: null });
      expect(await database.withTenantTransaction(scope.tenantId, tx => reader.list(tx, {
        tenantId: scope.tenantId, propertyNode: scope.propertyNode, actorId: scope.actorId,
        issuedFrom: first.document.date, issuedBefore: first.document.nextDate, limit: 10,
      }))).toMatchObject({ ok: false, error: { code: "permission_denied" } });
      // Explicit test-only grants AFTER the unchanged migration/no-auto-grant proof.
      const actors = [...retained.map(({ scenario }) => scenario.actorId), oldNative.fixture.actor,
        unissued.fixture.actor];
      const added = await deploy<{ bytes: string }[]>`INSERT INTO public.role_permission(role_id,permission_code)
        SELECT DISTINCT role_id,'tax-fiscal.documents:read' FROM public.user_role
        WHERE tenant_id=ANY(${`{${tenants.join(",")}}`}::uuid[])
          AND user_id=ANY(${`{${actors.join(",")}}`}::uuid[])
        RETURNING to_jsonb(role_permission)::text AS bytes`;
      expect(added.length).toBeGreaterThan(0);
      for (const row of retained) {
        const input = { tenantId: row.scenario.tenantId, propertyNode: row.scenario.propertyNode,
          actorId: row.scenario.actorId, documentId: row.scenario.documentId };
        const detail = await database.withTenantTransaction(input.tenantId, tx => reader.read(tx, input));
        expect(detail).toMatchObject({ ok: true, value: { documentId: input.documentId,
          contentJson: row.document.content, documentSha256: row.document.sha256, previousHash: row.document.previous } });
        const list = await database.withTenantTransaction(input.tenantId, tx => reader.list(tx, {
          tenantId: input.tenantId, propertyNode: input.propertyNode, actorId: input.actorId,
          issuedFrom: row.document.date, issuedBefore: row.document.nextDate, limit: 10,
        }));
        expect(list).toMatchObject({ ok: true, value: { matchingCount: "1", items: [{ documentId: input.documentId }] } });
        const delivery = await database.withTenantTransaction(input.tenantId, tx => operator.readDelivery(tx, input));
        expect<unknown>(delivery).toEqual({ ok: true, value: { kind: "receipt", documentId: input.documentId, receipt: row.receipt } });
      }
      expect(await database.withTenantTransaction(scope.tenantId,
        tx => reader.read(tx, { ...scope, actorId: first.scenario.unauthorizedActorId })))
        .toEqual({ ok: true, value: null });
      const foreign = retained[1]!.scenario;
      expect(await database.withTenantTransaction(foreign.tenantId, tx => reader.read(tx, {
        tenantId: foreign.tenantId, propertyNode: foreign.propertyNode, actorId: foreign.actorId,
        documentId: first.scenario.documentId,
      }))).toEqual({ ok: true, value: null });
      expect(await tenantRows(deploy, tenants)).toEqual(before);

      const readinessInput = { tenantId: unissued.fixture.tenant, propertyNode: unissued.fixture.property,
        actorId: unissued.fixture.actor, reservationId: unissued.fixture.reservation,
        folioId: unissued.request.folioId, recipientRegistrationId: unissued.statutory.recipient.registrationId,
        calendarEvidence: unissued.request.calendarEvidence };
      const readiness = await database.withTenantTransaction(unissued.fixture.tenant,
        tx => operator.discover(tx, readinessInput));
      expect(readiness).toMatchObject({ ok: true, value: { kind: "ready" } });
      if (!readiness.ok || readiness.value.kind !== "ready") throw new Error("Retained81 source was not ready at85");
      const issued85 = await issueOperatorInvoice(database, unissued,
        readiness.value.selectorHash, readiness.value.evidenceHash);
      expect(issued85).toMatchObject({ status: "issued", replayed: false });
      expect(await issueOperatorInvoice(database, unissued, readiness.value.selectorHash, readiness.value.evidenceHash))
        .toEqual({ ...issued85, replayed: true });
      const oldTenants = tenants.filter(tenant => tenant !== unissued.fixture.tenant);
      expect(await tenantRows(deploy, oldTenants)).toEqual(tenantRowsFromBefore(before, oldTenants));
      expect([...(await assignments(deploy))].sort()).toEqual([...grantsBefore, ...added.map(row => row.bytes)].sort());
      expect(await clusterMetadata(deploy)).toEqual(globalBefore);
      expect(await ledger(deploy)).toEqual(finalLedger);
      expect(await inputs()).toEqual(sourceBefore);
    } finally {
      await Promise.all([database.close(), runtime.close({ timeout: 0 }), deploy.close({ timeout: 0 })]);
    }
  }, 180_000);
});

function tenantRowsFromBefore(before: Record<string, readonly string[]>, tenants: readonly string[]) {
  return Object.fromEntries(Object.entries(before).map(([table, rows]) =>
    [table, rows.filter(row => tenants.includes((JSON.parse(row) as { tenant_id: string }).tenant_id))]));
}
