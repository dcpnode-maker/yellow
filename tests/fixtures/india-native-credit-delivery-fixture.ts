import { SQL } from "bun";
import { Database, type Tx } from "../../src/kernel";
import { createCreditSubmissionScenario, requestCreditSubmission } from "./india-native-credit-submission-fixture";
import { projectIssuedIndiaIrpWireCandidate } from "../../src/contexts/tax-fiscal/india-irp-issued-wire-candidate";
import type { Order440ClearIrpIssuedDocument } from "./order440-clearirp-protocol";

export const CREDIT_DELIVERY_SIGNATURE = "public.read_india_native_credit_delivery_by_document(uuid,uuid,uuid,uuid)";
export type CreditDeliveryScenario = Awaited<ReturnType<typeof createCreditSubmissionScenario>>;
export type CreditDeliveryTargetMode = "native-draft" | "ci-canonical";
export function creditDeliveryMigration(mode: CreditDeliveryTargetMode) {
  return new URL(mode === "native-draft"
    ? "../../handoff/drafts/order452/0089_native_credit_delivery_discovery.sql"
    : "../../migrations/0089_native_credit_delivery_discovery.sql", import.meta.url);
}
export function parseCreditDeliveryTargetMode(value: string | undefined): CreditDeliveryTargetMode {
  if (value !== "native-draft" && value !== "ci-canonical") throw new Error("Order452 requires an explicit target mode");
  return value;
}
/** Identity guard only. Root's separately reviewed Q241 stage authorizes execution. */
export function assertCreditDeliveryTargets(deploy: string, runtime: string, purpose: "runtime" | "rollback",
  mode: CreditDeliveryTargetMode, ciAdmitted = false, ciAddress?: string, nativeAdmitted = false): void {
  if (purpose !== "runtime" && purpose !== "rollback") throw new Error("Order452 proof operation is invalid");
  parseCreditDeliveryTargetMode(mode);
  if (mode === "native-draft" && nativeAdmitted !== true) throw new Error("Order452 native execution requires explicit Q241 admission");
  if (mode === "ci-canonical" && (ciAdmitted !== true || !ciAddress)) {
    throw new Error("Order452 canonical CI target requires explicit admission and address");
  }
  // Both native phases use the disposable clone: rollback BEFORE draft install.
  // The populated canonical88 source is never a fixture or rollback target.
  const name = mode === "native-draft" ? "yellow_order452_credit_delivery_candidate_20260908"
    : purpose === "runtime" ? "yellow_order452_current89_ci" : "yellow_order452_upgrade88_ci";
  const urls = [new URL(deploy), new URL(runtime)];
  urls.forEach((url, index) => {
    const server = mode === "native-draft"
      ? url.hostname === "127.0.0.1" && url.port === "55503"
      : url.host === ciAddress && /^\d+$/.test(url.port) && Number(url.port) >= 1
        && Number(url.port) <= 65_535 && url.port !== "55503";
    if (!["postgres:", "postgresql:"].includes(url.protocol) || url.pathname !== `/${name}`
      || !server || url.search || url.hash || !url.password
      || decodeURIComponent(url.username) !== (index === 0 ? "yellow_deploy" : "yellow_runtime")) {
      throw new Error("Order452 requires the exact paired dedicated target identities");
    }
  });
  if (urls[0]!.host !== urls[1]!.host) throw new Error("Order452 deploy/runtime target pair differs");
}

