import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { Database, type Tx } from "../src/kernel";
import { IssueIndiaNativeFiscalInvoiceCommand } from "../src/commands/issue-india-native-fiscal-invoice";
import { IndiaNativeFiscalSeriesAuthorizationError, IndiaNativeFiscalSeriesDatabaseError } from "../src/contexts/tax-fiscal/india-native-fiscal-invoice";
import { IndiaNativeFiscalSeriesDiscoveryService, type IndiaNativeFiscalSeriesDiscoveryInput } from "../src/contexts/tax-fiscal/india-native-fiscal-series-discovery";
import { configureSeries, createSeriesFixture, createSecondSeriesProperty, createPriorYearSeries,
  seriesCatalogue, seriesRows, SERIES_SIGNATURE, type SeriesInput } from "./fixtures/india-native-fiscal-series-fixture";

// Intentionally non-executable until root pins a separately admitted exact target.
// No existing453 environment can activate these prospective454 proof operations.
type AdmittedTarget = Readonly<{ hostname: "127.0.0.1"; port: string; database: string }>;
const ADMITTED_TARGET: AdmittedTarget | null = { hostname: "127.0.0.1", port: "55503", database: "yellow_order453_referee90_20260908" };
const deployUrl = process.env.YELLOW_ORDER454_DEPLOY_DATABASE_URL;
const runtimeUrl = process.env.YELLOW_ORDER454_RUNTIME_DATABASE_URL;
const required = process.env.YELLOW_REQUIRE_ORDER454_DATABASE === "1";
function assertTarget(deploy: string, runtime: string, admitted: AdmittedTarget | null, execute: boolean): void {
  if (!admitted || !execute) throw new Error("Order454 has no separately reviewed native target execution admission");
  for (const [index, value] of [deploy, runtime].entries()) {
    const url = new URL(value);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== admitted.hostname || url.port !== admitted.port ||
        url.pathname !== `/${admitted.database}` || url.username !== (index === 0 ? "yellow_deploy" : "yellow_runtime") ||
        !url.password || url.search || url.hash) throw new Error("Order454 requires exact paired admitted target identities");
  }
}
if (required || deployUrl || runtimeUrl) {
  if (!required || !deployUrl || !runtimeUrl) throw new Error("Order454 requires mandatory paired target admission");
  assertTarget(deployUrl, runtimeUrl, ADMITTED_TARGET, process.env.YELLOW_ORDER454_NATIVE_EXECUTION_ADMITTED === "1");
}
test("Order454 prospective native proof cannot activate without a separately pinned target", () => {
  const url = (role: string) => `postgres://${role}:synthetic@127.0.0.1:5544/unadmitted`;
  expect(() => assertTarget(url("yellow_deploy"), url("yellow_runtime"), null, true)).toThrow("no separately reviewed");
  expect(() => assertTarget(url("yellow_deploy"), url("yellow_runtime"), { hostname: "127.0.0.1", port: "5544", database: "unadmitted" }, false)).toThrow("no separately reviewed");
});

