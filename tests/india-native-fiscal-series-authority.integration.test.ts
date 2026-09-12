import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { readFileSync } from "node:fs";
import { Database } from "../src/kernel";
import { IssueIndiaNativeFiscalInvoiceCommand } from "../src/commands/issue-india-native-fiscal-invoice";
import { assertSeriesTargets, configureSeries, createSeriesFixture, createSecondSeriesProperty, createPriorYearSeries, parseSeriesMode, SERIES_SIGNATURE,
  seriesCatalogue, seriesRows, seriesSqlState, type SeriesInput, type SeriesRow } from "./fixtures/india-native-fiscal-series-fixture";

const deployUrl = process.env.YELLOW_ORDER453_DEPLOY_DATABASE_URL;
const runtimeUrl = process.env.YELLOW_ORDER453_RUNTIME_DATABASE_URL;
const required = process.env.YELLOW_REQUIRE_ORDER453_DATABASE === "1";
const mode = required || deployUrl || runtimeUrl ? parseSeriesMode(process.env.YELLOW_ORDER453_TARGET_MODE) : undefined;
if (required || deployUrl || runtimeUrl) {
  if (!required || !deployUrl || !runtimeUrl) throw new Error("Order453 requires mandatory paired target admission");
  assertSeriesTargets(deployUrl, runtimeUrl, "runtime", mode!, process.env.YELLOW_REQUIRE_ORDER453_CI_CANONICAL === "1",
    process.env.YELLOW_ORDER453_CI_DATABASE_ADDRESS, process.env.YELLOW_ORDER453_NATIVE_EXECUTE_AFTER_HANDOFF === "1");
}