export function createCreditDeliveryScenario(deploy: SQL, database: Database,
  options: Parameters<typeof createCreditSubmissionScenario>[2] = {}): Promise<CreditDeliveryScenario> {
  return createCreditSubmissionScenario(deploy, database, { ...options,
    label: options.label ?? `credit452-${crypto.randomUUID().slice(0, 12)}` });
}
export async function readCreditDelivery(tx: Tx, scenario: Pick<CreditDeliveryScenario, "tenantId" | "propertyNode" | "actorId" | "documentId">) {
  const rows = await tx<{ delivery: Record<string, unknown> | null }[]>`
    SELECT public.read_india_native_credit_delivery_by_document(${scenario.tenantId}::uuid,
      ${scenario.propertyNode}::uuid,${scenario.actorId}::uuid,${scenario.documentId}::uuid) AS delivery`;
  if (rows.length !== 1) throw new Error("Order452 expected exactly one delivery row");
  return rows[0]!.delivery;
}
export async function requestCreditDelivery(database: Database, scenario: CreditDeliveryScenario) {
  const result = await database.withTenantTransaction(scenario.tenantId,
    tx => requestCreditSubmission(tx, scenario, `credit452-${crypto.randomUUID()}`));
  if (typeof result.submissionId !== "string") throw new Error("Order452 request returned no submission identity");
  return Object.freeze({ ...scenario, submissionId: result.submissionId });
}
export async function creditDeliveryProtocolDocument(deploy: SQL, scenario: CreditDeliveryScenario): Promise<Order440ClearIrpIssuedDocument> {
  const [row] = await deploy<{ content: string; hash: string }[]>`SELECT content::text content,sha256 hash
    FROM public.document WHERE tenant_id=${scenario.tenantId}::uuid AND id=${scenario.documentId}::uuid`;
  if (!row) throw new Error("Order452 genuine credit missing");
  const wire = projectIssuedIndiaIrpWireCandidate({ documentId: scenario.documentId,
    documentSha256: row.hash, contentJson: row.content });
  if (!wire.ok) throw new Error("Order452 genuine credit projection failed");
  return { documentId: scenario.documentId, documentSha256: row.hash, sourceContentJson: row.content,
    wireJson: wire.value.wireJson, wireSha256: wire.value.wireSha256, providerKey: scenario.provider.providerKey };
}

/** All public rows, not just tenant-labelled financial tables; hashes contain no row payloads. */
export async function creditDeliveryRows(deploy: SQL): Promise<Record<string, string>> {
  const tables = await deploy<{ name: string }[]>`SELECT relname name FROM pg_catalog.pg_class
    WHERE relnamespace='public'::regnamespace AND relkind='r' ORDER BY relname`;
  const rows: Record<string, string> = {};
  for (const { name } of tables) {
    if (!/^[a-z0-9_]+$/.test(name)) throw new Error("Unexpected public table identifier");
    const [row] = await deploy.unsafe<{ hash: string }[]>(`SELECT encode(public.digest(convert_to(
      coalesce(string_agg(value,E'\\n' ORDER BY value COLLATE "C"),''),'UTF8'),'sha256'),'hex') hash
      FROM (SELECT to_jsonb(r)::text value FROM public."${name}" r) contents`);
    if (!row) throw new Error("Missing preservation fingerprint"); rows[name] = row.hash;
  }
  return rows;
}
export async function creditDeliveryCatalogue(deploy: SQL): Promise<string> {
  const [row] = await deploy<{ value: string }[]>`SELECT jsonb_build_object(
    'relations',(SELECT jsonb_agg(to_jsonb(c) ORDER BY c.oid) FROM pg_catalog.pg_class c WHERE c.relnamespace='public'::regnamespace),
    'columns',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.attrelid,a.attnum) FROM pg_catalog.pg_attribute a
      JOIN pg_catalog.pg_class c ON c.oid=a.attrelid WHERE c.relnamespace='public'::regnamespace),
    'functions',(SELECT jsonb_agg(jsonb_build_array(p.oid,pg_get_functiondef(p.oid),p.proacl,p.proowner,p.proconfig) ORDER BY p.oid)
      FROM pg_catalog.pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.prokind='f'),
    'constraints',(SELECT jsonb_agg(to_jsonb(c) ORDER BY c.oid) FROM pg_catalog.pg_constraint c WHERE c.connamespace='public'::regnamespace),
    'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c
      ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace),
    'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_catalog.pg_policy p JOIN pg_catalog.pg_class c
      ON c.oid=p.polrelid WHERE c.relnamespace='public'::regnamespace))::text value`;
  if (!row) throw new Error("Missing catalogue snapshot"); return row.value;
}
