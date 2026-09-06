import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { copyFile, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { runMigrations } from "../scripts/migrate";
import { IssueIndiaNativeFiscalInvoiceCommand } from "../src/commands/issue-india-native-fiscal-invoice";
import { RequestIndiaFiscalSubmissionCommand } from "../src/commands/request-india-fiscal-submission";
import { RetryIndiaFiscalSubmissionCommand } from "../src/commands/retry-india-fiscal-submission";
import { projectIssuedIndiaIrpWireCandidate } from "../src/contexts/tax-fiscal/india-irp-issued-wire-candidate";
import { FiscalSubmissionRepository } from "../src/contexts/tax-fiscal/fiscal-submission-repository";
import { FiscalSubmissionWorker, VerifiedIndiaIrpAdapterRegistry, type FiscalSubmissionWorkerStepInput } from "../src/contexts/tax-fiscal/fiscal-submission-worker";
import { Database, PostgresEventBus, PostgresIdempotency, type Tx } from "../src/kernel";
import { BusinessDaySealConflictError, BusinessDaySealService } from "../src/contexts/financials";
import { LAUNCH_EXTENSION_TYPES } from "../scripts/seed";
import { createNativeIssuanceFixture, type NativeStatutoryOriginalConfiguration } from "./fixtures/india-native-fiscal-source-completion-fixture";

const deployUrl = process.env.YELLOW_ORDER440_DURABLE_DEPLOY_DATABASE_URL;
const runtimeUrl = process.env.YELLOW_ORDER440_DURABLE_RUNTIME_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_ORDER440_DURABILITY === "1" && (!deployUrl || !runtimeUrl)) {
  throw new Error("Order440 durability proof requires explicit isolated deploy and runtime URLs");
}
const databaseDescribe = deployUrl && runtimeUrl ? describe.serial : describe.skip;
type Json = Record<string, unknown>;
interface Scenario {
  tenant: string; property: string; actor: string; unauthorizedActor: string;
  document: string; provider: string; role: string; sourceHash: string; wire: string; wireHash: string; businessDate: string;
}
interface Receipt extends Json {
  submissionId: string; tenantId: string; propertyNode: string; documentId: string;
  documentSha256: string; wireSha256: string; providerKey: string;
  attemptId: string; attemptNumber: number; retryCount: number;
  status: string; disposition: string; transitionSeq: number; replayed: boolean;
}
interface Claim extends Json {
  claimed: boolean; reason?: string; action?: string; claimToken?: string;
  submissionId?: string; tenantId?: string; providerKey?: string; attemptId?: string;
  documentId?: string; documentSha256?: string; wireSha256?: string; wireJson?: string;
}
const key = () => `proof-${crypto.randomUUID()}`;
const hash = (text: string) => new Bun.CryptoHasher("sha256").update(text).digest("hex");
const MIGRATIONS = resolve(import.meta.dir, "..", "migrations");
const CANONICAL78 = "0078_fiscal_submission_durability.sql";
const CANONICAL78_HASH = "65323a81a999a11e3d55893411c994c0b841af9b0465ca7e80630fd78d0ffae6";

async function withCanonical78Migrations<T>(operation: (directory: string) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "yellow-order440-canonical78-"));
  try {
    const names = (await readdir(MIGRATIONS))
      .filter(name => /^\d{4}_.*\.sql$/.test(name) && Number(name.slice(0, 4)) <= 78)
      .sort();
    expect(names.map(name => Number(name.slice(0, 4))))
      .toEqual(Array.from({ length: 78 }, (_, index) => index + 1));
    expect(names.at(-1)).toBe(CANONICAL78);
    await Promise.all(names.map(name => copyFile(join(MIGRATIONS, name), join(directory, name))));
    return await operation(directory);
  } finally {
    if (!resolve(directory).startsWith(resolve(tmpdir()) + "/")
        && !resolve(directory).startsWith(resolve(tmpdir()) + "\\")) {
      throw new Error("Canonical78 cleanup escaped its temporary root");
    }
    await rm(directory, { recursive: true, force: true });
  }
}