describe("Order453 series configuration source contract", () => {
  test("catalogue excludes only six maintenance hints while retaining exact structural evidence", async () => {
    let query = "";
    const reader = (async (parts: TemplateStringsArray) => {
      query = parts.join(""); return [{ value: "unchanged snapshot" }];
    }) as unknown as SQL;
    expect(await seriesCatalogue(reader)).toBe("unchanged snapshot");
    const shared = readFileSync(new URL("./fixtures/india-native-credit-delivery-fixture.ts", import.meta.url), "utf8");
    const originalQuery = /export async function creditDeliveryCatalogue[\s\S]*?`(SELECT jsonb_build_object\([\s\S]*?)`;/.exec(shared)?.[1];
    expect(originalQuery).toBeDefined();
    const excluded = ["relhastriggers", "relpages", "reltuples", "relallvisible", "relfrozenxid", "relminmxid"];
    const exclusion = `to_jsonb(c)-ARRAY[${excluded.map(name => `'${name}'`).join(",")}]::text[] ORDER BY c.oid`;
    expect(query.replaceAll("\r\n", "\n")).toBe(originalQuery!
      .replace("to_jsonb(c) ORDER BY c.oid", exclusion).replaceAll("\r\n", "\n"));
    for (const retained of ["relfilenode", "relhasrules", "relhassubclass", "relhasindex", "relacl", "relowner", "relrowsecurity", "relforcerowsecurity"]) {
      expect(excluded).not.toContain(retained);
    }
    for (const evidence of ["to_jsonb(a)", "to_jsonb(t)", "pg_get_functiondef(p.oid)", "p.proacl,p.proowner,p.proconfig", "pg_catalog.pg_constraint", "pg_catalog.pg_policy"]) {
      expect(query).toContain(evidence);
    }
  });
  test("six-argument configuration owns current authority and atomic minimized publication", () => {
    const sql = readFileSync(new URL("../handoff/drafts/order453/0090_india_native_fiscal_series_configuration.sql", import.meta.url), "utf8");
    expect(sql).toContain("ARRAY['tax-fiscal.series:configure'],true");
    expect(sql).toContain("INSERT INTO public.fact_log");
    expect(sql).toContain("INSERT INTO public.outbox");
    expect(sql).toContain("'document.series.configured'");
    expect(sql).toContain("SET search_path=pg_catalog,public,pg_temp");
    expect(sql).toContain("FROM pg_catalog.pg_locks");
    expect(sql).toContain("pg_catalog.pg_advisory_xact_lock(6441674055002974568::bigint)");
    expect(sql).not.toMatch(/CREATE TABLE|CREATE INDEX|UPDATE public.document_series|p_correlation_id|p_request_id/);
  });
  test("native target requires exact Q242 identity and explicit handoff; CI identities cannot alias", () => {
    const url = (role: string, name = "yellow_order453_current90_ci", port = "5544") => `postgres://${role}:synthetic@127.0.0.1:${port}/${name}`;
    expect(() => assertSeriesTargets(url("yellow_deploy"), url("yellow_runtime"), "runtime", "native-draft", false, undefined)).toThrow("Q242");
    const native = (role: string) => url(role, "yellow_order453_series_candidate_20260908", "55503");
    for (const purpose of ["runtime", "upgrade"] as const) {
      expect(() => assertSeriesTargets(native("yellow_deploy"), native("yellow_runtime"), purpose,
        "native-draft", false, undefined, true)).not.toThrow();
      for (const [d, r] of [[native("yellow_runtime"), native("yellow_deploy")],
        [native("yellow_deploy"), native("yellow_runtime") + "?x=1"],
        [native("yellow_deploy"), native("yellow_runtime").replace("series_candidate", "referee")],
        [native("yellow_deploy"), native("yellow_runtime").replace("127.0.0.1", "localhost")],
        [native("yellow_deploy"), native("yellow_runtime").replace(":55503/", ":5544/")]] as const) {
        expect(() => assertSeriesTargets(d, r, purpose, "native-draft", false, undefined, true)).toThrow();
      }
    }
    expect(() => assertSeriesTargets(url("yellow_deploy"), url("yellow_runtime"), "runtime", "ci-canonical", true, "127.0.0.1:5544")).not.toThrow();
    for (const [d, r, admitted] of [[url("yellow_runtime"), url("yellow_deploy"), true],
      [url("yellow_deploy"), url("yellow_runtime", "yellow_order453_upgrade89_ci"), true],
      [url("yellow_deploy"), url("yellow_runtime") + "?x=1", true],
      [url("yellow_deploy"), url("yellow_runtime").replace(":synthetic@", "@"), true],
      [url("yellow_deploy"), url("yellow_runtime"), false],
      [url("yellow_deploy", undefined, "55503"), url("yellow_runtime", undefined, "55503"), true]] as const) {
      expect(() => assertSeriesTargets(d, r, "runtime", "ci-canonical", admitted, new URL(d).host)).toThrow();
    }
  });
  test("same-property exact-jurisdiction registration uniqueness cannot be bypassed with another supplier UUID", () => {
    const sql = readFileSync(new URL("../migrations/0047_property_fiscal_registration.sql", import.meta.url), "utf8");
    const unique = /property_fiscal_registration_identity_uq UNIQUE NULLS NOT DISTINCT\s*\(([\s\S]*?)\)/.exec(sql);
    expect(unique).not.toBeNull();
    expect(unique![1]!.split(",").map(value => value.trim())).toEqual([
      "tenant_id", "property_node", "scheme", "currency", "jurisdiction_extension_id", "jurisdiction_owner_tenant_id",
      "jurisdiction_key", "jurisdiction_version", "jurisdiction_content_hash",
    ]);
  });
});