const service = new IndiaNativeFiscalSeriesDiscoveryService();
type Fixture = Awaited<ReturnType<typeof createSeriesFixture>>;
type Observation = { raw?: unknown; calls: number };
type Tagged = (parts: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
type ExpectedError = Readonly<{
  type: typeof IndiaNativeFiscalSeriesAuthorizationError | typeof IndiaNativeFiscalSeriesDatabaseError;
  message: string;
}>;
type Settled<T> = Readonly<{ tag: "resolved"; value: T }> | Readonly<{ tag: "rejected"; error: unknown }>;

class SettledRejectionAssertionError extends Error {
  constructor(readonly reason: "resolved" | "wrong-error" | "wrong-message", readonly actual: unknown) {
    super(reason === "resolved" ? "Expected operation to reject, but it resolved"
      : reason === "wrong-error" ? "Rejected operation used the wrong error type"
      : "Rejected operation used the wrong error message");
    this.name = "SettledRejectionAssertionError";
  }
}

async function settleOperation<T>(operation: PromiseLike<T>): Promise<Settled<T>> {
  try {
    return { tag: "resolved", value: await operation };
  } catch (error) {
    return { tag: "rejected", error };
  }
}

function assertSettledRejectionAs<T>(settled: Settled<T>, expected: ExpectedError): Error {
  if (settled.tag === "resolved") throw new SettledRejectionAssertionError("resolved", settled.value);
  if (!(settled.error instanceof expected.type)) throw new SettledRejectionAssertionError("wrong-error", settled.error);
  if (settled.error.message !== expected.message) throw new SettledRejectionAssertionError("wrong-message", settled.error);
  expect(settled.error).toBeInstanceOf(expected.type);
  expect(settled.error.message).toBe(expected.message);
  return settled.error;
}

async function captureControl<T>(operation: PromiseLike<T>, expected: ExpectedError): Promise<Readonly<{
  rejected: boolean;
  tag: "returned" | "threw";
  errorType: string | null;
  reason: string | null;
  actual: unknown;
  value?: Error;
}>> {
  const settled = await settleOperation(operation);
  try {
    return { rejected: false, tag: "returned", errorType: null, reason: null,
      actual: null, value: assertSettledRejectionAs(settled, expected) };
  } catch (error) {
    return { rejected: true, tag: "threw", errorType: error instanceof Error ? error.constructor.name : typeof error,
      reason: error instanceof SettledRejectionAssertionError ? error.reason : null,
      actual: error instanceof SettledRejectionAssertionError ? error.actual : null };
  }
}

test("settled rejection assertion distinguishes expected rejection, resolved undefined and wrong error type", async () => {
  const expected = new IndiaNativeFiscalSeriesAuthorizationError("expected control rejection");
  const expectedContract = { type: IndiaNativeFiscalSeriesAuthorizationError, message: expected.message } as const;
  const accepted = await captureControl(Promise.reject(expected), expectedContract);
  expect(accepted.rejected).toBe(false);
  expect(accepted.tag).toBe("returned");
  expect(accepted.errorType).toBeNull();
  expect(accepted.reason).toBeNull();
  expect(accepted.actual).toBeNull();
  expect(accepted.value).toBe(expected);

  const resolved = await captureControl(Promise.resolve(undefined), expectedContract);
  expect(resolved).toMatchObject({ rejected: true, tag: "threw", errorType: "SettledRejectionAssertionError", reason: "resolved" });
  expect(resolved.actual).toBeUndefined();

  const wrongError = new IndiaNativeFiscalSeriesDatabaseError(expected.message);
  const wrong = await captureControl(Promise.reject(wrongError), expectedContract);
  expect(wrong).toMatchObject({ rejected: true, tag: "threw", errorType: "SettledRejectionAssertionError", reason: "wrong-error" });
  expect(wrong.actual).toBe(wrongError);

  const wrongMessageError = new IndiaNativeFiscalSeriesAuthorizationError("wrong control rejection");
  const wrongMessage = await captureControl(Promise.reject(wrongMessageError), expectedContract);
  expect(wrongMessage).toMatchObject({ rejected: true, tag: "threw",
    errorType: "SettledRejectionAssertionError", reason: "wrong-message" });
  expect(wrongMessage.actual).toBe(wrongMessageError);
});

function observe(tx: Tx, observation: Observation): Tx {
  return (async (parts: TemplateStringsArray, ...values: unknown[]) => {
    observation.calls++;
    const raw = await (tx as unknown as Tagged)(parts, ...values);
    observation.raw = raw;
    return raw; // Preserve the genuine Bun row container for the production decoder.
  }) as Tx;
}
function discovery(input: SeriesInput): IndiaNativeFiscalSeriesDiscoveryInput {
  return { tenantId: input.tenant, propertyNode: input.property, supplierRegistrationId: input.supplier,
    documentKind: input.kind, actorId: input.actor };
}
function digest(value: unknown): string { return new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex"); }

(required ? describe.serial : describe.skip)("Order454 canonical91 runtime fiscal-series discovery", () => {
  let deploy: SQL, runtime: Database;
  let first: Fixture, foreign: Fixture, second: Awaited<ReturnType<typeof createSecondSeriesProperty>>;
  let configured: Awaited<ReturnType<typeof configureSeries>>, secondConfigured: Awaited<ReturnType<typeof configureSeries>>;
  let prior: Awaited<ReturnType<typeof createPriorYearSeries>>, baseline: string | undefined;
  async function snapshot(): Promise<string> {
    const rows = await seriesRows(deploy), catalogue = await seriesCatalogue(deploy);
    const sequences = await deploy<{ value: string }[]>`SELECT to_jsonb(s)::text value FROM pg_catalog.pg_sequences s
      WHERE schemaname='public' ORDER BY sequencename`;
    return digest({ rows, catalogue, sequences });
  }
  async function unchanged<T>(operation: () => Promise<T>): Promise<T> {
    const before = await snapshot();
    try { return await operation(); } finally { expect(await snapshot()).toBe(before); }
  }
  async function read(input: IndiaNativeFiscalSeriesDiscoveryInput, outcome: "allowed" | "denied" | "unavailable" = "allowed",
    transactionTenant = input.tenantId) {
    return unchanged(async () => runtime.withTenantTransaction(transactionTenant, async tx => {
      const observation: Observation = { calls: 0 };
      const operation = service.read(observe(tx, observation), input);
      let value: Awaited<ReturnType<typeof service.read>> | undefined;
      if (outcome === "allowed") value = await operation;
      else {
        const expected: ExpectedError = outcome === "denied"
          ? { type: IndiaNativeFiscalSeriesAuthorizationError, message: "Fiscal-series discovery access is not granted" }
          : { type: IndiaNativeFiscalSeriesDatabaseError, message: "Fiscal-series discovery is unavailable" };
        assertSettledRejectionAs(await settleOperation(operation), expected);
      }
      expect(observation.calls).toBe(1);
      const rows = observation.raw as Record<string, unknown>[];
      expect(rows).toHaveLength(1);
      if (outcome === "denied") {
        expect(rows[0]!.authority_allowed).toBe(false);
        expect(Object.entries(rows[0]!).filter(([key]) => key !== "authority_allowed").every(([, item]) => item === null)).toBe(true);
      } else {
        expect(rows[0]!.authority_allowed).toBe(true);
        if (outcome === "unavailable") expect(rows[0]!.supplier_available).toBe(false);
      }
      return value;
    }));
  }
  beforeAll(async () => {
    deploy = new SQL(deployUrl!, { max: 2, prepare: false });
    runtime = Database.connect(runtimeUrl!, { maxConnections: 3, prepare: false });
    const [release] = await deploy<{ frontier: number; checksum: string; body: string }[]>`SELECT max(version)::int frontier,
      (SELECT checksum_sha256 FROM public.schema_migration WHERE version=90) checksum,
      (SELECT encode(sha256(convert_to(replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex') FROM pg_catalog.pg_proc
        WHERE oid=${SERIES_SIGNATURE}::regprocedure) body FROM public.schema_migration`;
    expect(release).toEqual({ frontier: 91,
      checksum: "67802156fe1a35d76023361dc8461699dad204017ff727441523fa9fb2b1faf9",
      body: "ba1a60e916897ff634b288ab20b7717708987ad63f416fcd9109cf463d9ff365" });
    // Exactly two new tenant cohorts/six fixture tx_codes. No pre-existing rows are changed.
    first = await createSeriesFixture(deploy, runtime, { label: `discovery454-${crypto.randomUUID().slice(0, 8)}` });
    foreign = await createSeriesFixture(deploy, runtime, { label: `foreign454-${crypto.randomUUID().slice(0, 8)}` });
    second = await createSecondSeriesProperty(deploy, first);
    prior = await createPriorYearSeries(deploy, first);
    configured = await runtime.withTenantTransaction(first.input.tenant, tx => configureSeries(tx, { ...first.input, prefix: "CUSTOM454/" }));
    secondConfigured = await runtime.withTenantTransaction(second.input.tenant, tx => configureSeries(tx, { ...second.input, prefix: "SECOND454/" }));
    await runtime.withTenantTransaction(foreign.input.tenant, tx => configureSeries(tx, { ...foreign.input, prefix: "FOREIGN454/" }));
    // Actual issuance advances the invoice counter; no raw counter mutation.
    await new IssueIndiaNativeFiscalInvoiceCommand(runtime).execute(first.candidate.request);
    baseline = await snapshot();
  }, 120_000);
  afterAll(async () => {
    try { if (baseline) expect(await snapshot()).toBe(baseline); }
    finally { await runtime?.close(); await deploy?.close(); }
  });

  test("actual Bun current configuration, custom prefix and absent kind are read without effects", async () => {
    expect(await read(discovery(first.input))).toEqual({ seriesId: configured.series_id, tenantId: first.input.tenant,
      propertyNode: first.input.property, supplierRegistrationId: first.input.supplier, documentKind: "credit_note",
      prefix: "CUSTOM454/", financialYearStart: configured.financial_year_start, nextNo: "1" });
    expect(Object.isFrozen(await read(discovery(first.input)))).toBe(true);
    expect(await read(discovery({ ...first.input, kind: "debit_note" }))).toBeNull();
  }, 60_000);

  test("genuinely advanced invoice, same-tenant second property and prior FY stay distinct", async () => {
    expect(await read(discovery({ ...first.input, kind: "invoice" }))).toMatchObject({
      seriesId: first.candidate.series.seriesId, documentKind: "invoice", nextNo: "2" });
    expect(await read(discovery(second.input))).toMatchObject({ seriesId: secondConfigured.series_id,
      propertyNode: second.input.property, supplierRegistrationId: second.input.supplier, prefix: "SECOND454/" });
    expect(prior.id).not.toBe(configured.series_id);
    expect(prior.financial_year_start).toBe(`${Number(configured.financial_year_start.slice(0, 4)) - 1}-04-01`);
    const [clock] = await deploy<{ business_date: string; financial_year: string }[]>`SELECT
      (transaction_timestamp() AT TIME ZONE timezone)::date::text business_date,
      make_date(extract(year FROM transaction_timestamp() AT TIME ZONE timezone)::int
        -CASE WHEN extract(month FROM transaction_timestamp() AT TIME ZONE timezone)<4 THEN 1 ELSE 0 END,4,1)::text financial_year
      FROM public.org_node WHERE tenant_id=${first.input.tenant}::uuid AND id=${first.input.property}::uuid`;
    expect((await read(discovery(first.input)))?.financialYearStart).toBe(clock!.financial_year);
  }, 60_000);

  test("wrong property, actor, tenant context and supplier never expose configuration", async () => {
    await read({ ...discovery(first.input), propertyNode: foreign.input.property }, "denied");
    await read({ ...discovery(first.input), actorId: foreign.input.actor }, "denied");
    await read({ ...discovery(first.input), actorId: first.candidate.fixture.unauthorizedActor }, "denied");
    await read(discovery(first.input), "denied", foreign.input.tenant);
    await read({ ...discovery(first.input), supplierRegistrationId: foreign.input.supplier }, "unavailable");
    await read({ ...discovery(first.input), supplierRegistrationId: second.input.supplier }, "unavailable");
    await read({ ...discovery(first.input), supplierRegistrationId: crypto.randomUUID() }, "unavailable");
  }, 120_000);

  test("current revoked actor, tenant, membership and permission deny both existing and absent kind", async () => {
    for (const target of ["actor", "tenant", "membership", "permission"] as const) {
      const before = await snapshot(); let installed = false;
      try {
        await deploy.begin(async tx => {
          let rows: unknown[];
          if (target === "actor") rows = await tx`UPDATE public.app_user SET status='inactive'
            WHERE tenant_id=${first.input.tenant}::uuid AND id=${first.input.actor}::uuid AND status='active' RETURNING id`;
          else if (target === "tenant") rows = await tx`UPDATE public.tenant SET status='inactive'
            WHERE id=${first.input.tenant}::uuid AND status='active' RETURNING id`;
          else if (target === "membership") rows = await tx`DELETE FROM public.user_role WHERE tenant_id=${first.input.tenant}::uuid
            AND user_id=${first.input.actor}::uuid AND role_id=${first.roleId}::uuid AND scope_node=${first.input.property}::uuid RETURNING user_id`;
          else rows = await tx`DELETE FROM public.role_permission WHERE role_id=${first.roleId}::uuid
            AND permission_code='tax-fiscal.series:configure' RETURNING role_id`;
          expect(rows).toHaveLength(1);
        }); installed = true;
        await read(discovery(first.input), "denied");
        await read(discovery({ ...first.input, kind: "debit_note" }), "denied");
      } finally {
        if (installed) await deploy.begin(async tx => {
          if (target === "actor") expect(await tx`UPDATE public.app_user SET status='active' WHERE tenant_id=${first.input.tenant}::uuid
            AND id=${first.input.actor}::uuid AND status='inactive' RETURNING id`).toHaveLength(1);
          else if (target === "tenant") expect(await tx`UPDATE public.tenant SET status='active'
            WHERE id=${first.input.tenant}::uuid AND status='inactive' RETURNING id`).toHaveLength(1);
          else if (target === "membership") await tx`INSERT INTO public.user_role(tenant_id,user_id,role_id,scope_node)
            VALUES(${first.input.tenant}::uuid,${first.input.actor}::uuid,${first.roleId}::uuid,${first.input.property}::uuid)`;
          else await tx`INSERT INTO public.role_permission(role_id,permission_code) VALUES(${first.roleId}::uuid,'tax-fiscal.series:configure')`;
        });
        expect(await snapshot()).toBe(before);
      }
      expect(await read(discovery(first.input))).toMatchObject({ seriesId: configured.series_id });
    }
  }, 180_000);

  test("a foreign role cannot grant local authority despite a fabricated local membership", async () => {
    const before = await snapshot(); let installed = false;
    try {
      await deploy.begin(async tx => {
        expect(await tx`SELECT 1 FROM public.user_role WHERE tenant_id=${first.input.tenant}::uuid
          AND user_id=${first.input.actor}::uuid AND role_id=${foreign.roleId}::uuid AND scope_node=${first.input.property}::uuid`).toHaveLength(0);
        expect(await tx`DELETE FROM public.role_permission WHERE role_id=${first.roleId}::uuid
          AND permission_code='tax-fiscal.series:configure' RETURNING role_id`).toHaveLength(1);
        await tx`INSERT INTO public.user_role(tenant_id,user_id,role_id,scope_node)
          VALUES(${first.input.tenant}::uuid,${first.input.actor}::uuid,${foreign.roleId}::uuid,${first.input.property}::uuid)`;
      }); installed = true;
      await read(discovery(first.input), "denied");
      await read(discovery({ ...first.input, kind: "debit_note" }), "denied");
    } finally {
      if (installed) await deploy.begin(async tx => {
        expect(await tx`DELETE FROM public.user_role WHERE tenant_id=${first.input.tenant}::uuid AND user_id=${first.input.actor}::uuid
          AND role_id=${foreign.roleId}::uuid AND scope_node=${first.input.property}::uuid RETURNING user_id`).toHaveLength(1);
        await tx`INSERT INTO public.role_permission(role_id,permission_code) VALUES(${first.roleId}::uuid,'tax-fiscal.series:configure')`;
      });
      expect(await snapshot()).toBe(before);
    }
  }, 60_000);

  test("supplier status for another local date is unavailable without deleting status evidence", async () => {
    const before = await snapshot(); let installed = false;
    const [clock] = await deploy<{ timezone: string; other_timezone: string }[]>`SELECT timezone,
      CASE WHEN (transaction_timestamp() AT TIME ZONE timezone)::date =
        (transaction_timestamp() AT TIME ZONE 'Pacific/Kiritimati')::date THEN 'Etc/GMT+12' ELSE 'Pacific/Kiritimati' END other_timezone
      FROM public.org_node WHERE tenant_id=${second.input.tenant}::uuid AND id=${second.input.property}::uuid`;
    expect(clock).toBeDefined();
    try {
      await deploy.begin(async tx => {
        expect(await tx`UPDATE public.org_node SET timezone=${clock!.other_timezone}
          WHERE tenant_id=${second.input.tenant}::uuid AND id=${second.input.property}::uuid AND timezone=${clock!.timezone} RETURNING id`).toHaveLength(1);
        const [status] = await tx<{ available: boolean }[]>`SELECT EXISTS(SELECT 1
          FROM public.india_gst_supplier_registration_status_snapshot s JOIN public.org_node p ON p.tenant_id=s.tenant_id
          WHERE s.tenant_id=${second.input.tenant}::uuid AND s.supplier_registration_id=${second.input.supplier}::uuid
            AND p.id=${second.input.property}::uuid AND s.status_as_of=(transaction_timestamp() AT TIME ZONE p.timezone)::date) available`;
        expect(status?.available).toBe(false);
      }); installed = true;
      await read(discovery(second.input), "unavailable");
      await read(discovery({ ...second.input, kind: "debit_note" }), "unavailable");
    } finally {
      if (installed) await deploy.begin(async tx => {
        expect(await tx`UPDATE public.org_node SET timezone=${clock!.timezone} WHERE tenant_id=${second.input.tenant}::uuid
          AND id=${second.input.property}::uuid AND timezone=${clock!.other_timezone} RETURNING id`).toHaveLength(1);
      });
      expect(await snapshot()).toBe(before);
    }
  }, 60_000);

  test("direct runtime and deploy sessions cannot substitute for governed tenant app-role reads", async () => {
    await unchanged(async () => {
      const direct = new SQL(runtimeUrl!, { max: 1, prepare: false });
      try {
        assertSettledRejectionAs(await settleOperation(service.read(direct as unknown as Tx, discovery(first.input))), {
          type: IndiaNativeFiscalSeriesAuthorizationError,
          message: "Fiscal-series discovery access is not granted",
        });
      }
      finally { await direct.close(); }
    });
    await unchanged(async () => deploy.begin(async tx => {
      await tx`SELECT set_config('app.tenant_id',${first.input.tenant},true)`;
      const observation: Observation = { calls: 0 };
      assertSettledRejectionAs(
        await settleOperation(service.read(observe(tx as unknown as Tx, observation), discovery(first.input))),
        { type: IndiaNativeFiscalSeriesAuthorizationError, message: "Fiscal-series discovery access is not granted" },
      );
      const rows = observation.raw as Record<string, unknown>[];
      expect(rows).toHaveLength(1); expect(rows[0]!.authority_allowed).toBe(false);
      expect(Object.entries(rows[0]!).filter(([key]) => key !== "authority_allowed").every(([, value]) => value === null)).toBe(true);
    }));
  }, 60_000);

  test("captures actual runtime natural plans and separately proves exact scope-index eligibility", async () => {
    type Plan = Record<string, unknown> & { Plans?: Plan[] };
    const nodes = (plan: Plan): Plan[] => [plan, ...(plan.Plans ?? []).flatMap(nodes)];
    for (const kind of ["credit_note", "debit_note"] as const) {
      const input = discovery({ ...first.input, kind });
      await unchanged(async () => runtime.withTenantTransaction(input.tenantId, async tx => {
        let statement: { text: string; values: unknown[] } | undefined;
        const recorder = (async (parts: TemplateStringsArray, ...values: unknown[]) => {
          statement = { text: parts.reduce((text, part, index) => text + (index ? `$${index}` : "") + part, ""), values };
          return (tx as unknown as Tagged)(parts, ...values);
        }) as Tx;
        const result = await service.read(recorder, input);
        expect(kind === "credit_note" ? result?.seriesId : result).toBe(kind === "credit_note" ? configured.series_id : null);
        if (!statement) throw new Error("Order454 service did not expose one statement");
        const captured = statement;
        expect(captured.text).not.toMatch(/\bOFFSET\b/);
        const explain = async (label: string) => {
          const result = await tx.unsafe<Record<string, unknown>[]>("EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) " + captured.text,
            captured.values as Parameters<Tx["unsafe"]>[1]);
          expect(result).toHaveLength(1);
          const document = result[0]!["QUERY PLAN"] as { Plan: Plan }[];
          expect(document).toHaveLength(1);
          const all = nodes(document[0]!.Plan);
          console.info("Order454 planner evidence", JSON.stringify({ label, kind, plan: document }));
          expect(all.some(node => node["Subplan Name"] === "CTE authority" && node["Actual Rows"] === 1)).toBe(true);
          const series = all.filter(node => node["Relation Name"] === "document_series");
          expect(series.length).toBeGreaterThan(0);
          return all;
        };
        const natural = await explain("natural-current90");
        const index = "document_series_india_native_fiscal_scope_uq";
        if (!natural.some(node => node["Index Name"] === index)) {
          await tx.unsafe("SET LOCAL enable_seqscan=off");
          const eligible = await explain("eligibility-only-enable_seqscan-off-not-natural-selection");
          expect(eligible.some(node => node["Index Name"] === index)).toBe(true);
        }
      }));
    }
  }, 120_000);
});
