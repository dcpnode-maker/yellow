import { SQL } from "bun";
import { Database, type Tx } from "../../src/kernel";
import { createNativeIssuanceFixture } from "./india-native-fiscal-source-completion-fixture";
export { creditSqlState as seriesSqlState } from "./india-native-fiscal-credit-note-fixture";

/** Scoped453 snapshot excludes only the lazy trigger hint and five mutable
 * VACUUM/ANALYZE maintenance fields. Exact pg_trigger rows and all other catalogue
 * fields remain authoritative; shared452 and retained evidence are unchanged. */
export async function seriesCatalogue(deploy: SQL): Promise<string> {
  const [row] = await deploy<{ value: string }[]>`SELECT jsonb_build_object(
    'relations',(SELECT jsonb_agg(to_jsonb(c)-ARRAY['relhastriggers','relpages','reltuples','relallvisible','relfrozenxid','relminmxid']::text[] ORDER BY c.oid) FROM pg_catalog.pg_class c WHERE c.relnamespace='public'::regnamespace),
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

export const SERIES_SIGNATURE = "public.create_india_native_fiscal_series(uuid,uuid,uuid,text,text,uuid)";
export type SeriesMode = "native-draft" | "ci-canonical";
export function seriesMigration(mode: SeriesMode): URL {
  return new URL(mode === "native-draft" ? "../../handoff/drafts/order453/0090_india_native_fiscal_series_configuration.sql"
    : "../../migrations/0090_india_native_fiscal_series_configuration.sql", import.meta.url);
}
export function parseSeriesMode(value: string | undefined): SeriesMode {
  if (value !== "native-draft" && value !== "ci-canonical") throw new Error("Order453 requires explicit target mode");
  return value;
}
/** Identity guard only. Q242's separately frozen handoff admits actual execution. */
export function assertSeriesTargets(deploy: string, runtime: string, purpose: "runtime" | "upgrade",
  mode: SeriesMode, ciAdmitted: boolean, address: string | undefined, nativeAdmitted = false): void {
  parseSeriesMode(mode);
  if (!["runtime", "upgrade"].includes(purpose)) throw new Error("Order453 target purpose is invalid");
  if (mode === "native-draft" && nativeAdmitted !== true) throw new Error("Order453 native target requires explicit Q242 handoff");
  if (mode === "ci-canonical" && (!ciAdmitted || !address)) throw new Error("Order453 CI admission missing");
  const name = mode === "native-draft" ? "yellow_order453_series_candidate_20260908"
    : purpose === "runtime" ? "yellow_order453_current90_ci" : "yellow_order453_upgrade89_ci";
  [new URL(deploy), new URL(runtime)].forEach((url, index) => {
    const server = mode === "native-draft" ? url.hostname === "127.0.0.1" && url.port === "55503"
      : url.host === address && /^\d+$/.test(url.port) && Number(url.port) >= 1 && Number(url.port) <= 65535 && url.port !== "55503";
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !server || url.pathname !== `/${name}`
      || !url.password || url.search || url.hash || url.username !== (index === 0 ? "yellow_deploy" : "yellow_runtime")) {
      throw new Error("Order453 requires exact paired dedicated target identities");
    }
  });
}
export interface SeriesInput {
  tenant: string; property: string; supplier: string; actor: string;
  kind: "invoice" | "credit_note" | "debit_note"; prefix: string;
}
export interface SeriesRow {
  series_id: string; tenant_id: string; property_node: string; supplier_registration_id: string;
  document_kind: string; prefix: string; financial_year_start: string; next_no: string; created: boolean;
}
export async function configureSeries(tx: Tx, input: SeriesInput): Promise<SeriesRow> {
  const rows = await tx<SeriesRow[]>`SELECT series_id::text,tenant_id::text,property_node::text,supplier_registration_id::text,
    document_kind,prefix,financial_year_start::text,next_no::text,created
    FROM public.create_india_native_fiscal_series(${input.tenant}::uuid,${input.property}::uuid,
      ${input.supplier}::uuid,${input.kind},${input.prefix},${input.actor}::uuid)`;
  if (rows.length !== 1 || !rows[0]) throw new Error("Order453 expected one configured series");
  return rows[0];
}
export async function createSeriesFixture(deploy: SQL, runtime: Database,
  options: Parameters<typeof createNativeIssuanceFixture>[2] = {}) {
  const candidate = await createNativeIssuanceFixture(deploy, runtime, {
    ...options, label: options.label ?? `series453-${crypto.randomUUID().slice(0, 8)}`,
    statutoryOriginalConfiguration: "karnataka_supplier_karnataka_property",
  });
  const { fixture } = candidate;
  const [role] = await deploy<{ id: string }[]>`SELECT role_id::text id FROM public.user_role
    WHERE tenant_id=${fixture.tenant}::uuid AND user_id=${fixture.actor}::uuid ORDER BY role_id LIMIT 1`;
  if (!role) throw new Error("Order453 fixture role missing");
  const input: SeriesInput = { tenant: fixture.tenant, property: fixture.property,
    supplier: candidate.statutory.seller.registrationId, actor: fixture.actor, kind: "credit_note", prefix: "C453/" };
  return { candidate, input, roleId: role.id };
}

/** Adds only a second property, its exact scoped grant and synthetic registration/
 * current active status under the SAME existing tenant. No series is configured.
 * Same-property/same-jurisdiction duplicates are forbidden by0047; this is not a
 * workaround for that uniqueness rule. Source registration/GSTIN stays unchanged. */
export async function createSecondSeriesProperty(deploy: SQL, first: Awaited<ReturnType<typeof createSeriesFixture>>) {
  const property = crypto.randomUUID(); const supplier = crypto.randomUUID(); const statusId = crypto.randomUUID();
  const { input, roleId } = first;
  await deploy.begin(async tx => {
    const properties = await tx<{ id: string }[]>`INSERT INTO public.org_node(id,tenant_id,path,kind,name,timezone,currency)
      SELECT ${property}::uuid,tenant_id,subpath(path,0,nlevel(path)-1) || ${`series453${property.replaceAll("-", "")}`}::ltree,
        'property','Order453 second property',timezone,currency FROM public.org_node
      WHERE tenant_id=${input.tenant}::uuid AND id=${input.property}::uuid RETURNING id::text`;
    if (properties.length !== 1) throw new Error("Order453 second property source missing");
    await tx`INSERT INTO public.user_role(tenant_id,user_id,role_id,scope_node)
      VALUES(${input.tenant}::uuid,${input.actor}::uuid,${roleId}::uuid,${property}::uuid)`;
    const registrations = await tx<{ id: string }[]>`INSERT INTO public.property_fiscal_registration(
      tenant_id,id,property_node,scheme,currency,jurisdiction_extension_id,jurisdiction_owner_tenant_id,
      jurisdiction_key,jurisdiction_version,jurisdiction_content_hash,registration_number,region_code,
      legal_name,trade_name,address_line,locality,postal_code)
      SELECT tenant_id,${supplier}::uuid,${property}::uuid,scheme,currency,jurisdiction_extension_id,jurisdiction_owner_tenant_id,
        jurisdiction_key,jurisdiction_version,jurisdiction_content_hash,registration_number,region_code,
        legal_name,trade_name,address_line,locality,postal_code FROM public.property_fiscal_registration
      WHERE tenant_id=${input.tenant}::uuid AND id=${input.supplier}::uuid RETURNING id::text`;
    if (registrations.length !== 1) throw new Error("Order453 second registration source missing");
    // Same canonical supplier evidence hash construction as0082, with the new
    // registration/property identity. Never reuse the original supplier's hash.
    const statuses = await tx<{ id: string }[]>`INSERT INTO public.india_gst_supplier_registration_status_snapshot(
      tenant_id,id,supplier_registration_id,supplier_registration_evidence_hash,status_as_of,
      gst_registration_status,gst_taxpayer_type,gst_status_source,gst_status_evidence_sha256,legal_rule)
      SELECT r.tenant_id,${statusId}::uuid,r.id,public.india_native_source_hash(jsonb_build_object(
        'registrationId',r.id,'tenantId',r.tenant_id,'propertyNode',r.property_node,'scheme',r.scheme,'currency',r.currency,
        'jurisdiction',jsonb_build_object('extensionId',r.jurisdiction_extension_id,'ownerTenantId',r.jurisdiction_owner_tenant_id,
          'key',r.jurisdiction_key,'version',r.jurisdiction_version::text,'contentHash',r.jurisdiction_content_hash),
        'gstin',r.registration_number,'stateCode',r.region_code,'legalName',r.legal_name,'tradeName',r.trade_name,
        'addressLine',r.address_line,'locality',r.locality,'postalCode',r.postal_code)),
        s.status_as_of,s.gst_registration_status,s.gst_taxpayer_type,s.gst_status_source,s.gst_status_evidence_sha256,s.legal_rule
      FROM public.property_fiscal_registration r JOIN public.org_node p ON p.tenant_id=r.tenant_id AND p.id=r.property_node
      JOIN public.india_gst_supplier_registration_status_snapshot s ON s.tenant_id=r.tenant_id
        AND s.supplier_registration_id=${input.supplier}::uuid
        AND s.status_as_of=(transaction_timestamp() AT TIME ZONE p.timezone)::date AND s.gst_registration_status='active'
      WHERE r.tenant_id=${input.tenant}::uuid AND r.id=${supplier}::uuid RETURNING id::text`;
    if (statuses.length !== 1) throw new Error("Order453 current supplier status source missing or ambiguous");
  });
  return { input: { ...input, property, supplier }, statusId };
}

/** An unused prior-FY series is fixture history, not a backdated command or fake
 * issued document. The current clock is never changed. No event is fabricated. */
export async function createPriorYearSeries(deploy: SQL, first: Awaited<ReturnType<typeof createSeriesFixture>>) {
  const id = crypto.randomUUID(); const { input } = first;
  const rows = await deploy<{ id: string; financial_year_start: string }[]>`INSERT INTO public.document_series(
    tenant_id,id,property_node,kind,prefix,next_no,fiscal,supplier_registration_id,financial_year_start)
    VALUES(${input.tenant}::uuid,${id}::uuid,${input.property}::uuid,${input.kind},'PRIOR453/',1,true,${input.supplier}::uuid,
      make_date(extract(year FROM ${first.candidate.series.financialYearStart}::date)::int-1,4,1))
    RETURNING id::text,financial_year_start::text`;
  if (rows.length !== 1 || !rows[0]) throw new Error("Order453 prior FY fixture missing");
  return rows[0];
}
export async function seriesRows(deploy: SQL): Promise<Record<string, string[]>> {
  const tables = await deploy<{ name: string }[]>`SELECT relname name FROM pg_catalog.pg_class
    WHERE relnamespace='public'::regnamespace AND relkind='r' ORDER BY relname`;
  const snapshot: Record<string, string[]> = {};
  for (const { name } of tables) {
    if (!/^[a-z0-9_]+$/.test(name)) throw new Error("Unexpected table identifier");
    const rows = await deploy.unsafe<{ body: string }[]>(`SELECT to_jsonb(r)::text body FROM public."${name}" r ORDER BY to_jsonb(r)::text COLLATE "C"`);
    snapshot[name] = rows.map(row => row.body);
  }
  return snapshot;
}