(required ? describe.serial : describe.skip)("Order453 genuine configuration authority and publication", () => {
  let deploy: SQL; let runtime: Database;
  beforeAll(async () => {
    deploy = new SQL(deployUrl!, { max: 4, prepare: false });
    runtime = Database.connect(runtimeUrl!, { maxConnections: 12, prepare: false });
    const [row] = await deploy<{ version: number; body: string }[]>`SELECT max(version)::int version,
      (SELECT prosrc FROM pg_catalog.pg_proc WHERE oid=${SERIES_SIGNATURE}::regprocedure) body FROM public.schema_migration`;
    expect(row?.version).toBe(mode === "native-draft" ? 89 : 91);
    expect(row?.body).toContain("'document.series.configured'");
  });
  afterAll(async () => { await runtime?.close(); await deploy?.close(); });
  const configure = (input: SeriesInput) => runtime.withTenantTransaction(input.tenant, tx => configureSeries(tx, input));
  async function denied(input: SeriesInput, state = "42501") {
    let actual: string | undefined;
    try { await configure(input); } catch (error) { actual = seriesSqlState(error); }
    expect(actual).toBe(state);
  }
  async function publication(input: SeriesInput, row: SeriesRow) {
    const [evidence] = await deploy<{ fact: Record<string, unknown>; event: Record<string, unknown>;
      issue_date: string; valid_from_exact: boolean }[]>`SELECT to_jsonb(f) fact,to_jsonb(e) event,
      (e.created_at AT TIME ZONE p.timezone)::date::text issue_date,f.valid_from=f.recorded_at valid_from_exact
      FROM public.fact_log f JOIN public.outbox e ON e.tenant_id=f.tenant_id AND e.aggregate_id=f.entity_id
      JOIN public.org_node p ON p.tenant_id=f.tenant_id AND p.id=${input.property}::uuid
      WHERE f.tenant_id=${input.tenant}::uuid AND f.entity_type='document_series' AND f.entity_id=${row.series_id}::uuid
        AND f.fact_type='configured' AND e.aggregate_type='document_series' AND e.event_type='document.series.configured'`;
    expect(evidence).toBeDefined();
    const payload = { seriesId: row.series_id, propertyNode: input.property, supplierRegistrationId: input.supplier,
      documentKind: input.kind, prefix: input.prefix, financialYearStart: row.financial_year_start };
    expect(evidence!.fact).toMatchObject({ tenant_id: input.tenant, entity_type: "document_series", entity_id: row.series_id,
      fact_type: "configured", actor_id: input.actor, business_date: evidence!.issue_date, payload });
    expect(evidence!.fact.payload).toEqual(payload);
    expect(evidence!.event).toMatchObject({ tenant_id: input.tenant, property_node: input.property,
      aggregate_type: "document_series", aggregate_id: row.series_id, event_type: "document.series.configured", event_version: 1,
      actor_id: input.actor, business_date: evidence!.issue_date, causation_id: null, published_at: null, payload });
    expect(evidence!.event.payload).toEqual(payload);
    expect(evidence!.event.correlation_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(evidence!.valid_from_exact).toBe(true);
    const date = evidence!.issue_date;
    expect(row.financial_year_start).toBe(`${Number(date.slice(0, 4)) - (date.slice(5) < "04-01" ? 1 : 0)}-04-01`);
  }
  function exactAddition(before: Record<string, string[]>, after: Record<string, string[]>, row: SeriesRow) {
    expect(Object.keys(after)).toEqual(Object.keys(before));
    for (const table of Object.keys(before)) {
      const old = new Set(before[table]);
      expect(before[table]!.every(value => after[table]!.includes(value))).toBe(true);
      const added = after[table]!.filter(value => !old.has(value));
      const idKey = table === "document_series" ? "id" : table === "fact_log" ? "entity_id" : "aggregate_id";
      expect(added.length).toBe(["document_series", "fact_log", "outbox"].includes(table) ? 1 : 0);
      for (const value of added) expect(JSON.parse(value)[idKey]).toBe(row.series_id);
    }
  }

  test("concurrent same-key create commits exactly one three-row graph; replay and prefix conflict change nothing", async () => {
    const [clock] = await deploy<{ timezone: string }[]>`SELECT CASE WHEN
      (transaction_timestamp() AT TIME ZONE 'Pacific/Kiritimati')::date <>
      (transaction_timestamp() AT TIME ZONE 'UTC')::date THEN 'Pacific/Kiritimati' ELSE 'Etc/GMT+12' END timezone`;
    const { input } = await createSeriesFixture(deploy, runtime, { timezone: clock!.timezone });
    const before = await seriesRows(deploy);
    const rows = await Promise.all(Array.from({ length: 10 }, () => configure(input)));
    expect(rows.filter(row => row.created)).toHaveLength(1);
    expect(new Set(rows.map(row => row.series_id)).size).toBe(1);
    expect(rows.every(row => row.next_no === "1")).toBe(true);
    exactAddition(before, await seriesRows(deploy), rows[0]!);
    await publication(input, rows[0]!);
    const [dateWitness] = await deploy<{ different: boolean }[]>`SELECT business_date <>
      (created_at AT TIME ZONE 'UTC')::date different FROM public.outbox
      WHERE tenant_id=${input.tenant}::uuid AND aggregate_id=${rows[0]!.series_id}::uuid AND event_type='document.series.configured'`;
    expect(dateWitness?.different).toBe(true);
    const stable = await seriesRows(deploy);
    expect(await configure(input)).toEqual({ ...rows[0]!, created: false });
    await denied({ ...input, prefix: "OTHER/" }, "23505");
    expect(await seriesRows(deploy)).toEqual(stable);
  }, 120_000);

  test("current actor, tenant, permission and membership revocations deny new and existing scope without effects", async () => {
    const { input, roleId, candidate } = await createSeriesFixture(deploy, runtime);
    await configure(input);
    const before = await seriesRows(deploy);
    const attempts = async () => { await denied(input); await denied({ ...input, kind: "debit_note", prefix: "D453/" });
      await denied({ ...input, supplier: crypto.randomUUID() }); };
    await denied({ ...input, actor: candidate.fixture.unauthorizedActor });
    for (const target of ["actor", "tenant", "permission", "membership"] as const) {
      try {
        if (target === "actor") await deploy`UPDATE public.app_user SET status='inactive' WHERE tenant_id=${input.tenant}::uuid AND id=${input.actor}::uuid`;
        if (target === "tenant") await deploy`UPDATE public.tenant SET status='inactive' WHERE id=${input.tenant}::uuid`;
        if (target === "permission") await deploy`DELETE FROM public.role_permission WHERE role_id=${roleId}::uuid AND permission_code='tax-fiscal.series:configure'`;
        if (target === "membership") await deploy`DELETE FROM public.user_role WHERE tenant_id=${input.tenant}::uuid AND user_id=${input.actor}::uuid AND role_id=${roleId}::uuid AND scope_node=${input.property}::uuid`;
        const revoked = await seriesRows(deploy); await attempts(); expect(await seriesRows(deploy)).toEqual(revoked);
      } finally {
        if (target === "actor") await deploy`UPDATE public.app_user SET status='active' WHERE tenant_id=${input.tenant}::uuid AND id=${input.actor}::uuid`;
        if (target === "tenant") await deploy`UPDATE public.tenant SET status='active' WHERE id=${input.tenant}::uuid`;
        if (target === "permission") await deploy`INSERT INTO public.role_permission(role_id,permission_code) VALUES(${roleId}::uuid,'tax-fiscal.series:configure')`;
        if (target === "membership") await deploy`INSERT INTO public.user_role(tenant_id,user_id,role_id,scope_node) VALUES(${input.tenant}::uuid,${input.actor}::uuid,${roleId}::uuid,${input.property}::uuid)`;
      }
      expect(await seriesRows(deploy)).toEqual(before);
    }
  }, 120_000);

  test("a foreign tenant role cannot confer local authority; wrong-property and foreign supplier stay excluded", async () => {
    const a = await createSeriesFixture(deploy, runtime); const b = await createSeriesFixture(deploy, runtime);
    await configure(a.input); const baseline = await seriesRows(deploy);
    try {
      await deploy`DELETE FROM public.role_permission WHERE role_id=${a.roleId}::uuid AND permission_code='tax-fiscal.series:configure'`;
      await deploy`INSERT INTO public.user_role(tenant_id,user_id,role_id,scope_node)
        VALUES(${a.input.tenant}::uuid,${a.input.actor}::uuid,${b.roleId}::uuid,${a.input.property}::uuid)`;
      const hostile = await seriesRows(deploy);
      await denied(a.input); await denied({ ...a.input, kind: "debit_note", prefix: "D453/" });
      expect(await seriesRows(deploy)).toEqual(hostile);
    } finally {
      await deploy`DELETE FROM public.user_role WHERE tenant_id=${a.input.tenant}::uuid AND user_id=${a.input.actor}::uuid AND role_id=${b.roleId}::uuid AND scope_node=${a.input.property}::uuid`;
      await deploy`INSERT INTO public.role_permission(role_id,permission_code) VALUES(${a.roleId}::uuid,'tax-fiscal.series:configure')`;
    }
    await denied({ ...a.input, property: b.input.property });
    await denied({ ...a.input, supplier: b.input.supplier }, "55000");
    await denied({ ...a.input, supplier: crypto.randomUUID() }, "55000");
    expect(await seriesRows(deploy)).toEqual(baseline);
    const aCredit = await configure(a.input); const aDebit = await configure({ ...a.input, kind: "debit_note", prefix: "D453/" });
    const bCredit = await configure(b.input);
    expect(new Set([aCredit.series_id, aDebit.series_id, bCredit.series_id]).size).toBe(3);
  }, 120_000);

  test("genuine invoice issuance advances only its series; configuration replay preserves its complete graph", async () => {
    const { candidate, input } = await createSeriesFixture(deploy, runtime);
    await new IssueIndiaNativeFiscalInvoiceCommand(runtime).execute(candidate.request);
    const before = await seriesRows(deploy);
    const row = await configure({ ...input, kind: "invoice", prefix: "INV/" });
    expect(row).toMatchObject({ created: false, next_no: "2", series_id: candidate.series.seriesId });
    expect(await seriesRows(deploy)).toEqual(before);
  }, 120_000);

  test("same-tenant properties and prior/current FY keys coexist with exactly one publication graph per new key", async () => {
    const first = await createSeriesFixture(deploy, runtime);
    const second = await createSecondSeriesProperty(deploy, first);
    const prior = await createPriorYearSeries(deploy, first);
    expect(second.input.tenant).toBe(first.input.tenant);
    expect(second.input.actor).toBe(first.input.actor);
    expect(second.input.property).not.toBe(first.input.property);
    expect(second.input.supplier).not.toBe(first.input.supplier);
    const before = await seriesRows(deploy);
    let duplicateState: string | undefined;
    try {
      await deploy`INSERT INTO public.property_fiscal_registration
        SELECT (jsonb_populate_record(NULL::public.property_fiscal_registration,
          to_jsonb(r) || jsonb_build_object('id',${crypto.randomUUID()}::uuid,
            'registration_number',${first.candidate.statutory.recipient.gstin}::text,'legal_name','Synthetic distinct supplier'))).*
        FROM public.property_fiscal_registration r WHERE r.tenant_id=${first.input.tenant}::uuid AND r.id=${first.input.supplier}::uuid`;
    } catch (error) { duplicateState = seriesSqlState(error); }
    expect(duplicateState).toBe("23505");
    expect(await seriesRows(deploy)).toEqual(before);

    const firstCurrent = await configure(first.input);
    const firstAfter = await seriesRows(deploy);
    expect(firstCurrent.created).toBe(true);
    exactAddition(before, firstAfter, firstCurrent);
    await publication(first.input, firstCurrent);
    const secondCurrent = await configure(second.input);
    const secondAfter = await seriesRows(deploy);
    expect(secondCurrent.created).toBe(true);
    exactAddition(firstAfter, secondAfter, secondCurrent);
    await publication(second.input, secondCurrent);
    expect(new Set([prior.id, firstCurrent.series_id, secondCurrent.series_id]).size).toBe(3);
    expect(prior.financial_year_start).toBe(`${Number(firstCurrent.financial_year_start.slice(0, 4)) - 1}-04-01`);
    expect(secondCurrent.financial_year_start).toBe(firstCurrent.financial_year_start);
    const rows = await deploy<{ id: string; financial_year: string; next_no: string }[]>`SELECT id::text,
      financial_year_start::text AS financial_year,next_no::text FROM public.document_series
      WHERE tenant_id=${first.input.tenant}::uuid AND property_node=${first.input.property}::uuid
        AND supplier_registration_id=${first.input.supplier}::uuid AND kind=${first.input.kind} ORDER BY financial_year_start`;
    expect(rows).toEqual([{ id: prior.id, financial_year: prior.financial_year_start, next_no: "1" },
      { id: firstCurrent.series_id, financial_year: firstCurrent.financial_year_start, next_no: "1" }]);
    const [history] = await deploy<{ facts: number; events: number }[]>`SELECT
      (SELECT count(*)::int FROM public.fact_log WHERE tenant_id=${first.input.tenant}::uuid AND entity_id=${prior.id}::uuid) facts,
      (SELECT count(*)::int FROM public.outbox WHERE tenant_id=${first.input.tenant}::uuid AND aggregate_id=${prior.id}::uuid) events`;
    expect(history).toEqual({ facts: 0, events: 0 });
    expect(await configure(first.input)).toEqual({ ...firstCurrent, created: false });
    expect(await configure(second.input)).toEqual({ ...secondCurrent, created: false });
    expect(await seriesRows(deploy)).toEqual(secondAfter);
  }, 120_000);

  test("prior publication denies after authorization even with a hostile pg_temp lock catalogue", async () => {
    const { input, candidate } = await createSeriesFixture(deploy, runtime);
    const before = await seriesRows(deploy);
    for (const [actor, expected] of [[input.actor, "55000"], [candidate.fixture.unauthorizedActor, "42501"]] as const) {
      let state: string | undefined;
      try { await runtime.withTenantTransaction(input.tenant, async tx => {
        await tx.unsafe("CREATE TEMP TABLE pg_locks (LIKE pg_catalog.pg_locks) ON COMMIT DROP");
        await tx`SELECT pg_catalog.pg_advisory_xact_lock(6441674055002974568::bigint)`;
        await configureSeries(tx, { ...input, actor });
      }); } catch (error) { state = seriesSqlState(error); }
      expect(state).toBe(expected);
    }
    const direct = new SQL(runtimeUrl!, { max: 1, prepare: false });
    try {
      let state: string | undefined;
      try { await direct.unsafe(`SELECT * FROM ${SERIES_SIGNATURE.split("(")[0]}($1::uuid,$2::uuid,$3::uuid,$4,$5,$6::uuid)`,
        [input.tenant, input.property, input.supplier, input.kind, input.prefix, input.actor]); }
      catch (error) { state = seriesSqlState(error); }
      expect(state).toBe("42501");
    } finally { await direct.close(); }
    let wrongContext: string | undefined;
    try { await runtime.withTenantTransaction(input.tenant, tx => configureSeries(tx, { ...input, tenant: crypto.randomUUID() })); }
    catch (error) { wrongContext = seriesSqlState(error); }
    expect(wrongContext).toBe("42501");
    expect(await seriesRows(deploy)).toEqual(before);
  }, 120_000);

  test("current-authority locks serialize permission revocation in both acquisition orders", async () => {
    const { input, roleId } = await createSeriesFixture(deploy, runtime);
    async function bounded<T>(promise: Promise<T>): Promise<T> {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try { return await Promise.race([promise, new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Order453 owned race handshake timed out")), 10_000);
      })]); } finally { clearTimeout(timer); }
    }
    const waitForBlock = async (pid: number) => {
      const deadline = performance.now() + 5_000;
      while (performance.now() < deadline) {
        const [row] = await deploy<{ blocked: boolean }[]>`SELECT cardinality(pg_catalog.pg_blocking_pids(${pid}))>0 blocked`;
        if (row?.blocked) return;
        await Bun.sleep(20);
      }
      throw new Error("Order453 expected owned lock contention");
    };
    let release!: () => void; let ready!: () => void; let reportPid!: (pid: number) => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const reached = new Promise<void>(resolve => { ready = resolve; });
    const pidReady = new Promise<number>(resolve => { reportPid = resolve; });
    const creator = runtime.withTenantTransaction(input.tenant, async tx => {
      const row = await configureSeries(tx, input); ready(); await gate; return row;
    });
    let revoke: Promise<unknown> | undefined;
    try {
      await bounded(Promise.race([reached, creator.then(() => { throw new Error("Creator ended before held-lock witness"); })]));
      revoke = deploy.begin(async tx => {
        await tx.unsafe("SET LOCAL statement_timeout='10s'");
        const [row] = await tx<{ pid: number }[]>`SELECT pg_backend_pid() pid`; reportPid(row!.pid);
        await tx`DELETE FROM public.role_permission WHERE role_id=${roleId}::uuid AND permission_code='tax-fiscal.series:configure'`;
      });
      await waitForBlock(await bounded(pidReady)); release();
      expect((await creator).created).toBe(true); await revoke;
      await denied(input);
    } finally {
      release(); await Promise.allSettled([creator, ...(revoke ? [revoke] : [])]);
      await deploy`INSERT INTO public.role_permission(role_id,permission_code) VALUES(${roleId}::uuid,'tax-fiscal.series:configure') ON CONFLICT DO NOTHING`;
    }
    const before = await seriesRows(deploy);
    let releaseRevoke!: () => void; let revokeReady!: () => void; let callerPid!: (pid: number) => void;
    const revokeGate = new Promise<void>(resolve => { releaseRevoke = resolve; });
    const locked = new Promise<void>(resolve => { revokeReady = resolve; });
    const callReady = new Promise<number>(resolve => { callerPid = resolve; });
    const revoker = deploy.begin(async tx => {
      await tx.unsafe("SET LOCAL statement_timeout='10s'");
      await tx`DELETE FROM public.role_permission WHERE role_id=${roleId}::uuid AND permission_code='tax-fiscal.series:configure'`;
      revokeReady(); await revokeGate;
    });
    let caller: Promise<string | undefined> | undefined;
    try {
      await bounded(Promise.race([locked, revoker.then(() => { throw new Error("Revoker ended before held-lock witness"); })]));
      caller = runtime.withTenantTransaction(input.tenant, async tx => {
        await tx.unsafe("SET LOCAL statement_timeout='10s'");
        const [row] = await tx<{ pid: number }[]>`SELECT pg_backend_pid() pid`; callerPid(row!.pid);
        await configureSeries(tx, { ...input, kind: "debit_note", prefix: "D453/" });
      }).then(() => undefined, error => seriesSqlState(error));
      await waitForBlock(await bounded(callReady)); releaseRevoke(); await revoker;
      expect(["40001", "42501"]).toContain((await caller) ?? "unexpected_success");
      await denied({ ...input, kind: "debit_note", prefix: "D453/" });
    } finally {
      releaseRevoke(); await Promise.allSettled([revoker, ...(caller ? [caller] : [])]);
      await deploy`INSERT INTO public.role_permission(role_id,permission_code) VALUES(${roleId}::uuid,'tax-fiscal.series:configure') ON CONFLICT DO NOTHING`;
    }
    expect(await seriesRows(deploy)).toEqual(before);
  }, 120_000);

  test("fact/outbox failures and a late caller failure roll back all three rows and restore exact metadata", async () => {
    const { input } = await createSeriesFixture(deploy, runtime);
    const original = { rows: await seriesRows(deploy), catalogue: await seriesCatalogue(deploy) };
    for (const table of ["fact_log", "outbox"] as const) {
      const name = `order453_fault_${crypto.randomUUID().replaceAll("-", "")}`;
      const selector = table === "fact_log" ? "NEW.entity_type='document_series' AND NEW.fact_type='configured'"
        : "NEW.aggregate_type='document_series' AND NEW.event_type='document.series.configured'";
      let installed = false;
      try {
        await deploy.begin(async tx => {
          await tx.unsafe(`LOCK TABLE public.${table} IN ACCESS EXCLUSIVE MODE`);
          const [collision] = await tx<{ function_exists: boolean; trigger_exists: boolean }[]>`
            SELECT pg_catalog.to_regprocedure(${`public.${name}()`}) IS NOT NULL AS function_exists,
              EXISTS (SELECT 1 FROM pg_catalog.pg_trigger
                WHERE tgrelid=pg_catalog.to_regclass(${`public.${table}`}) AND tgname=${name}) AS trigger_exists`;
          if (!collision || collision.function_exists || collision.trigger_exists) {
            throw new Error("Order453 fault fixture target already exists or cannot be verified");
          }
          await tx.unsafe(`CREATE FUNCTION public.${name}() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
            SET search_path=pg_catalog,public,pg_temp AS $fault$ BEGIN
            IF NEW.tenant_id='${input.tenant}'::uuid AND ${selector}
              AND NEW.payload @> '{"documentKind":"credit_note","prefix":"C453/"}'::jsonb THEN
              RAISE EXCEPTION USING ERRCODE='PZ453',MESSAGE='Order453 owned publication fault'; END IF;
            RETURN NEW; END $fault$`);
          await tx.unsafe(`ALTER FUNCTION public.${name}() OWNER TO yellow_owner`);
          await tx.unsafe(`REVOKE ALL ON FUNCTION public.${name}() FROM PUBLIC,app_role,yellow_runtime`);
          await tx.unsafe(`CREATE TRIGGER ${name} BEFORE INSERT ON public.${table} FOR EACH ROW EXECUTE FUNCTION public.${name}()`);
        });
        installed = true;
        const faulted = await seriesCatalogue(deploy);
        await denied(input, "PZ453");
        expect(await seriesRows(deploy)).toEqual(original.rows);
        expect(await seriesCatalogue(deploy)).toBe(faulted);
      } finally {
        if (installed) {
          await deploy.begin(async tx => {
            await tx.unsafe(`LOCK TABLE public.${table} IN ACCESS EXCLUSIVE MODE`);
            await tx.unsafe(`DROP TRIGGER ${name} ON public.${table}`);
            await tx.unsafe(`DROP FUNCTION public.${name}()`);
          });
        }
        expect({ rows: await seriesRows(deploy), catalogue: await seriesCatalogue(deploy) }).toEqual(original);
      }
    }
    let failed = false;
    try { await runtime.withTenantTransaction(input.tenant, async tx => {
      expect((await configureSeries(tx, input)).created).toBe(true);
      const rows = await tx<{ count: number }[]>`SELECT count(*)::int count FROM public.outbox
        WHERE tenant_id=${input.tenant}::uuid AND event_type='document.series.configured' AND payload @> '{"documentKind":"credit_note"}'::jsonb`;
      expect(rows[0]?.count).toBe(1); throw new Error("Order453 deliberate after-publication rollback");
    }); } catch (error) { failed = error instanceof Error && error.message === "Order453 deliberate after-publication rollback"; }
    expect(failed).toBe(true);
    expect({ rows: await seriesRows(deploy), catalogue: await seriesCatalogue(deploy) }).toEqual(original);
  }, 120_000);
});
