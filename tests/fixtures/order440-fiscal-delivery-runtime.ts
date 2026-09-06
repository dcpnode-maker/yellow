import { SQL } from "bun";
import { Database } from "../../src/kernel";
import { Hs256TokenSigner } from "../../src/contexts/identity";
import {
  FiscalSubmissionDeliveryRuntime,
  FiscalSubmissionRepository,
  FiscalSubmissionWorker,
  VerifiedIndiaIrpAdapterRegistry,
  type FiscalProviderCallContext,
  type FiscalProviderLookup,
  type FiscalProviderResolution,
  type FiscalProviderSubmission,
  type FiscalSubmissionDeliveryRuntimeOptions,
  type VerifiedIndiaIrpAdapterRegistration,
} from "../../src/contexts/tax-fiscal";
import { PostgresDueFiscalSubmissionSource } from "../../src/workers/postgres-due-fiscal-submissions";
import {
  createFiscalSubmissionHttpScenario,
  fiscalRequest,
  fiscalSubmissionHttpApp,
  fiscalToken,
  type FiscalSubmissionHttpBody,
  type FiscalSubmissionHttpScenario,
} from "./order440-fiscal-submission-http";

function isExplicitLoopbackDatabaseTarget(target: URL): boolean {
  const port = Number(target.port);
  return (target.hostname === "127.0.0.1" || target.hostname === "[::1]")
    && /^\d{1,5}$/.test(target.port) && Number.isInteger(port) && port >= 1 && port <= 65_535;
}

export function assertFiscalDeliveryProofTargets(deploy: string, runtime: string): void {
  const targets = [new URL(deploy), new URL(runtime)];
  for (const [index, target] of targets.entries()) {
    if (!["postgres:", "postgresql:"].includes(target.protocol)
        || target.search !== "" || target.hash !== "" || target.password === ""
        || !isExplicitLoopbackDatabaseTarget(target)
        || decodeURIComponent(target.username) !== (index === 0 ? "yellow_deploy" : "yellow_runtime")
        || !/^\/yellow_order440_q204_[a-z0-9_]+$/.test(target.pathname)) {
      throw new Error("Fiscal delivery proof requires explicit isolated Q204 database authority");
    }
  }
  if (targets[0]!.hostname !== targets[1]!.hostname
      || targets[0]!.port !== targets[1]!.port || targets[0]!.pathname !== targets[1]!.pathname) {
    throw new Error("Fiscal delivery proof connections must target the same isolated database");
  }
}

export interface FiscalDeliveryScenario extends FiscalSubmissionHttpScenario {
  readonly submissionId: string;
}

export interface FiscalProtocolCall {
  readonly kind: "submit" | "lookup";
  readonly tenantId: string;
  readonly attemptId: string;
  readonly documentId: string;
  readonly payloadSha256: string;
  readonly payloadBodySha256: string;
  readonly signal: AbortSignal;
  readonly deadlineUnixMs: number;
}

export interface FiscalProtocolAdapterFixture {
  readonly registration: Readonly<VerifiedIndiaIrpAdapterRegistration>;
  readonly calls: readonly Readonly<FiscalProtocolCall>[];
}

export interface FiscalProtocolAdapterBehavior {
  readonly submit?: (
    input: FiscalProviderSubmission,
    context: FiscalProviderCallContext,
  ) => Promise<FiscalProviderResolution>;
  readonly lookup?: (
    input: FiscalProviderLookup,
    context: FiscalProviderCallContext,
  ) => Promise<FiscalProviderResolution>;
}

function sha256(value: Uint8Array | string): string {
  return new Bun.CryptoHasher("sha256").update(value).digest("hex");
}