databaseDescribe("Order440 durable fiscal delivery on genuine issued invoices", () => {
  let deploy: SQL;
  let worker: SQL;
  let database: Database;
  let legacy: Scenario;
  let legacyId: string;
  let legacyBefore: unknown;
  const cases: Scenario[] = [];

  async function scenario(configuration: NativeStatutoryOriginalConfiguration = "karnataka_supplier_karnataka_property",
    grant = true): Promise<Scenario> {
    const issued = await createNativeIssuanceFixture(deploy, database, {
      label: `dur440-${crypto.randomUUID().slice(0, 18)}`,
      roomNightAmounts: ["10000", "20000"], statutoryOriginalConfiguration: configuration,
    });
    const receipt = await new IssueIndiaNativeFiscalInvoiceCommand(database).execute(issued.request);
    const fixture = issued.fixture;
    const [source] = await deploy<{ sha256: string; body: string; business_date: string }[]>`
      SELECT sha256,content::text AS body,business_date::text FROM public.document
       WHERE tenant_id=${fixture.tenant}::uuid AND id=${receipt.documentId}::uuid`;
    if (!source) throw new Error("Native invoice fixture missing");
    const projected = projectIssuedIndiaIrpWireCandidate({
      documentId: receipt.documentId, documentSha256: source.sha256, contentJson: source.body,
    });
    if (!projected.ok) throw new Error(`Native source projection failed: ${projected.error.code}`);
    const [role] = await deploy<{ role_id: string }[]>`
      SELECT role_id::text FROM public.user_role WHERE tenant_id=${fixture.tenant}::uuid
       AND user_id=${fixture.actor}::uuid ORDER BY role_id LIMIT 1`;
    if (!role) throw new Error("Native fixture role missing");
    const provider = crypto.randomUUID();
    await deploy`INSERT INTO public.extension(id,tenant_id,type,key,version,effective,content,status)
      VALUES(${provider}::uuid,${fixture.tenant}::uuid,'fiscal_provider','in-irp',1,
       tstzrange(NULL,NULL,'[)'),
       '{"jurisdiction":"IN","mode":"in_house_reporting","provider_key":"india-irp","document_formats":["irp_json_1_1"]}'::jsonb,'active')`;
    const result: Scenario = { tenant: fixture.tenant, property: fixture.property,
      actor: fixture.actor, unauthorizedActor: fixture.unauthorizedActor,
      document: receipt.documentId, provider, role: role.role_id,
      sourceHash: source.sha256, wire: projected.value.wireJson, wireHash: projected.value.wireSha256,
      businessDate: source.business_date };
    if (grant) await grantPermissions(result);
    return result;
  }

  async function grantPermissions(s: Scenario): Promise<void> {
    await deploy`INSERT INTO public.role_permission(role_id,permission_code)
      SELECT ${s.role}::uuid,code FROM public.permission
       WHERE code IN ('tax-fiscal.submissions:request','tax-fiscal.submissions:retry')
      ON CONFLICT DO NOTHING`;
  }

  async function request(s: Scenario, overrides: Partial<Scenario> = {}, idempotencyKey = key()): Promise<Receipt> {
    const p = { ...s, ...overrides };
    return database.withTenantTransaction(s.tenant, async tx => {
      const [row] = await tx<{ receipt: Receipt }[]>`
        SELECT public.request_india_fiscal_submission(${p.tenant}::uuid,${p.property}::uuid,
          ${p.document}::uuid,${p.provider}::uuid,${p.actor}::uuid,${idempotencyKey},${crypto.randomUUID()}::uuid) AS receipt`;
      if (!row) throw new Error("Request returned no receipt");
      return row.receipt;
    });
  }

  async function claim(s: Scenario, submission: string, lease = 60): Promise<Claim> {
    return worker.begin(async tx => {
      await tx`SELECT set_config('app.tenant_id',${s.tenant},true)`;
      const [row] = await tx<{ receipt: Claim }[]>`
        SELECT public.claim_india_fiscal_submission(${s.tenant}::uuid,${submission}::uuid,${lease}) AS receipt`;
      if (!row) throw new Error("Claim returned no receipt");
      return row.receipt;
    });
  }

  function outcome(c: Claim, kind: "transport_result" | "lookup_result", result: string): Json {
    return { type: kind, tenantId: c.tenantId, providerKey: c.providerKey,
      attemptId: c.attemptId, documentId: c.documentId, payloadSha256: c.wireSha256,
      outcome: result, ...(["accepted", "rejected"].includes(result)
        ? { authorityRef: "synthetic-proof-receipt", responseSha256: hash("synthetic-receipt") } : {}) };
  }

  async function reconcile(s: Scenario, c: Claim, event: Json): Promise<Receipt> {
    return worker.begin(async tx => {
      await tx`SELECT set_config('app.tenant_id',${s.tenant},true)`;
      const [row] = await tx<{ receipt: Receipt }[]>`
        SELECT public.reconcile_india_fiscal_submission(${s.tenant}::uuid,${c.submissionId}::uuid,
          ${c.attemptId}::uuid,${c.claimToken}::uuid,${JSON.stringify(event)}::jsonb) AS receipt`;
      if (!row) throw new Error("Reconcile returned no receipt");
      return row.receipt;
    });
  }

  async function retry(s: Scenario, submission: string): Promise<Receipt> {
    return database.withTenantTransaction(s.tenant, async tx => {
      const [row] = await tx<{ receipt: Receipt }[]>`
        SELECT public.retry_india_fiscal_submission(${s.tenant}::uuid,${submission}::uuid,
          ${s.actor}::uuid,${key()},${crypto.randomUUID()}::uuid) AS receipt`;
      if (!row) throw new Error("Retry returned no receipt");
      return row.receipt;
    });
  }

  function commandRequest(
    s: Scenario,
    idempotencyKey: string,
    overrides: Partial<Pick<Scenario, "tenant" | "property" | "document" | "provider" | "actor">> = {},
  ) {
    const input = { ...s, ...overrides };
    return new RequestIndiaFiscalSubmissionCommand(database).execute({
      tenantId: input.tenant,
      propertyNode: input.property,
      documentId: input.document,
      providerExtensionId: input.provider,
      actorId: input.actor,
      idempotencyKey,
      requestId: crypto.randomUUID(),
    });
  }

  function commandRetry(
    s: Scenario,
    submissionId: string,
    idempotencyKey: string,
    overrides: Partial<Pick<Scenario, "tenant" | "actor">> = {},
  ) {
    const input = { ...s, ...overrides };
    return new RetryIndiaFiscalSubmissionCommand(database).execute({
      tenantId: input.tenant,
      submissionId,
      actorId: input.actor,
      idempotencyKey,
      requestId: crypto.randomUUID(),
    });
  }

  async function retainedFinance(s: Scenario): Promise<unknown[]> {
    const tables = ["document", "document_series", "journal", "posting_line",
      "india_gst_native_fiscal_document_origin", "india_gst_accommodation_final_component_tax_journal_binding"] as const;
    const result: unknown[] = [];
    for (const table of tables) {
      // Closed literal catalogue: no external identifier enters this proof query.
      result.push(await deploy.unsafe(
        `SELECT to_jsonb(t)::text AS body FROM public.${table} t WHERE tenant_id=$1::uuid ORDER BY to_jsonb(t)::text`, [s.tenant]));
    }
    return result;
  }

  async function deliveryEvidence(s: Scenario): Promise<unknown[]> {
    const result: unknown[] = [];
    for (const table of ["fiscal_submission", "fiscal_submission_history", "fact_log", "outbox"] as const) {
      result.push(await deploy.unsafe(
        `SELECT to_jsonb(t)::text AS body FROM public.${table} t WHERE tenant_id=$1::uuid ORDER BY to_jsonb(t)::text`, [s.tenant]));
    }
    return result;
  }

  async function waitForBlockedRequests(count: number, functionName = "request_india_fiscal_submission"): Promise<void> {
    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline) {
      const [row] = await deploy<{ count: number }[]>`SELECT count(*)::integer AS count
        FROM pg_stat_activity WHERE datname=current_database() AND usename='yellow_runtime'
          AND wait_event_type='Lock' AND query LIKE ${`%${functionName}%`}`;
      if (row?.count === count) return;
      await Bun.sleep(20);
    }
    throw new Error("Concurrent requests did not reach the controlled database lock");
  }

  async function denyOutboxAndAssertRollback(s: Scenario, operation: () => Promise<unknown>): Promise<void> {
    const before = await deliveryEvidence(s);
    if (!/^[0-9a-f-]{36}$/.test(s.tenant)) throw new Error("Invalid generated fixture tenant");
    // Disposable, tenant-specific failure injection at the last write; no source function is replaced.
    await deploy.unsafe(`ALTER TABLE public.outbox ADD CONSTRAINT order440_proof_late_failure
      CHECK (tenant_id <> '${s.tenant}'::uuid) NOT VALID`);
    try { await expect(operation()).rejects.toMatchObject({ errno: "23514" }); }
    finally { await deploy.unsafe("ALTER TABLE public.outbox DROP CONSTRAINT order440_proof_late_failure"); }
    expect(await deliveryEvidence(s)).toEqual(before);
  }

  async function withLateOutboxFailure<T>(s: Scenario, operation: () => Promise<T>): Promise<T> {
    if (!/^[0-9a-f-]{36}$/.test(s.tenant)) throw new Error("Invalid generated fixture tenant");
    await deploy.unsafe(`ALTER TABLE public.outbox ADD CONSTRAINT order440_command_late_failure
      CHECK (tenant_id <> '${s.tenant}'::uuid) NOT VALID`);
    try { return await operation(); }
    finally { await deploy.unsafe("ALTER TABLE public.outbox DROP CONSTRAINT order440_command_late_failure"); }
  }

  async function assertSqlState(operation: () => Promise<unknown>, expected: string): Promise<void> {
    let failure: unknown;
    try { await operation(); } catch (error) { failure = error; }
    expect(failure).toBeDefined();
    expect((failure as { errno?: string } | undefined)?.errno).toBe(expected);
  }

  async function prepareSeal(s: Scenario): Promise<void> {
    await deploy`INSERT INTO public.permission(code,description)
      VALUES('business_day.seal','Seal a ready business day') ON CONFLICT DO NOTHING`;
    await deploy`INSERT INTO public.role_permission(role_id,permission_code)
      VALUES(${s.role}::uuid,'business_day.seal') ON CONFLICT DO NOTHING`;
    // Acknowledge synthetic source events so the race isolates fiscal readiness, not queue backlog.
    await deploy`UPDATE public.outbox SET published_at=clock_timestamp()
      WHERE tenant_id=${s.tenant}::uuid AND published_at IS NULL`;
  }

  function seal(tx: Tx, s: Scenario) {
    return new BusinessDaySealService({ events: new PostgresEventBus(worker), idempotency: new PostgresIdempotency() })
      .seal(tx, { tenantId: s.tenant, propertyNode: s.property, businessDate: s.businessDate,
        actorId: s.actor, idempotencyKey: key(), envelope: {
          tenantId: s.tenant, propertyNode: s.property, actorId: s.actor,
          requestId: crypto.randomUUID(), operation: "business_day.sealed",
        } });
  }

  async function legacyRow(): Promise<unknown> {
    return deploy`SELECT id,tenant_id,document_id,provider_key,mode,status,authority_ref,
      qr_payload,response,submitted_at,resolved_at FROM public.fiscal_submission WHERE id=${legacyId}::uuid`;
  }

  beforeAll(async () => {
    for (const value of [deployUrl!, runtimeUrl!]) {
      const name = decodeURIComponent(new URL(value).pathname.slice(1));
      if (!/^yellow_order440_durable_[a-z0-9_]+$/.test(name)) {
        throw new Error("Durability proof may only alter its explicitly named disposable clone");
      }
    }
    deploy = new SQL(deployUrl!, { max: 3, prepare: false });
    worker = new SQL(runtimeUrl!, { max: 20, prepare: false });
    database = Database.connect(runtimeUrl!, { maxConnections: 6, prepare: false });
    const [catalogue] = await deploy<{ migrations: number; draft_absent: boolean }[]>`
      SELECT (SELECT count(*)::integer FROM public.schema_migration) AS migrations,
       to_regclass('public.fiscal_submission_history') IS NULL AS draft_absent`;
    expect(catalogue).toEqual({ migrations: 77, draft_absent: true });
    const schema = LAUNCH_EXTENSION_TYPES.find(row => row.type === "fiscal_provider")?.jsonSchema;
    if (!schema) throw new Error("Canonical fiscal provider schema missing");
    await deploy`INSERT INTO public.extension_type(type,json_schema)
      VALUES('fiscal_provider',${JSON.stringify(schema)}::jsonb) ON CONFLICT DO NOTHING`;
    legacy = await scenario(undefined, false);
    legacyId = crypto.randomUUID();
    await deploy`INSERT INTO public.fiscal_submission(id,tenant_id,document_id,provider_key,mode,status,authority_ref,response)
      VALUES(${legacyId}::uuid,${legacy.tenant}::uuid,${legacy.document}::uuid,'in-irp','reporting','accepted',
       'historical-fixture','{"historical":true}'::jsonb)`;
    legacyBefore = await legacyRow();
    const canonical = await Bun.file(join(MIGRATIONS, CANONICAL78)).text();
    expect(hash(canonical)).toBe(CANONICAL78_HASH);
    await withCanonical78Migrations(async (failureDirectory) => {
      await writeFile(join(failureDirectory, CANONICAL78), canonical +
        "\nDO $$ BEGIN RAISE EXCEPTION 'order440-canonical-migration-rollback-proof'; END $$;\n");
      await expect(runMigrations({ databaseUrl: deployUrl!, migrationsDirectory: failureDirectory,
        logger: () => undefined })).rejects.toThrow("order440-canonical-migration-rollback-proof");
    });
    const [rolledBack] = await deploy<{ absent: boolean; privileges: number }[]>`
      SELECT to_regclass('public.fiscal_submission_history') IS NULL AS absent,
        (SELECT count(*)::integer FROM public.permission WHERE code IN
          ('tax-fiscal.submissions:request','tax-fiscal.submissions:retry')) AS privileges`;
    expect(rolledBack).toEqual({ absent: true, privileges: 0 });
    const [rolledBackLedger] = await deploy<{ count: number }[]>`
      SELECT count(*)::integer AS count FROM public.schema_migration`;
    expect(rolledBackLedger?.count).toBe(77);
    expect(await legacyRow()).toEqual(legacyBefore);
    const migrated = await withCanonical78Migrations(directory => runMigrations({
      databaseUrl: deployUrl!, migrationsDirectory: directory, logger: () => undefined,
    }));
    expect(migrated.appliedFiles).toEqual([CANONICAL78]);
    expect(migrated.discoveredFiles).toBe(78);
    const [ledger78] = await deploy<{ filename: string; checksum_sha256: string }[]>`
      SELECT filename, checksum_sha256 FROM public.schema_migration WHERE version=78`;
    expect(ledger78).toEqual({ filename: CANONICAL78, checksum_sha256: CANONICAL78_HASH });
    expect((await withCanonical78Migrations(directory => runMigrations({
      databaseUrl: deployUrl!, migrationsDirectory: directory, logger: () => undefined,
    }))).appliedFiles).toEqual([]);
  }, 180_000);

  afterAll(async () => { await database?.close(); await worker?.close(); await deploy?.close(); });

  test("canonical migration preserves legacy fields and adds no assigned permissions", async () => {
    expect(await legacyRow()).toEqual(legacyBefore);
    const [count] = await deploy<{ count: number }[]>`SELECT count(*)::integer AS count FROM public.role_permission
      WHERE permission_code IN ('tax-fiscal.submissions:request','tax-fiscal.submissions:retry')`;
    expect(count?.count).toBe(0);
    await grantPermissions(legacy);
    await expect(request(legacy)).rejects.toMatchObject({ errno: "23505" });
    expect(await legacyRow()).toEqual(legacyBefore);
  });

  for (const configuration of ["karnataka_supplier_karnataka_property", "chandigarh_supplier_chandigarh_property",
    "maharashtra_supplier_karnataka_property"] as const) {
    test(`genuine ${configuration} keeps exact wire and financial rows through acceptance`, async () => {
      const s = await scenario(configuration);
      const before = await retainedFinance(s);
      const r = await request(s);
      expect(r.status).toBe("pending");
      expect(r.documentSha256).toBe(s.sourceHash);
      expect(r.wireSha256).toBe(s.wireHash);
      const c = await claim(s, r.submissionId);
      expect(c.claimed).toBe(true);
      expect(c.action).toBe("submit");
      expect(c.wireJson).toBe(s.wire);
      expect(c.wireSha256).toBe(hash(s.wire));
      const accepted = outcome(c, "transport_result", "accepted");
      expect((await reconcile(s, c, accepted)).status).toBe("accepted");
      expect((await reconcile(s, c, accepted)).replayed).toBe(true);
      await expect(reconcile(s, c, { ...accepted, responseSha256: "f".repeat(64) })).rejects.toMatchObject({ errno: "55000" });
      expect(await claim(s, r.submissionId)).toEqual({ claimed: false, reason: "terminal" });
      expect(await retainedFinance(s)).toEqual(before);
      cases.push(s);
    }, 180_000);
  }

  test("same request converges and authority is rechecked even on replay", async () => {
    const s = await scenario();
    const idempotencyKey = key();
    const r = await request(s, {}, idempotencyKey);
    const replay = await request(s, {}, idempotencyKey);
    expect(replay.submissionId).toBe(r.submissionId);
    expect(replay.replayed).toBe(true);
    await expect(request(s, { actor: s.unauthorizedActor }, idempotencyKey)).rejects.toMatchObject({ errno: "42501" });
    await deploy`DELETE FROM public.role_permission WHERE role_id=${s.role}::uuid AND permission_code='tax-fiscal.submissions:request'`;
    await expect(request(s, {}, idempotencyKey)).rejects.toMatchObject({ errno: "42501" });
    await grantPermissions(s);
  }, 180_000);

  test("simultaneous identical first requests converge after the document lock", async () => {
    const s = await scenario();
    const idempotencyKey = key();
    const lock = await deploy.reserve();
    let pending: Promise<PromiseSettledResult<Receipt>[]> | undefined;
    try {
      await lock.unsafe("BEGIN");
      await lock`SELECT pg_advisory_xact_lock(hashtextextended(
        ${`india-fiscal-submission:${s.tenant}:${s.document}`},0))`;
      pending = Promise.allSettled(Array.from({ length: 6 }, () => request(s, {}, idempotencyKey)));
      await waitForBlockedRequests(6);
    } finally {
      await lock.unsafe("ROLLBACK");
      lock.release();
    }
    const results = await pending!;
    expect(results.filter(result => result.status === "rejected")).toEqual([]);
    const receipts = results.filter(result => result.status === "fulfilled").map(result => result.value);
    expect(new Set(receipts.map(receipt => receipt.submissionId)).size).toBe(1);
    expect(receipts.filter(receipt => !receipt.replayed)).toHaveLength(1);
    expect(receipts.filter(receipt => receipt.replayed)).toHaveLength(5);
    const [count] = await deploy<{ count: number }[]>`SELECT count(*)::integer AS count
      FROM public.fiscal_submission_history WHERE tenant_id=${s.tenant}::uuid`;
    expect(count?.count).toBe(1);
  }, 180_000);

  test("malformed result families cannot commit any delivery evidence", async () => {
    const s = await scenario();
    const r = await request(s);
    const c = await claim(s, r.submissionId);
    const valid = outcome(c, "transport_result", "accepted");
    const before = await deliveryEvidence(s);
    for (const field of ["type", "outcome", "tenantId", "providerKey", "attemptId", "documentId",
      "payloadSha256", "authorityRef", "responseSha256"] as const) {
      for (const invalid of [null, 1, true, [], {}]) {
        await expect(reconcile(s, c, { ...valid, [field]: invalid })).rejects.toMatchObject({ errno: "22023" });
      }
      const missing = { ...valid };
      delete missing[field];
      await expect(reconcile(s, c, missing)).rejects.toMatchObject({ errno: "22023" });
    }
    expect(await deliveryEvidence(s)).toEqual(before);
    expect((await reconcile(s, c, valid)).status).toBe("accepted");
  }, 180_000);

  test("a claim lease starts after a real lock wait, not at transaction start", async () => {
    const s = await scenario();
    const r = await request(s);
    const lock = await deploy.reserve();
    let pending: Promise<Claim> | undefined;
    try {
      await lock.unsafe("BEGIN");
      await lock.unsafe("LOCK TABLE public.app_user IN SHARE ROW EXCLUSIVE MODE");
      pending = claim(s, r.submissionId, 15);
      // Keep the lock longer than the entire requested lease, without changing a stored clock.
      await Bun.sleep(16_000);
    } finally {
      await lock.unsafe("ROLLBACK");
      lock.release();
    }
    expect((await pending!).action).toBe("submit");
    const [lease] = await deploy<{ live: boolean }[]>`SELECT claim_expires_at>clock_timestamp() AS live
      FROM public.fiscal_submission WHERE tenant_id=${s.tenant}::uuid AND id=${r.submissionId}::uuid`;
    expect(lease?.live).toBe(true);
    expect(await claim(s, r.submissionId, 15)).toEqual({ claimed: false, reason: "busy" });
  }, 180_000);

  test("current worker rejects canonical78 claims without source content and leaves no residual mutation", async () => {
    const s = await scenario();
    const before = await retainedFinance(s);
    // A single-connection pool proves the rejected old claim rolls back and the
    // same settled connection remains reusable for state and foreign-tenant checks.
    const pool = new SQL(runtimeUrl!, { max: 1, prepare: false });
    const repository = new FiscalSubmissionRepository(pool);
    try {
      const requested = await database.withTenantTransaction(s.tenant, tx => repository.request(tx, {
        tenantId: s.tenant, propertyNode: s.property, documentId: s.document,
        providerExtensionId: s.provider, actorId: s.actor, idempotencyKey: key(), requestId: crypto.randomUUID(),
      }));
      expect(requested.ok).toBe(true);
      if (!requested.ok) throw new Error("Real repository request failed");
      let submits = 0;
      const registry = new VerifiedIndiaIrpAdapterRegistry([{
        kind: "registered_verified_india_irp_1_1_adapter", providerKey: "india-irp",
        providerExtensionId: s.provider, providerExtensionVersion: 1,
        // Candidate81 must reject the old claim shape before any provider transport.
        submit: async () => {
          submits++;
          throw new Error("Canonical78 claims must be rejected before submit");
        },
        lookup: async () => {
          submits++;
          throw new Error("Canonical78 claims must be rejected before lookup");
        },
      }]);
      const runner = new FiscalSubmissionWorker(repository, registry);
      const claimInput = { tenantId: s.tenant, submissionId: requested.value.submissionId, leaseSeconds: 60 };
      const input = {
        ...claimInput,
        providerKey: requested.value.providerKey,
        providerExtensionId: requested.value.providerExtensionId,
        providerExtensionVersion: requested.value.providerExtensionVersion,
        transportDeadlineMs: 20_000,
      } satisfies FiscalSubmissionWorkerStepInput;
      const unclaimed = await deliveryEvidence(s);
      expect(await runner.runOnce(claimInput)).toEqual({ ok: false, error: {
        code: "invalid_input", message: "fiscal submission worker input is invalid",
      } });
      expect(submits).toBe(0);
      expect(await deliveryEvidence(s)).toEqual(unclaimed);
      // Migration78 cannot supply candidate81's sourceContentJson claim field. The
      // repository must fail closed and roll back the claim made in its transaction.
      expect(await runner.runOnce(input)).toEqual({ ok: false, error: {
        code: "repository_error", message: "fiscal submission claim failed",
      } });
      expect(submits).toBe(0);
      expect(await deliveryEvidence(s)).toEqual(unclaimed);
      const [settled] = await pool<{ role: string; tenant: string | null;
        open_transaction: boolean }[]>`
        SELECT current_user::text AS role,NULLIF(current_setting('app.tenant_id',true),'') AS tenant,
          EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database()
            AND usename='yellow_runtime' AND state='idle in transaction') AS open_transaction`;
      expect(settled).toEqual({ role: "yellow_runtime", tenant: null, open_transaction: false });
      const foreign = cases[0]!;
      const foreignBefore = await deliveryEvidence(foreign);
      const foreignClaim = await repository.claim({ ...claimInput, tenantId: foreign.tenant });
      expect(foreignClaim).toEqual({ ok: false, error: {
        code: "database_error", message: "Fiscal submission database operation failed",
      } });
      expect(await deliveryEvidence(foreign)).toEqual(foreignBefore);
      expect(await runner.runOnce(input)).toEqual({ ok: false, error: {
        code: "repository_error", message: "fiscal submission claim failed",
      } });
      expect(submits).toBe(0);
      expect(await deliveryEvidence(s)).toEqual(unclaimed);
      expect(await retainedFinance(s)).toEqual(before);
      // Current candidate81 one-connection commit-before-transport coverage lives
      // in fiscal-submission-delivery-runtime.integration.test.ts with a genuine
      // bound signed receipt; this historical prefix remains an incompatibility proof.
    } finally { await pool.close(); }
  }, 180_000);

  test("production request command commits exact replay and sanitizes permission and tenant denials", async () => {
    const s = await scenario();
    const foreign = cases[0]!;
    const finance = await retainedFinance(s);
    const foreignFinance = await retainedFinance(foreign);
    const foreignDelivery = await deliveryEvidence(foreign);
    const idempotencyKey = key();
    const first = await commandRequest(s, idempotencyKey);
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error("Production request command did not commit");
    expect(first.value).toMatchObject({ tenantId: s.tenant, propertyNode: s.property,
      documentId: s.document, providerExtensionId: s.provider, replayed: false });
    const committed = await deliveryEvidence(s);
    expect(committed[0]).toHaveLength(1);
    expect(committed[1]).toHaveLength(1);
    const replay = await commandRequest(s, idempotencyKey);
    expect(replay.ok).toBe(true);
    if (!replay.ok) throw new Error("Production request command replay failed");
    expect(replay.value.submissionId).toBe(first.value.submissionId);
    expect(replay.value.replayed).toBe(true);
    expect(await deliveryEvidence(s)).toEqual(committed);

    await deploy`DELETE FROM public.role_permission WHERE role_id=${s.role}::uuid
      AND permission_code='tax-fiscal.submissions:request'`;
    let permissionDenied;
    try { permissionDenied = await commandRequest(s, idempotencyKey); }
    finally { await grantPermissions(s); }
    expect(permissionDenied).toEqual({ ok: false, error: {
      code: "database_error", message: "Fiscal submission request could not be persisted",
    } });
    const tenantDenied = await commandRequest(s, key(), { tenant: foreign.tenant });
    expect(tenantDenied).toEqual({ ok: false, error: {
      code: "database_error", message: "Fiscal submission request could not be persisted",
    } });
    expect(await deliveryEvidence(s)).toEqual(committed);
    expect(await deliveryEvidence(foreign)).toEqual(foreignDelivery);
    expect(await retainedFinance(s)).toEqual(finance);
    expect(await retainedFinance(foreign)).toEqual(foreignFinance);
  }, 180_000);

  test("production request and retry commands roll back late outbox failure; retry commits exact replay", async () => {
    const s = await scenario();
    const foreign = cases[0]!;
    const finance = await retainedFinance(s);
    const foreignDelivery = await deliveryEvidence(foreign);
    const initialDelivery = await deliveryEvidence(s);
    const failedRequest = await withLateOutboxFailure(s, () => commandRequest(s, key()));
    expect(failedRequest).toEqual({ ok: false, error: {
      code: "database_error", message: "Fiscal submission request could not be persisted",
    } });
    expect(await deliveryEvidence(s)).toEqual(initialDelivery);
    expect(await retainedFinance(s)).toEqual(finance);

    const requested = await commandRequest(s, key());
    expect(requested.ok).toBe(true);
    if (!requested.ok) throw new Error("Production request command did not recover after rollback");
    const claimed = await claim(s, requested.value.submissionId);
    expect((await reconcile(s, claimed, outcome(claimed, "transport_result", "known_not_sent"))).status)
      .toBe("error");
    const beforeRetry = await deliveryEvidence(s);
    const retryKey = key();
    const failedRetry = await withLateOutboxFailure(s,
      () => commandRetry(s, requested.value.submissionId, retryKey));
    expect(failedRetry).toEqual({ ok: false, error: {
      code: "database_error", message: "Fiscal submission retry could not be persisted",
    } });
    expect(await deliveryEvidence(s)).toEqual(beforeRetry);
    expect(await retainedFinance(s)).toEqual(finance);

    const retried = await commandRetry(s, requested.value.submissionId, retryKey);
    expect(retried.ok).toBe(true);
    if (!retried.ok) throw new Error("Production retry command did not commit");
    expect(retried.value).toMatchObject({ tenantId: s.tenant,
      submissionId: requested.value.submissionId, attemptNumber: 2, retryCount: 1, replayed: false });
    const committed = await deliveryEvidence(s);
    const replay = await commandRetry(s, requested.value.submissionId, retryKey);
    expect(replay.ok).toBe(true);
    if (!replay.ok) throw new Error("Production retry command replay failed");
    expect(replay.value.attemptId).toBe(retried.value.attemptId);
    expect(replay.value.replayed).toBe(true);
    expect(await deliveryEvidence(s)).toEqual(committed);

    await deploy`DELETE FROM public.role_permission WHERE role_id=${s.role}::uuid
      AND permission_code='tax-fiscal.submissions:retry'`;
    let permissionDenied;
    try { permissionDenied = await commandRetry(s, requested.value.submissionId, retryKey); }
    finally { await grantPermissions(s); }
    expect(permissionDenied).toEqual({ ok: false, error: {
      code: "database_error", message: "Fiscal submission retry could not be persisted",
    } });
    const tenantDenied = await commandRetry(s, requested.value.submissionId, key(), { tenant: foreign.tenant });
    expect(tenantDenied).toEqual({ ok: false, error: {
      code: "database_error", message: "Fiscal submission retry could not be persisted",
    } });
    expect(await deliveryEvidence(s)).toEqual(committed);
    expect(await deliveryEvidence(foreign)).toEqual(foreignDelivery);
    expect(await retainedFinance(s)).toEqual(finance);
  }, 180_000);

  test("one hundred concurrent claims authorize exactly one send", async () => {
    const s = await scenario();
    const r = await request(s);
    const claims = await Promise.all(Array.from({ length: 100 }, () => claim(s, r.submissionId)));
    expect(claims.filter(c => c.claimed)).toHaveLength(1);
    expect(claims.filter(c => !c.claimed && c.reason === "busy")).toHaveLength(99);
    const [history] = await deploy<{ count: number }[]>`SELECT count(*)::integer AS count FROM public.fiscal_submission_history
      WHERE tenant_id=${s.tenant}::uuid AND submission_id=${r.submissionId}::uuid`;
    expect(history?.count).toBe(2);
  }, 180_000);

  test("unknown delivery remains lookup-only after a real expired lease", async () => {
    const s = await scenario();
    const r = await request(s);
    const first = await claim(s, r.submissionId, 15);
    expect((await reconcile(s, first, outcome(first, "transport_result", "timeout"))).disposition).toBe("lookup");
    await expect(retry(s, r.submissionId)).rejects.toMatchObject({ errno: "55000" });
    // Real clock expiry exercises recovery without rewriting a persisted timestamp.
    await Bun.sleep(15_100);
    const recovered = await claim(s, r.submissionId, 15);
    expect(recovered.claimed).toBe(true);
    expect(recovered.action).toBe("lookup");
    expect(recovered.attemptId).toBe(first.attemptId);
    expect(recovered.claimToken).not.toBe(first.claimToken);
    await expect(reconcile(s, first, outcome(first, "transport_result", "accepted"))).rejects.toMatchObject({ errno: "55000" });
    expect((await reconcile(s, recovered, outcome(recovered, "lookup_result", "accepted"))).status).toBe("accepted");
  }, 180_000);

  test("only three explicit known-not-sent retries are admitted and old attempts remain stale", async () => {
    const s = await scenario();
    const before = await retainedFinance(s);
    let r = await request(s);
    let oldClaim: Claim | undefined;
    for (let attempt = 1; attempt <= 4; attempt++) {
      const c = await claim(s, r.submissionId);
      expect(c.action).toBe("submit");
      expect(c.attemptNumber).toBe(attempt);
      if (oldClaim) await expect(reconcile(s, oldClaim, outcome(oldClaim, "transport_result", "accepted"))).rejects.toMatchObject({ errno: "55000" });
      r = await reconcile(s, c, outcome(c, "transport_result", "known_not_sent"));
      expect(r.status).toBe("error");
      expect(await claim(s, r.submissionId)).toEqual({ claimed: false, reason: "retry_required" });
      oldClaim = c;
      if (attempt < 4) {
        r = await retry(s, r.submissionId);
        expect(r.retryCount).toBe(attempt);
        expect(r.attemptId).not.toBe(c.attemptId);
      }
    }
    await expect(retry(s, r.submissionId)).rejects.toMatchObject({ errno: "55000" });
    expect(await retainedFinance(s)).toEqual(before);
  }, 180_000);

  test("real tenant, actor, property and infrastructure-role boundaries deny foreign authority", async () => {
    const s = cases[0]!;
    const foreign = cases[1]!;
    await expect(request(s, { tenant: foreign.tenant, property: foreign.property, document: foreign.document })).rejects.toMatchObject({ errno: "42501" });
    await expect(request(s, { property: foreign.property })).rejects.toMatchObject({ errno: "42501" });
    await expect(request(s, { provider: foreign.provider })).rejects.toMatchObject({ errno: "55000" });
    await expect(database.withTenantTransaction(s.tenant, tx => tx`SELECT public.claim_india_fiscal_submission(
      ${s.tenant}::uuid,${crypto.randomUUID()}::uuid,60)`)).rejects.toMatchObject({ errno: "42501" });
    const visible = await database.withTenantTransaction(s.tenant, tx => tx`SELECT submission_id
      FROM public.fiscal_submission_history WHERE tenant_id=${foreign.tenant}::uuid`);
    expect(visible).toEqual([]);
    await expect(database.withTenantTransaction(s.tenant, tx => tx`DELETE FROM public.fiscal_submission_history
      WHERE tenant_id=${s.tenant}::uuid`)).rejects.toMatchObject({ errno: "42501" });
    await expect(database.withTenantTransaction(s.tenant, tx => tx`UPDATE public.fiscal_submission SET status='accepted'
      WHERE tenant_id=${s.tenant}::uuid`)).rejects.toMatchObject({ errno: "42501" });
  });

  test("late outbox failure rolls back every request, claim, reconciliation and retry effect", async () => {
    const s = await scenario();
    const finance = await retainedFinance(s);
    await denyOutboxAndAssertRollback(s, () => request(s));
    const r = await request(s);
    await denyOutboxAndAssertRollback(s, () => claim(s, r.submissionId));
    const c = await claim(s, r.submissionId);
    await denyOutboxAndAssertRollback(s, () => reconcile(s, c, outcome(c, "transport_result", "known_not_sent")));
    await reconcile(s, c, outcome(c, "transport_result", "known_not_sent"));
    await denyOutboxAndAssertRollback(s, () => retry(s, r.submissionId));
    expect((await retry(s, r.submissionId)).retryCount).toBe(1);
    expect(await retainedFinance(s)).toEqual(finance);
  }, 180_000);

  test("history survives real outbox pruning, cannot be forged, and has no mutable financial side effect", async () => {
    const s = await scenario();
    const idempotencyKey = key();
    const r = await request(s, {}, idempotencyKey);
    const before = await deploy`SELECT to_jsonb(h)::text AS body FROM public.fiscal_submission_history h
      WHERE tenant_id=${s.tenant}::uuid ORDER BY transition_seq`;
    await expect(database.withTenantTransaction(s.tenant, tx => tx`INSERT INTO public.fiscal_submission_history
      SELECT * FROM public.fiscal_submission_history WHERE tenant_id=${s.tenant}::uuid`)).rejects.toMatchObject({ errno: "42501" });
    // Execute the lazy SQL explicitly and compare the scalar SQLSTATE, not the driver error object.
    await assertSqlState(async () => await deploy`UPDATE public.fiscal_submission_history SET actor_id=NULL
      WHERE tenant_id=${s.tenant}::uuid`, "55000");
    await assertSqlState(async () => await deploy`DELETE FROM public.fiscal_submission_history
      WHERE tenant_id=${s.tenant}::uuid`, "55000");
    await assertSqlState(async () => await deploy.begin(async tx => {
      await tx`INSERT INTO public.fiscal_submission SELECT (jsonb_populate_record(NULL::public.fiscal_submission,
        to_jsonb(f)||jsonb_build_object('id',gen_random_uuid(),'delivery_version',NULL))).*
        FROM public.fiscal_submission f WHERE f.tenant_id=${s.tenant}::uuid AND f.id=${r.submissionId}::uuid`;
      throw new Error("Mixed legacy/durable row was incorrectly accepted");
    }), "23514");
    await deploy`UPDATE public.outbox SET published_at=clock_timestamp()
      WHERE tenant_id=${s.tenant}::uuid AND aggregate_type='fiscal_submission' AND published_at IS NULL`;
    await worker`SELECT * FROM public.runtime_prune_outbox(0)`;
    const [remaining] = await deploy<{ count: number }[]>`SELECT count(*)::integer AS count FROM public.outbox
      WHERE tenant_id=${s.tenant}::uuid AND aggregate_type='fiscal_submission'`;
    expect(remaining?.count).toBe(0);
    expect(await deploy`SELECT to_jsonb(h)::text AS body FROM public.fiscal_submission_history h
      WHERE tenant_id=${s.tenant}::uuid ORDER BY transition_seq`).toEqual(before);
    expect((await request(s, {}, idempotencyKey)).replayed).toBe(true);
  }, 180_000);

  test("seal-first commit rejects a waiting fiscal request without delivery effects", async () => {
    const s = await scenario();
    await prepareSeal(s);
    const connection = await worker.reserve();
    let pending: Promise<PromiseSettledResult<Receipt>[]> | undefined;
    try {
      await connection.unsafe("BEGIN");
      await connection`SELECT set_config('app.tenant_id',${s.tenant},true)`;
      await connection.unsafe("SET LOCAL ROLE app_role");
      expect((await seal(connection, s)).state).toBe("sealed");
      pending = Promise.allSettled([request(s)]);
      await waitForBlockedRequests(1);
      await connection.unsafe("COMMIT");
    } finally { await connection.unsafe("ROLLBACK"); connection.release(); }
    const [result] = await pending!;
    expect(result?.status).toBe("rejected");
    if (result?.status === "rejected") expect(result.reason).toMatchObject({ errno: "55000" });
    const [rows] = await deploy<{ heads: number; history: number; facts: number; events: number }[]>`
      SELECT (SELECT count(*)::integer FROM public.fiscal_submission WHERE tenant_id=${s.tenant}::uuid) AS heads,
        (SELECT count(*)::integer FROM public.fiscal_submission_history WHERE tenant_id=${s.tenant}::uuid) AS history,
        (SELECT count(*)::integer FROM public.fact_log WHERE tenant_id=${s.tenant}::uuid AND entity_type='fiscal_submission') AS facts,
        (SELECT count(*)::integer FROM public.outbox WHERE tenant_id=${s.tenant}::uuid AND aggregate_type='fiscal_submission') AS events`;
    expect(rows).toEqual({ heads: 0, history: 0, facts: 0, events: 0 });
  }, 180_000);

  test("request-first commit preserves the pending fiscal seal blocker", async () => {
    const s = await scenario();
    await prepareSeal(s);
    const connection = await worker.reserve();
    let pending: Promise<PromiseSettledResult<unknown>[]> | undefined;
    try {
      await connection.unsafe("BEGIN");
      await connection`SELECT set_config('app.tenant_id',${s.tenant},true)`;
      await connection.unsafe("SET LOCAL ROLE app_role");
      await connection`SELECT public.request_india_fiscal_submission(${s.tenant}::uuid,${s.property}::uuid,
        ${s.document}::uuid,${s.provider}::uuid,${s.actor}::uuid,${key()},${crypto.randomUUID()}::uuid)`;
      pending = Promise.allSettled([database.withTenantTransaction(s.tenant, tx => seal(tx, s))]);
      await waitForBlockedRequests(1, "seal_business_day_audited");
      await connection.unsafe("COMMIT");
    } finally { await connection.unsafe("ROLLBACK"); connection.release(); }
    const [result] = await pending!;
    expect(result?.status).toBe("rejected");
    if (result?.status === "rejected") expect(result.reason).toBeInstanceOf(BusinessDaySealConflictError);
    const [day] = await deploy<{ open: boolean; heads: number }[]>`SELECT sealed_at IS NULL AS open,
      (SELECT count(*)::integer FROM public.fiscal_submission WHERE tenant_id=${s.tenant}::uuid AND status='pending') AS heads
      FROM public.business_day WHERE tenant_id=${s.tenant}::uuid AND property_node=${s.property}::uuid
        AND business_date=${s.businessDate}::date`;
    expect(day).toEqual({ open: true, heads: 1 });
  }, 180_000);
});