/** Deterministic protocol fixture only. It asserts no certification or production authority. */
export function createFiscalProtocolAdapter(
  identity: FiscalSubmissionHttpScenario["provider"],
  behavior: FiscalProtocolAdapterBehavior = {},
): FiscalProtocolAdapterFixture {
  const calls: Readonly<FiscalProtocolCall>[] = [];
  const submit: VerifiedIndiaIrpAdapterRegistration["submit"] = async (input, context) => {
    calls.push(Object.freeze({ kind: "submit", tenantId: input.tenantId,
      attemptId: input.attemptId, documentId: input.documentId,
      payloadSha256: input.payloadSha256, payloadBodySha256: sha256(input.payload),
      signal: context.signal, deadlineUnixMs: context.deadlineUnixMs }));
    return behavior.submit?.(input, context) ?? Object.freeze({ verified: true,
      outcome: "accepted", authorityRef: `q204-submit-${input.attemptId}`,
      responseSha256: sha256(`q204-submit-${input.attemptId}`) });
  };
  const lookup: VerifiedIndiaIrpAdapterRegistration["lookup"] = async (input, context) => {
    calls.push(Object.freeze({ kind: "lookup", tenantId: input.tenantId,
      attemptId: input.attemptId, documentId: input.documentId,
      payloadSha256: input.payloadSha256, payloadBodySha256: sha256(input.payload), signal: context.signal,
      deadlineUnixMs: context.deadlineUnixMs }));
    return behavior.lookup?.(input, context) ?? Object.freeze({ verified: true,
      outcome: "accepted", authorityRef: `q204-lookup-${input.attemptId}`,
      responseSha256: sha256(`q204-lookup-${input.attemptId}`) });
  };
  return Object.freeze({
    registration: Object.freeze({
      kind: "registered_verified_india_irp_1_1_adapter",
      providerKey: identity.providerKey,
      providerExtensionId: identity.providerExtensionId,
      providerExtensionVersion: identity.providerExtensionVersion,
      submit,
      lookup,
    }),
    calls,
  });
}

export interface FiscalDeliveryRuntimeFixture {
  readonly pool: SQL;
  readonly repository: FiscalSubmissionRepository;
  readonly worker: FiscalSubmissionWorker;
  readonly source: PostgresDueFiscalSubmissionSource;
  readonly runtime: FiscalSubmissionDeliveryRuntime;
  close(): Promise<void>;
}

export function createFiscalDeliveryRuntime(
  runtimeDatabaseUrl: string,
  registrations: readonly VerifiedIndiaIrpAdapterRegistration[],
  options: FiscalSubmissionDeliveryRuntimeOptions = {},
): FiscalDeliveryRuntimeFixture {
  const parsed = new URL(runtimeDatabaseUrl);
  if (!/^postgres(?:ql)?:$/.test(parsed.protocol)
      || decodeURIComponent(parsed.username) !== "yellow_runtime"
      || parsed.password === "" || parsed.search !== "" || parsed.hash !== ""
      || !isExplicitLoopbackDatabaseTarget(parsed)
      || !/^\/yellow_order440_q204_[a-z0-9_]+$/.test(parsed.pathname)) {
    throw new Error("Fiscal delivery runtime fixture requires isolated Q204 runtime authority");
  }
  const pool = new SQL(runtimeDatabaseUrl, { max: 4, prepare: false, connectionTimeout: 5 });
  const repository = new FiscalSubmissionRepository(pool);
  const worker = new FiscalSubmissionWorker(repository, new VerifiedIndiaIrpAdapterRegistry(registrations));
  const source = new PostgresDueFiscalSubmissionSource(pool);
  const runtime = new FiscalSubmissionDeliveryRuntime(worker, source, {
    batchSize: 100,
    pollIntervalMs: 100,
    leaseSeconds: 60,
    transportDeadlineMs: 20_000,
    ...options,
  });
  let closed = false;
  return Object.freeze({ pool, repository, worker, source, runtime,
    async close() {
      if (closed) return;
      closed = true;
      await pool.close({ timeout: 0 });
    },
  });
}

/** Real signed HTTP request and native-issued invoice, never an inserted fake head. */
export async function createFiscalDeliveryScenario(
  deploy: SQL, database: Database, tokens: Hs256TokenSigner,
): Promise<FiscalDeliveryScenario> {
  const scenario = await createFiscalSubmissionHttpScenario(deploy, database);
  const app = fiscalSubmissionHttpApp(database, tokens, [scenario.provider]);
  const response = await app.handle(fiscalRequest(
    scenario, await fiscalToken(tokens, scenario), `q204-request-${crypto.randomUUID()}`,
  ));
  if (response.status !== 201) throw new Error("Q204 actual signed fiscal request failed");
  const body = await response.json() as FiscalSubmissionHttpBody;
  return Object.freeze({ ...scenario, submissionId: body.fiscalSubmission.submissionId });
}

export async function fiscalFinancialSnapshot(deploy: SQL, tenantId: string): Promise<readonly string[]> {
  const result: string[] = [];
  for (const table of ["document", "document_series", "journal", "posting_line"] as const) {
    const rows = await deploy.unsafe<{ body: string }[]>(
      `SELECT to_jsonb(source)::text AS body FROM public.${table} source
       WHERE tenant_id=$1::uuid ORDER BY to_jsonb(source)::text`, [tenantId],
    );
    result.push(...rows.map(({ body }) => `${table}:${body}`));
  }
  return Object.freeze(result);
}
