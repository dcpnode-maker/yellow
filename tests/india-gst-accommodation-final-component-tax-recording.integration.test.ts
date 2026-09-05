import { afterAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import {
  deriveIndiaGstAccommodationComponentFamily,
  deriveIndiaGstAccommodationLevyComponentIdentity,
  deriveIndiaGstAccommodationLevyInputBundle,
  deriveIndiaGstAccommodationRateChangeDate,
  deriveIndiaGstSection14PaymentReceiptDate,
  deriveIndiaGstSection14WorkingDayCalendarEvidence,
  IndiaGstAccommodationFinalComponentTaxRecorderService,
  IndiaGstAccommodationFinalComponentTaxRecordingValidationError,
  IndiaGstAccommodationQuotedRateApplicabilityService,
  IndiaGstSection14RateSelectionService,
  resolveIndiaGstSection14PaymentProviso,
} from "../src/contexts/tax-fiscal";
import { PostgresIdempotency } from "../src/kernel";
import {
  ATTRIBUTION, fixture, FOLIO, HOLD, LINEAGE, PROPERTY, RESERVATION,
  SEGMENT, SELLABLE, TENANT,
} from "./india-gst-accommodation-quoted-rate-applicability.test";

const migrationFile = Bun.file(new URL(
  "../migrations/0070_india_gst_accommodation_final_component_tax.sql",
  import.meta.url,
));
const recorderFile = Bun.file(new URL(
  "../src/contexts/tax-fiscal/india-gst-accommodation-final-component-tax-recorder.ts",
  import.meta.url,
));
const indexFile = Bun.file(new URL(
  "../src/contexts/tax-fiscal/index.ts",
  import.meta.url,
));

const ROOT = "india_gst_accommodation_final_component_tax";
const NIGHT = "india_gst_accommodation_final_component_tax_room_night";
const COMPONENT = "india_gst_accommodation_final_component_tax_component";
const CAPABILITY = "record_india_gst_accommodation_final_component_tax";
const EVENT = "india_gst.accommodation_final_component_tax_recorded";
const OPERATION = "tax-fiscal.india-accommodation-final-component-tax.record";
const TABLES = [ROOT, NIGHT, COMPONENT] as const;
const uuid = (suffix: number) => `00000000-0000-0000-0000-${String(suffix).padStart(12, "0")}`;

function deepFreeze<T>(value: T, seen = new Set<object>()): T {
  if (value !== null && typeof value === "object" && !seen.has(value as object)) {
    seen.add(value as object);
    for (const key of Reflect.ownKeys(value as object)) deepFreeze(Reflect.get(value as object, key), seen);
    Object.freeze(value);
  }
  return value;
}

function compact(sql: string): string {
  return sql.replace(/--[^\r\n]*/g, " ").replace(/\s+/g, " ").trim();
}

function postgresArray(values: readonly (string | number | bigint | boolean | null)[]): string {
  return `{${values.map((value) => value === null
    ? "NULL"
    : `"${String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`).join(",")}}`;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}

function canonicalHash(value: unknown): string {
  return new Bun.CryptoHasher("sha256").update(canonicalJson(value)).digest("hex");
}

function insertionHash(value: unknown): string {
  return new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");
}

describe("Order 367 migration and recorder contract", () => {
  test("rejects forged, mutable, mismatched-envelope and incomplete correction inputs before SQL", async () => {
    const tenantId = uuid(367001), propertyNode = uuid(367002);
    const reservationId = uuid(367003), folioId = uuid(367004);
    const actorId = uuid(367005), requestId = uuid(367006);
    const validShape = {
      tenantId, propertyNode, reservationId, folioId,
      applicabilityId: uuid(367009),
      quotedRateApplicabilityInput: {
        tenantId, propertyNode, reservationId, folioId,
      },
      expectedCurrentTaxId: null,
      expectedCurrentEvidenceHash: null,
      idempotencyKey: "order367-validation-proof",
      envelope: {
        tenantId, propertyNode, actorId, requestId,
        operation: EVENT,
      },
    };
    let queried = false;
    const tx = (async () => { queried = true; return []; }) as never;
    const service = new IndiaGstAccommodationFinalComponentTaxRecorderService({ idempotency: {} as never });
    await expect(service.record(tx, validShape as never)).rejects.toBeInstanceOf(
      IndiaGstAccommodationFinalComponentTaxRecordingValidationError,
    );
    expect(queried).toBeFalse();

    const cases = [
      deepFreeze({ ...validShape, taxMinor: "1" }),
      deepFreeze(Object.fromEntries(Object.entries(validShape)
        .filter(([key]) => key !== "applicabilityId"))),
      deepFreeze({ ...validShape, applicabilityId: "not-an-applicability-id" }),
      deepFreeze({ ...validShape, envelope: { ...validShape.envelope, operation: "journal.posted" } }),
      deepFreeze({ ...validShape, expectedCurrentTaxId: uuid(367007) }),
      deepFreeze({
        ...validShape,
        quotedRateApplicabilityInput: {
          ...validShape.quotedRateApplicabilityInput,
          folioId: uuid(367008),
        },
      }),
    ];
    for (const candidate of cases) {
      queried = false;
      await expect(service.record(tx, candidate as never)).rejects.toBeInstanceOf(
        IndiaGstAccommodationFinalComponentTaxRecordingValidationError,
      );
      expect(queried).toBeFalse();
    }
  });

  test("uses only forward migration 0070 and the exact three-table persisted bundle", async () => {
    expect(await migrationFile.exists()).toBeTrue();
    const sql = compact(await migrationFile.text());
    for (const table of TABLES) {
      expect(sql).toContain(`CREATE TABLE public.${table}`);
      expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      expect(sql).toContain(`ALTER TABLE public.${table} FORCE ROW LEVEL SECURITY`);
      expect(sql).toContain(`CREATE POLICY tenant_isolation ON public.${table}`);
      expect(sql).toContain(`GRANT SELECT ON public.${table} TO app_role`);
    }
    expect(sql.match(/CREATE TABLE public\./g)).toHaveLength(3);
    expect(sql).not.toMatch(/CREATE\s+(?:OR\s+REPLACE\s+)?VIEW/i);
    expect(sql).not.toMatch(/ALTER\s+TABLE\s+public\.[a-z0-9_]+\s+DISABLE\s+ROW\s+LEVEL\s+SECURITY/i);
  });

  test("keeps authoritative money typed and immutable rather than JSONB", async () => {
    const sql = compact(await migrationFile.text());
    expect(sql).toMatch(/transaction_value_minor bigint/i);
    expect(sql).toMatch(/applicability_id uuid NOT NULL/i);
    expect(sql).toMatch(/tax_minor bigint/i);
    expect(sql).toMatch(/grand_total_minor bigint/i);
    expect(sql).toMatch(/final_value_minor bigint/i);
    expect(sql).toMatch(/tax_amount_minor bigint/i);
    expect(sql).toMatch(/rate_basis_points integer/i);
    expect(sql).not.toMatch(/(?:transaction_value_minor|tax_minor|grand_total_minor|final_value_minor|tax_amount_minor)[^,)]*jsonb/i);
    expect(sql).not.toMatch(/GRANT (?:INSERT|UPDATE|DELETE)[^;]* TO (?:PUBLIC|app_role|yellow_runtime)/i);
    expect(sql).not.toMatch(/UPDATE public\.india_gst_accommodation_final_component_tax/i);
    expect(sql).not.toMatch(/DELETE FROM public\.india_gst_accommodation_final_component_tax/i);
  });

  test("defines one fixed-search-path owner-mediated writer with narrow execution grants", async () => {
    const sql = compact(await migrationFile.text());
    expect(sql).toContain(`CREATE FUNCTION public.${CAPABILITY}`);
    expect(sql).toMatch(new RegExp(`CREATE FUNCTION public\\.${CAPABILITY}[\\s\\S]*SECURITY DEFINER`, "i"));
    expect(sql).toMatch(new RegExp(`CREATE FUNCTION public\\.${CAPABILITY}[\\s\\S]*SET search_path = pg_catalog, public`, "i"));
    expect(sql).toMatch(new RegExp(`ALTER FUNCTION public\\.${CAPABILITY}[\\s\\S]*OWNER TO yellow_owner`, "i"));
    expect(sql).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${CAPABILITY}[\\s\\S]*FROM PUBLIC`, "i"));
    expect(sql).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${CAPABILITY}[\\s\\S]*FROM yellow_runtime`, "i"));
    expect(sql).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${CAPABILITY}[\\s\\S]*TO app_role`, "i"));
    expect(sql).toMatch(/p_tenant uuid\s*,\s*p_property uuid\s*,\s*p_reservation uuid\s*,\s*p_folio uuid\s*,\s*p_applicability uuid\s*,\s*p_request uuid\s*,\s*p_actor uuid\s*,\s*p_expected_tax uuid\s*,\s*p_expected_tax_hash text/i);
  });

  test("binds the existing fiscal actor authority and current valuation ancestry", async () => {
    const sql = compact(await migrationFile.text());
    expect(sql).toContain("tax-fiscal.india-valuation:finalize");
    expect(sql).toMatch(/app_user/i);
    expect(sql).toMatch(/user_role/i);
    expect(sql).toMatch(/role_permission/i);
    expect(sql).toMatch(/scope_node/i);
    expect(sql).toMatch(/india_gst_accommodation_final_valuation/i);
    expect(sql).toMatch(/supersedes_valuation_id/i);
    expect(sql).toMatch(/ordinary_final/i);
    expect(sql).toMatch(/FOR UPDATE/i);
  });

  test("commits only the bundle plus minimized fact/outbox evidence", async () => {
    const sql = compact(await migrationFile.text());
    expect(sql).toContain(`INSERT INTO public.${ROOT}`);
    expect(sql).toContain(`INSERT INTO public.${NIGHT}`);
    expect(sql).toContain(`INSERT INTO public.${COMPONENT}`);
    expect(sql).toContain("INSERT INTO public.fact_log");
    expect(sql).toContain("INSERT INTO public.outbox");
    expect(sql).toContain(EVENT);
    expect(sql).not.toMatch(/INSERT INTO public\.(?:journal|posting_line|document|fiscal_submission)/i);
    expect(sql).not.toMatch(/(?:buyer|invoice|route|account|journal)/i);
  });

  test("exports the exact recorder API and keeps caller tax values out of its input", async () => {
    expect(await recorderFile.exists()).toBeTrue();
    const source = await recorderFile.text();
    const index = await indexFile.text();
    expect(source).toContain("export class IndiaGstAccommodationFinalComponentTaxRecorderService");
    expect(source).toMatch(/async record\s*\(/);
    for (const field of [
      "tenantId", "propertyNode", "reservationId", "folioId",
      "applicabilityId", "quotedRateApplicabilityInput", "expectedCurrentTaxId",
      "expectedCurrentEvidenceHash", "idempotencyKey", "envelope",
    ]) expect(source).toContain(field);
    expect(source).toContain(EVENT);
    expect(source).toContain(OPERATION);
    expect(source).toContain("applicabilityId: applicability");
    expect(compact(source)).toMatch(/record_india_gst_accommodation_final_component_tax\( \$\{tenant\}::uuid, \$\{property\}::uuid, \$\{reservation\}::uuid, \$\{folio\}::uuid, \$\{applicability\}::uuid, \$\{requestId\}::uuid, \$\{actor\}::uuid, \$\{expected\}::uuid, \$\{expectedHash\}/);
    const inputInterface = source.match(
      /export interface IndiaGstAccommodationFinalComponentTaxRecordingInput\s*\{([\s\S]*?)\n\}/,
    )?.[1] ?? "";
    expect(inputInterface).not.toMatch(
      /readonly\s+(?:taxMinor|grandTotalMinor|transactionValueMinor|roomNights|components)\s*:/,
    );
    expect(index).toContain("IndiaGstAccommodationFinalComponentTaxRecorderService");
    expect(index).toContain("IndiaGstAccommodationFinalComponentTaxRecordingInput");
    expect(index).toContain("IndiaGstAccommodationFinalComponentTaxRecordingResult");
  });
});

const databaseUrl = process.env.YELLOW_ORDER367_DATABASE_URL;
const runtimeDatabaseUrl = process.env.YELLOW_ORDER367_RUNTIME_DATABASE_URL;
const databaseRun = databaseUrl && runtimeDatabaseUrl ? describe : describe.skip;

databaseRun("Order 367 fresh PostgreSQL integration", () => {
  const db = new SQL(databaseUrl!, { max: 4 });
  const runtimeDb = new SQL(runtimeDatabaseUrl!, { max: 4 });
  afterAll(async () => { await Promise.all([db.close(), runtimeDb.close()]); });

  test("has the exact released 0075 catalogue frontier", async () => {
    const [actual] = await db<Array<{
      migrations: number; tables: number; rls: number; policies: number;
      forced: number; views: number;
    }>>`
      SELECT
        (SELECT count(*)::int FROM schema_migration) migrations,
        (SELECT count(*)::int FROM pg_tables WHERE schemaname='public') tables,
        (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='public' AND c.relrowsecurity) rls,
        (SELECT count(*)::int FROM pg_policies WHERE schemaname='public') policies,
        (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='public' AND c.relforcerowsecurity) forced,
        (SELECT count(*)::int FROM pg_views WHERE schemaname='public') views
    `;
    expect(actual).toEqual({
      migrations: 77, tables: 127, rls: 117, policies: 117, forced: 26, views: 2,
    });
  });

  test("three tables are tenant-leading, forced-RLS and app-role SELECT-only", async () => {
    const rows = await db<Array<{
      relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean;
      select_ok: boolean; insert_ok: boolean; update_ok: boolean; delete_ok: boolean;
      tenant_leading_indexes: number;
    }>>`
      SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
             has_table_privilege('app_role',c.oid,'SELECT') select_ok,
             has_table_privilege('app_role',c.oid,'INSERT') insert_ok,
             has_table_privilege('app_role',c.oid,'UPDATE') update_ok,
             has_table_privilege('app_role',c.oid,'DELETE') delete_ok,
             (SELECT count(*)::int FROM pg_index i
               WHERE i.indrelid=c.oid
                 AND (SELECT a.attname FROM pg_attribute a
                       WHERE a.attrelid=c.oid AND a.attnum=i.indkey[0])='tenant_id') tenant_leading_indexes
        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public' AND c.relname = ANY(${postgresArray(TABLES)}::text[])
       ORDER BY c.relname
    `;
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row).toMatchObject({
        relrowsecurity: true, relforcerowsecurity: true, select_ok: true,
        insert_ok: false, update_ok: false, delete_ok: false,
      });
      expect(row.tenant_leading_indexes).toBeGreaterThan(0);
    }
  });

  test("the sole writer is owner-mediated and unavailable to runtime/PUBLIC", async () => {
    const [actual] = await db<Array<{
      owner: string; definer: boolean; config: string[];
      app: boolean; runtime: boolean; everyone: boolean; arguments: number;
    }>>`
      SELECT pg_get_userbyid(p.proowner) owner, p.prosecdef definer, p.proconfig config,
             has_function_privilege('app_role',p.oid,'EXECUTE') app,
             has_function_privilege('yellow_runtime',p.oid,'EXECUTE') runtime,
             has_function_privilege('public',p.oid,'EXECUTE') everyone,
             p.pronargs::int arguments
        FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public' AND p.proname=${CAPABILITY}
    `;
    expect(actual).toMatchObject({
      owner: "yellow_owner", definer: true,
      config: ["search_path=pg_catalog, public"],
      app: true, runtime: false, everyone: false, arguments: 9,
    });
  });

  test("root and child constraints encode one head, dense children and typed component families", async () => {
    const definitions = await db<Array<{ name: string; definition: string }>>`
      SELECT conname name, pg_get_constraintdef(oid) definition
        FROM pg_constraint
       WHERE conrelid = ANY(${postgresArray(TABLES)}::text[]::regclass[])
       ORDER BY conname
    `;
    const all = definitions.map((row) => `${row.name} ${row.definition}`).join("\n");
    expect(all).toMatch(/supersedes_tax_id/i);
    expect(all).toMatch(/UNIQUE.*supersedes_tax_id/i);
    expect(all).toMatch(/ordinal/i);
    expect(all).toMatch(/business_date/i);
    expect(all).toMatch(/igst/i);
    expect(all).toMatch(/cgst/i);
    expect(all).toMatch(/sgst/i);
    expect(all).toMatch(/utgst/i);
    expect(all).toMatch(/rate_basis_points/i);
  });

  test("records, replays and corrects one exact immutable component-tax bundle atomically", async () => {
    let connection = await db.reserve();
    let held = true;
    const h = (character: string) => character.repeat(64);
    const actor = uuid(367101), valuation = uuid(367102), nextValuation = uuid(367103);
    const account = uuid(367104), buyer = uuid(367105), unitType = uuid(367106);
    const ratePlan = uuid(367107), role = uuid(367108);
    const built = await fixture("cgst_sgst", "2025-09-21", "2025-09-23", "2025-09-24", "2025-09-24", [700000n, 800000n]);
    const predecessorContent = {
      country: "IN", price_display: "tax_exclusive", rounding: "document", taxes: [
        { code: "GST_ROOM", name: "GST on accommodation", mode: "slab_percent", slab_basis: "transaction_value", applies_to: ["room_revenue"], slabs: [{ upto_minor: 750000, rate: 0.12, itc_eligible: true }, { upto_minor: null, rate: 0.18, itc_eligible: true }] },
        { code: "GST_FNB", name: "GST on F&B (restaurant in hotel)", mode: "percent", rate: 0.05, applies_to: ["fnb_revenue"] },
      ],
    };
    const successorContent = {
      country: "IN", price_display: "tax_exclusive", rounding: "document", taxes: [
        { code: "GST_ROOM", name: "GST on accommodation", mode: "slab_percent", slab_basis: "transaction_value", applies_to: ["room_revenue"], slabs: [{ upto_minor: 750000, rate: 0.05, itc_eligible: false }, { upto_minor: null, rate: 0.18, itc_eligible: true }] },
        { code: "GST_FNB", name: "GST on F&B (restaurant in hotel)", mode: "percent", rate: 0.05, applies_to: ["fnb_revenue"] },
      ],
    };
    const predecessorHash = "2160e1747afcb3c280f1fd66e55534a5be563a10f277e8fcc178324e51abaa08";
    const successorHash = "eb323eff707aad1e460b425c87b448d4e924d2eb17499094abad71b33c69a820";
    const pairBody = {
      propertyNode: PROPERTY,
      predecessor: { extensionId: "a806f516-fed6-5768-b310-94aa03286adb", key: "in-gst-lodging", version: 1, status: "retired", effectiveFromInstant: "2022-07-17T18:30:00.000000Z", effectiveToInstant: "2025-09-21T18:30:00.000000Z", content: predecessorContent, contentHash: predecessorHash, gstRoomSlabs: [{ uptoMinor: 750000, rate: 0.12, itcEligible: true }, { uptoMinor: null, rate: 0.18, itcEligible: true }] },
      successor: { extensionId: "0b21daf2-ea6e-5568-9c21-69e4d4424574", key: "in-gst-lodging", version: 2, status: "active", effectiveFromInstant: "2025-09-21T18:30:00.000000Z", effectiveToInstant: null, content: successorContent, contentHash: successorHash, gstRoomSlabs: [{ uptoMinor: 750000, rate: 0.05, itcEligible: false }, { uptoMinor: null, rate: 0.18, itcEligible: true }] },
      cutoverInstant: "2025-09-21T18:30:00.000000Z",
      statutoryLowerBandDelta: { thresholdMinor: 750000, predecessorRate: 0.12, predecessorItcEligible: true, successorRate: 0.05, successorItcEligible: false, predecessorHasNilBand: false, successorHasNilBand: false },
      sourceHashes: { notification20_2019: "ee920c82c30ed88d9bb515d7d79b975cc2ed599c6dad411d04d8b7fcd5a86901", notification04_2022: "c6d264f1906375e93466dd97b2c60bb9b21c0dec34b93900b15237b4a98b7716", notification15_2025: "46c9447579017d8bf1fefd75b6e6a48856dab7b23e44c7e06babfdc99ae9d289" },
    } as const;
    const rateVersionPair = {
      ...pairBody,
      evidenceHash: canonicalHash({
        tenantId: TENANT, predecessorOwnerTenantId: null,
        successorOwnerTenantId: null, ...pairBody,
      }),
    };
    let canonicalInput = JSON.parse(JSON.stringify(built.input)) as any;
    canonicalInput.section14Input.rateVersionPair = rateVersionPair;
    canonicalInput.section14Input.rateChangeDateEvidence = deriveIndiaGstAccommodationRateChangeDate({
      tenantId: TENANT, rateVersionPair,
    } as never);
    const calendarInput = canonicalInput.section14Input.paymentEvidence;
    if (calendarInput.kind !== "calendar_governed_receipt") {
      throw new Error("Order367 requires calendar-governed applicability evidence");
    }
    const paymentProvisoEvidence = resolveIndiaGstSection14PaymentProviso({
      supplierBooksEntryDate: built.rows.payment.supplier_books_entry_date,
      supplierBankCreditDate: built.rows.payment.supplier_bank_credit_date,
      rateChangeDate: canonicalInput.section14Input.rateChangeDateEvidence.rateChangeDate,
    });
    const calendarEvidence = deepFreeze(calendarInput.calendarEvidence);
    const workingDayEvidence = deriveIndiaGstSection14WorkingDayCalendarEvidence({
      tenantId: TENANT,
      rateChangeDate: canonicalInput.section14Input.rateChangeDateEvidence.rateChangeDate,
      throughDate: calendarInput.throughDate,
      calendarEvidence,
    } as never);
    canonicalInput.section14Input.paymentEvidence = {
      kind: "calendar_governed_receipt", paymentProvisoEvidence,
      throughDate: calendarInput.throughDate, calendarEvidence, workingDayEvidence,
      paymentReceiptEvidence: deriveIndiaGstSection14PaymentReceiptDate({
        tenantId: TENANT, rateVersionPair,
        rateChangeDateEvidence: canonicalInput.section14Input.rateChangeDateEvidence,
        supplierBooksEntryDate: built.rows.payment.supplier_books_entry_date,
        supplierBankCreditDate: built.rows.payment.supplier_bank_credit_date,
        paymentProvisoEvidence, throughDate: calendarInput.throughDate,
        calendarEvidence, workingDayEvidence,
      } as never),
    };
    const historical = canonicalInput.componentIdentityInput.historicalResolution;
    historical.rateVersionPair = rateVersionPair;
    historical.selectedExtension = rateVersionPair.predecessor;
    const { evidenceHash: ignoredHistoricalHash, ...historicalBody } = historical;
    void ignoredHistoricalHash;
    historical.evidenceHash = canonicalHash({ tenantId: TENANT, ...historicalBody });
    const oldSupplyNature = canonicalInput.componentIdentityInput.supplyNature;
    const { candidateJson: ignoredCandidateJson, candidateHash: ignoredCandidateHash, ...supplyBody } = oldSupplyNature;
    void ignoredCandidateJson; void ignoredCandidateHash;
    supplyBody.jurisdiction = { ...supplyBody.jurisdiction, contentHash: predecessorHash };
    const supplyNature = deepFreeze({
      ...supplyBody,
      candidateJson: JSON.stringify(supplyBody),
      candidateHash: insertionHash({ tenantId: TENANT, candidate: supplyBody }),
    });
    const componentFamily = deriveIndiaGstAccommodationComponentFamily({
      tenantId: TENANT, supplyNature,
    } as never);
    const componentIdentityInput = {
      tenantId: TENANT, historicalResolution: deepFreeze(historical), supplyNature, componentFamily,
      levyInputBundle: deriveIndiaGstAccommodationLevyInputBundle({
        tenantId: TENANT, historicalResolution: deepFreeze(historical), supplyNature, componentFamily,
      } as never),
    };
    canonicalInput.componentIdentityInput = deepFreeze(componentIdentityInput);
    canonicalInput.componentIdentityResult = deriveIndiaGstAccommodationLevyComponentIdentity(
      canonicalInput.componentIdentityInput as never,
    );
    const resolverQuery = (async (strings: TemplateStringsArray) => {
      const sql = strings.join("?");
      if (sql.includes("tax_attribution_hold_binding")) return [built.rows.persisted];
      if (sql.includes("payment_receipt_snapshot")) return [built.rows.payment];
      if (sql.includes("invoice_issue_snapshot")) return [built.rows.invoice];
      if (sql.includes("service_provision_snapshot")) return [built.rows.service];
      throw new Error(`unexpected Order367 resolver SQL: ${sql}`);
    }) as never;
    canonicalInput.section14Input = deepFreeze(canonicalInput.section14Input);
    canonicalInput.section14Result = await new IndiaGstSection14RateSelectionService()
      .resolve(resolverQuery, canonicalInput.section14Input);
    canonicalInput = deepFreeze(JSON.parse(JSON.stringify(canonicalInput)));
    const rows = built.rows as Record<string, any>;
    let open = false;
    let parkedRuntime: typeof connection | null = null;
    try {
      await connection.unsafe("BEGIN"); open = true;
      await connection`SELECT set_config('app.tenant_id',${TENANT},true)`;
      await connection.unsafe("SET LOCAL session_replication_role=replica; SET LOCAL ROLE yellow_owner");
      await connection`INSERT INTO tenant(id,slug,name) VALUES(${TENANT}::uuid,'order367','Order367')`;
      await connection`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES(${PROPERTY}::uuid,${TENANT}::uuid,'order367'::ltree,'property','Order367','Asia/Kolkata','INR')`;
      await connection`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES(${actor}::uuid,${TENANT}::uuid,'order367@example.test','Order367 actor','active')`;
      await connection`INSERT INTO extension_type(type,json_schema) VALUES('tax_jurisdiction','{"type":"object"}'::jsonb)`;
      await connection`INSERT INTO extension(id,tenant_id,type,key,version,effective,content,status) VALUES
        ('a806f516-fed6-5768-b310-94aa03286adb',NULL,'tax_jurisdiction','in-gst-lodging',1,
          tstzrange('2022-07-17T18:30:00Z','2025-09-21T18:30:00Z','[)'),${predecessorContent}::jsonb,'retired'),
        ('0b21daf2-ea6e-5568-9c21-69e4d4424574',NULL,'tax_jurisdiction','in-gst-lodging',2,
          tstzrange('2025-09-21T18:30:00Z',NULL,'[)'),${successorContent}::jsonb,'active')`;
      await connection`INSERT INTO permission(code,description) VALUES('tax-fiscal.india-valuation:finalize','Finalize governed India accommodation valuation') ON CONFLICT DO NOTHING`;
      await connection`INSERT INTO role(id,tenant_id,name) VALUES(${role}::uuid,${TENANT}::uuid,'Order367 fiscal actor')`;
      await connection`INSERT INTO role_permission(role_id,permission_code) VALUES(${role}::uuid,'tax-fiscal.india-valuation:finalize')`;
      await connection`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node) VALUES(${TENANT}::uuid,${actor}::uuid,${role}::uuid,${PROPERTY}::uuid)`;
      await connection`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES(${buyer}::uuid,${TENANT}::uuid,'person','Order367 buyer','active')`;
      await connection`INSERT INTO unit_type(id,tenant_id,property_node,code,name,profile_key,max_occupancy) VALUES(${unitType}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O367','Order367 room','hotel',2)`;
      await connection`INSERT INTO sellable_unit(id,tenant_id,unit_type_id,name,status) VALUES(${SELLABLE}::uuid,${TENANT}::uuid,${unitType}::uuid,'Order367 room 1','active')`;
      await connection`INSERT INTO rate_plan(id,tenant_id,property_node,code,name,currency,tax_inclusive,status) VALUES(${ratePlan}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O367','Order367 rate','INR',false,'active')`;
      await connection`INSERT INTO reservation(id,tenant_id,property_node,confirmation_no,status,primary_party,currency) VALUES(${RESERVATION}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O367','reserved',${buyer}::uuid,'INR')`;
      await connection`INSERT INTO reservation_segment(id,tenant_id,reservation_id,seq,unit_type_id,sellable_unit_id,period,adults,children,rate_plan_id,status) VALUES(${SEGMENT}::uuid,${TENANT}::uuid,${RESERVATION}::uuid,1,${unitType}::uuid,${SELLABLE}::uuid,${rows.persisted.segment_period}::tstzrange,1,'[]'::jsonb,${ratePlan}::uuid,'booked')`;
      await connection`INSERT INTO hold(id,tenant_id,property_node,sellable_unit_id,period,kind,holder,expires_at,status) VALUES(${HOLD}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,${SELLABLE}::uuid,${rows.persisted.hold_period}::tstzrange,'cart','{}'::jsonb,'2030-01-01','consumed')`;
      await connection`INSERT INTO account(id,tenant_id,property_node,role,party_id,name,currency,status) VALUES(${account}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'guest',${buyer}::uuid,'Order367 guest','INR','open')`;
      await connection`INSERT INTO folio(id,tenant_id,account_id,reservation_id,window_no,status) VALUES(${FOLIO}::uuid,${TENANT}::uuid,${account}::uuid,${RESERVATION}::uuid,1,'open')`;
      await connection`INSERT INTO tax_attribution_snapshot(tenant_id,id,property_node,actor_id,schema_version,origin_kind,origin_quote_hash,snapshot_hash,currency,snapshot) VALUES(${TENANT}::uuid,${ATTRIBUTION}::uuid,${PROPERTY}::uuid,${actor}::uuid,1,'rate_quote',${rows.persisted.origin_quote_hash},${rows.persisted.snapshot_hash},'INR',${rows.attribution}::jsonb)`;
      await connection`INSERT INTO tax_attribution_hold_binding(tenant_id,id,property_node,bound_by,hold_id,attribution_id,sellable_unit_id,period,origin_quote_hash,snapshot_hash,currency) VALUES(${TENANT}::uuid,${HOLD}::uuid,${PROPERTY}::uuid,${actor}::uuid,${HOLD}::uuid,${ATTRIBUTION}::uuid,${SELLABLE}::uuid,${rows.persisted.binding_period}::tstzrange,${rows.persisted.origin_quote_hash},${rows.persisted.snapshot_hash},'INR')`;
      await connection`INSERT INTO tax_attribution_reservation_binding(tenant_id,id,property_node,linked_by,binding_id,hold_id,attribution_id,reservation_id,segment_id,sellable_unit_id,period,origin_quote_hash,snapshot_hash,currency) VALUES(${TENANT}::uuid,${LINEAGE}::uuid,${PROPERTY}::uuid,${actor}::uuid,${HOLD}::uuid,${HOLD}::uuid,${ATTRIBUTION}::uuid,${RESERVATION}::uuid,${SEGMENT}::uuid,${SELLABLE}::uuid,${rows.persisted.lineage_period}::tstzrange,${rows.persisted.origin_quote_hash},${rows.persisted.snapshot_hash},'INR')`;
      const serviceSnapshot = rows.service, payment = rows.payment, invoice = rows.invoice;
      await connection`INSERT INTO india_gst_accommodation_service_provision_snapshot(tenant_id,id,property_node,reservation_lineage_id,hold_binding_id,attribution_id,reservation_id,segment_id,origin_quote_hash,snapshot_hash,currency,service_provision_date,service_provision_source,service_provision_evidence_sha256,legal_rule) VALUES(${TENANT}::uuid,${serviceSnapshot.id}::uuid,${PROPERTY}::uuid,${LINEAGE}::uuid,${HOLD}::uuid,${ATTRIBUTION}::uuid,${RESERVATION}::uuid,${SEGMENT}::uuid,${serviceSnapshot.origin_quote_hash},${serviceSnapshot.snapshot_hash},'INR',${serviceSnapshot.service_provision_date}::date,${serviceSnapshot.service_provision_source},${serviceSnapshot.service_provision_evidence_sha256},${serviceSnapshot.legal_rule})`;
      await connection`INSERT INTO india_gst_accommodation_payment_receipt_snapshot(tenant_id,id,service_provision_snapshot_id,currency,amount_minor,coverage_scope,supplier_books_entry_date,supplier_bank_credit_date,payment_receipt_date,payment_receipt_source,payment_receipt_evidence_sha256,legal_rule) VALUES(${TENANT}::uuid,${payment.id}::uuid,${serviceSnapshot.id}::uuid,'INR',${payment.amount_minor},${payment.coverage_scope},${payment.supplier_books_entry_date}::date,${payment.supplier_bank_credit_date}::date,${payment.payment_receipt_date}::date,${payment.payment_receipt_source},${payment.payment_receipt_evidence_sha256},${payment.legal_rule})`;
      await connection`INSERT INTO india_gst_accommodation_invoice_issue_snapshot(tenant_id,id,service_provision_snapshot_id,currency,amount_minor,coverage_scope,invoice_series,invoice_serial,invoice_issue_date,invoice_issue_source,invoice_issue_evidence_sha256,legal_rule) VALUES(${TENANT}::uuid,${invoice.id}::uuid,${serviceSnapshot.id}::uuid,'INR',${invoice.amount_minor},${invoice.coverage_scope},${invoice.invoice_series},${invoice.invoice_serial},${invoice.invoice_issue_date}::date,${invoice.invoice_issue_source},${invoice.invoice_issue_evidence_sha256},${invoice.legal_rule})`;
      await connection.unsafe("RESET ROLE; SET LOCAL session_replication_role=origin");
      await connection`SELECT set_config('app.tenant_id',${TENANT},true)`;
      await connection.unsafe("SET LOCAL ROLE app_role");
      const resolvedApplicability = await new IndiaGstAccommodationQuotedRateApplicabilityService()
        .resolve(connection, canonicalInput);
      const order341Hash = resolvedApplicability.evidenceHash;
      await connection.unsafe("RESET ROLE; SET LOCAL session_replication_role=replica; SET LOCAL ROLE yellow_owner");
      const valuationChain = [uuid(367121), uuid(367122), uuid(367123), valuation];
      for (const [valuationGeneration, valuationId] of valuationChain.entries()) {
        const predecessorValuationId = valuationGeneration === 0
          ? null : valuationChain[valuationGeneration - 1]!;
        await connection`INSERT INTO india_gst_accommodation_final_valuation(
          tenant_id,id,property_node,reservation_id,folio_id,folio_account_id,window_no,buyer_party_id,
          attribution_id,request_id,generation,disposition,currency,transaction_value_minor,source_set_hash,
          order341_evidence_hash,request_hash,evidence_hash,ordinary_evidence_hashes,manual_reasons,
          relationship_conclusion,consideration_conclusion,section15_2_conclusion,section15_3_conclusion,
          source_completeness_conclusion,attestation_evidence_source,attestation_evidence_reference,
          relationship_set_hash,attested_by,supersedes_valuation_id,actor_id
        ) VALUES(
          ${TENANT}::uuid,${valuationId}::uuid,${PROPERTY}::uuid,${RESERVATION}::uuid,${FOLIO}::uuid,
          ${account}::uuid,1,${buyer}::uuid,${ATTRIBUTION}::uuid,${uuid(367124 + valuationGeneration)}::uuid,
          ${valuationGeneration},'ordinary_final','INR',1500000,${insertionHash(`source-${valuationGeneration}`)},
          ${order341Hash},${insertionHash(`request-${valuationGeneration}`)},
          ${insertionHash(`valuation-${valuationGeneration}`)},
          ARRAY[${h("6")},${h("7")},${h("8")},${h("9")},${h("a")}],ARRAY[]::text[],
          'unrelated_not_distinct','money_only','all_additions_enumerated','all_discounts_eligible',
          'all_sources_classified','operator_attestation','ORDER367',${h("b")},${actor}::uuid,
          ${predecessorValuationId}::uuid,${actor}::uuid
        )`;
      }
      await connection`INSERT INTO india_gst_accommodation_valuation_room_night(tenant_id,valuation_id,ordinal,business_date,quoted_weight_minor,transaction_value_minor,currency) VALUES(${TENANT}::uuid,${valuation}::uuid,0,'2025-09-21',700000,700000,'INR'),(${TENANT}::uuid,${valuation}::uuid,1,'2025-09-22',800000,800000,'INR')`;
      const applicabilityId = uuid(367114);
      const applicabilityRequestId = uuid(367115);
      const foreignTenant = uuid(367116);
      const foreignApplicabilityId = uuid(367117);
      const selectedVersion = resolvedApplicability.section14.selectedVersion;
      const section14 = canonicalInput.section14Result;
      const applicabilitySupply = canonicalInput.componentIdentityInput.supplyNature;
      const paymentEvidence = canonicalInput.section14Input.paymentEvidence;
      const calendar = paymentEvidence.kind === "calendar_governed_receipt"
        ? paymentEvidence : null;
      await connection`INSERT INTO india_gst_accommodation_quoted_rate_applicability(
        tenant_id,id,property_node,reservation_id,folio_id,reservation_lineage_id,attribution_id,
        service_provision_snapshot_id,payment_receipt_snapshot_id,invoice_issue_snapshot_id,
        family_jurisdiction_extension_id,classification_id,supplier_service_location_id,
        supplier_sez_status_id,recipient_sez_status_id,recipient_party_id,final_valuation_id,request_id,
        section14_case,service_provision_date,invoice_issue_date,payment_receipt_date,rate_change_date,
        time_of_supply_date,selected_version_side,selected_extension_id,selected_extension_version,
        selected_extension_status,selected_content_hash,selected_effective_from,selected_effective_to,
        component_family,section14_evidence_hash,levy_component_identity_evidence_hash,
        reservation_lineage_evidence_hash,attribution_snapshot_evidence_hash,evidence_hash,
        calendar_authority_id,calendar_source_digest_sha256,calendar_through_date,calendar_dates,
        calendar_states,actor_id
      ) VALUES(
        ${TENANT}::uuid,${applicabilityId}::uuid,${PROPERTY}::uuid,${RESERVATION}::uuid,${FOLIO}::uuid,
        ${LINEAGE}::uuid,${ATTRIBUTION}::uuid,
        ${built.input.section14Input.serviceProvisionResult.serviceProvisionSnapshotId}::uuid,
        ${built.input.section14Input.paymentReceiptResult.paymentReceiptSnapshotId}::uuid,
        ${built.input.section14Input.invoiceIssueResult.invoiceIssueSnapshotId}::uuid,
        ${applicabilitySupply.jurisdiction.extensionId}::uuid,${applicabilitySupply.classification.classificationId}::uuid,
        ${applicabilitySupply.supplier.serviceLocation.id}::uuid,${applicabilitySupply.supplier.status.id}::uuid,
        ${applicabilitySupply.recipient.status.id}::uuid,${applicabilitySupply.recipient.partyId}::uuid,
        ${valuation}::uuid,${applicabilityRequestId}::uuid,${resolvedApplicability.section14.case},
        ${section14.serviceProvisionDate}::date,${section14.invoiceIssueDate}::date,
        ${section14.paymentReceiptDate}::date,${section14.rateChangeDate}::date,
        ${resolvedApplicability.section14.timeOfSupplyDate}::date,
        ${resolvedApplicability.section14.selectedVersionSide},${selectedVersion.extensionId}::uuid,
        ${selectedVersion.version}::smallint,${selectedVersion.status},${selectedVersion.contentHash},
        ${selectedVersion.effectiveFromInstant}::timestamptz,${selectedVersion.effectiveToInstant}::timestamptz,
        ${canonicalInput.componentIdentityResult.componentFamily},${resolvedApplicability.predecessorHashes.section14},
        ${resolvedApplicability.predecessorHashes.levyComponentIdentity},
        ${resolvedApplicability.predecessorHashes.reservationLineage},
        ${resolvedApplicability.predecessorHashes.attributionSnapshot},${resolvedApplicability.evidenceHash},
        ${calendar?.calendarEvidence.authorityId ?? null},
        ${calendar?.calendarEvidence.sourceDigestSha256 ?? null},${calendar?.throughDate ?? null}::date,
        ${postgresArray(calendar?.calendarEvidence.days.map(({ date }: { date: string }) => date) ?? [])}::date[],
        ${postgresArray(calendar?.calendarEvidence.days.map(({ state }: { state: string }) => state) ?? [])}::text[],${actor}::uuid
      )`;
      for (const roomNight of resolvedApplicability.components) {
        await connection`INSERT INTO india_gst_accommodation_quoted_rate_applicability_room_night(
          tenant_id,applicability_id,ordinal,business_date,quoted_amount_minor,currency,slab_upto_minor,
          aggregate_rate_basis_points,itc_eligible
        ) VALUES(${TENANT}::uuid,${applicabilityId}::uuid,${Number(roomNight.ordinal)},
          ${roomNight.businessDate}::date,${roomNight.quotedAmountMinor},'INR',
          ${roomNight.slab.uptoMinor},${roomNight.slab.aggregateRateBasisPoints},${roomNight.slab.itcEligible})`;
        for (const [componentOrdinal, component] of roomNight.slab.components.entries()) {
          await connection`INSERT INTO india_gst_accommodation_quoted_rate_component(
            tenant_id,applicability_id,room_night_ordinal,component_ordinal,component_identity,rate_basis_points
          ) VALUES(${TENANT}::uuid,${applicabilityId}::uuid,${Number(roomNight.ordinal)},
            ${componentOrdinal},${component.identity},${component.rateBasisPoints})`;
        }
      }
      await connection.unsafe("RESET ROLE");
      await connection`INSERT INTO tenant(id,slug,name) VALUES(${foreignTenant}::uuid,'order367-foreign','Order367 foreign')`;
      await connection`INSERT INTO india_gst_accommodation_quoted_rate_applicability(
        tenant_id,id,property_node,reservation_id,folio_id,reservation_lineage_id,attribution_id,
        service_provision_snapshot_id,payment_receipt_snapshot_id,invoice_issue_snapshot_id,
        family_jurisdiction_extension_id,classification_id,supplier_service_location_id,
        supplier_sez_status_id,recipient_sez_status_id,recipient_party_id,final_valuation_id,request_id,
        section14_case,service_provision_date,invoice_issue_date,payment_receipt_date,rate_change_date,
        time_of_supply_date,selected_version_side,selected_extension_id,selected_extension_version,
        selected_extension_status,selected_content_hash,selected_effective_from,selected_effective_to,
        component_family,section14_evidence_hash,levy_component_identity_evidence_hash,
        reservation_lineage_evidence_hash,attribution_snapshot_evidence_hash,evidence_hash,
        calendar_authority_id,calendar_source_digest_sha256,calendar_through_date,calendar_dates,
        calendar_states,actor_id
      ) SELECT
        ${foreignTenant}::uuid,${foreignApplicabilityId}::uuid,property_node,reservation_id,folio_id,
        reservation_lineage_id,attribution_id,service_provision_snapshot_id,payment_receipt_snapshot_id,
        invoice_issue_snapshot_id,family_jurisdiction_extension_id,classification_id,
        supplier_service_location_id,supplier_sez_status_id,recipient_sez_status_id,recipient_party_id,
        final_valuation_id,${uuid(367118)}::uuid,section14_case,service_provision_date,invoice_issue_date,
        payment_receipt_date,rate_change_date,time_of_supply_date,selected_version_side,
        selected_extension_id,selected_extension_version,selected_extension_status,selected_content_hash,
        selected_effective_from,selected_effective_to,component_family,section14_evidence_hash,
        levy_component_identity_evidence_hash,reservation_lineage_evidence_hash,
        attribution_snapshot_evidence_hash,evidence_hash,calendar_authority_id,
        calendar_source_digest_sha256,calendar_through_date,calendar_dates,calendar_states,actor_id
        FROM public.india_gst_accommodation_quoted_rate_applicability
       WHERE tenant_id=${TENANT}::uuid AND id=${applicabilityId}::uuid`;
      await connection.unsafe("COMMIT"); open = false;
      connection.release(); held = false;
      connection = await runtimeDb.reserve(); held = true;
      await connection.unsafe("BEGIN"); open = true;
      await connection`SELECT set_config('app.tenant_id',${TENANT},true)`;
      await connection.unsafe("SET LOCAL ROLE app_role");

      const recorder = new IndiaGstAccommodationFinalComponentTaxRecorderService({ idempotency: new PostgresIdempotency() });
      const requestId = uuid(367110);
      const input = deepFreeze({
        tenantId: TENANT, propertyNode: PROPERTY, reservationId: RESERVATION, folioId: FOLIO,
        applicabilityId,
        quotedRateApplicabilityInput: canonicalInput,
        expectedCurrentTaxId: null, expectedCurrentEvidenceHash: null,
        idempotencyKey: "order367-record-initial",
        envelope: { tenantId: TENANT, propertyNode: PROPERTY, actorId: actor, requestId, operation: EVENT },
      });
      const first = await recorder.record(connection, input);
      expect(first).toMatchObject({
        generation: 0, valuationId: valuation, valuationGeneration: 3,
        transactionValueMinor: "1500000", taxMinor: "179000",
        grandTotalMinor: "1679000", replayed: false,
      });
      const replay = await recorder.record(connection, input);
      expect(replay).toEqual({ ...first, replayed: true });
      const expectApplicabilityConflict = async (
        challengedApplicabilityId: string,
        challengedRequestId: string,
      ) => {
        await connection.unsafe("SAVEPOINT applicability_hostility");
        try {
          let rejected: unknown;
          try {
            await connection`
              SELECT * FROM public.record_india_gst_accommodation_final_component_tax(
                ${TENANT}::uuid, ${PROPERTY}::uuid, ${RESERVATION}::uuid, ${FOLIO}::uuid,
                ${challengedApplicabilityId}::uuid, ${challengedRequestId}::uuid,
                ${actor}::uuid, ${null}::uuid, ${null}::text
              )
            `;
          } catch (error) {
            rejected = error;
          }
          const postgres = rejected as { readonly code?: string; readonly errno?: string; readonly message?: string };
          expect(postgres.errno ?? postgres.code).toBe("55000");
          expect(postgres.message).toBe("approved quoted-rate applicability is unavailable for this scope");
        } finally {
          await connection.unsafe("ROLLBACK TO SAVEPOINT applicability_hostility");
          await connection.unsafe("RELEASE SAVEPOINT applicability_hostility");
        }
      };
      await expectApplicabilityConflict(
        uuid(367999), uuid(367119),
      );
      await expectApplicabilityConflict(
        foreignApplicabilityId, uuid(367120),
      );

      const [afterReplay] = await connection<Array<{
        roots: number; nights: number; components: number; facts: number;
        events: number; receipts: number; documents: number; fiscal: number;
        journals: number; postings: number; applicability: string;
      }>>`
        SELECT
          (SELECT count(*)::int FROM india_gst_accommodation_final_component_tax WHERE tenant_id=${TENANT}::uuid) roots,
          (SELECT count(*)::int FROM india_gst_accommodation_final_component_tax_room_night WHERE tenant_id=${TENANT}::uuid) nights,
          (SELECT count(*)::int FROM india_gst_accommodation_final_component_tax_component WHERE tenant_id=${TENANT}::uuid) components,
          (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT}::uuid AND entity_type=${ROOT}) facts,
          (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT}::uuid AND event_type=${EVENT}) events,
          (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${TENANT}::uuid AND operation=${OPERATION}) receipts,
          (SELECT count(*)::int FROM document WHERE tenant_id=${TENANT}::uuid) documents,
          (SELECT count(*)::int FROM fiscal_submission WHERE tenant_id=${TENANT}::uuid) fiscal,
          (SELECT count(*)::int FROM journal WHERE tenant_id=${TENANT}::uuid) journals,
          (SELECT count(*)::int FROM posting_line WHERE tenant_id=${TENANT}::uuid) postings,
          (SELECT applicability_id::text FROM india_gst_accommodation_final_component_tax
            WHERE tenant_id=${TENANT}::uuid LIMIT 1) applicability
      `;
      expect(afterReplay).toEqual({
        roots: 1, nights: 2, components: 4, facts: 1, events: 1, receipts: 1,
        documents: 0, fiscal: 0, journals: 0, postings: 0,
        applicability: applicabilityId,
      });
      const [payloads] = await connection<Array<{ fact: Record<string, unknown>; event: Record<string, unknown> }>>`
        SELECT
          (SELECT payload FROM fact_log WHERE tenant_id=${TENANT}::uuid AND entity_type=${ROOT}) fact,
          (SELECT payload FROM outbox WHERE tenant_id=${TENANT}::uuid AND event_type=${EVENT}) event
      `;
      for (const payload of [payloads!.fact, payloads!.event]) {
        const keys = JSON.stringify(payload);
        expect(keys).not.toMatch(/buyer|invoice|route|account|journal|transactionValue|taxMinor|grandTotal/i);
      }

      await connection.unsafe("COMMIT"); open = false;
      parkedRuntime = connection; held = false;
      connection = await db.reserve(); held = true;
      await connection.unsafe("BEGIN"); open = true;
      await connection`SELECT set_config('app.tenant_id',${TENANT},true)`;
      await connection.unsafe("SET LOCAL session_replication_role=replica; SET LOCAL ROLE yellow_owner");
      await connection`INSERT INTO india_gst_accommodation_final_valuation SELECT tenant_id,${nextValuation}::uuid,property_node,reservation_id,folio_id,folio_account_id,window_no,buyer_party_id,attribution_id,${uuid(367111)}::uuid,4,disposition,currency,transaction_value_minor,source_set_hash,order341_evidence_hash,${h("c")},${h("d")},ordinary_evidence_hashes,manual_reasons,relationship_conclusion,consideration_conclusion,section15_2_conclusion,section15_3_conclusion,source_completeness_conclusion,attestation_evidence_source,attestation_evidence_reference,relationship_set_hash,attested_by,attested_at,approval_request_id,${valuation}::uuid,actor_id,recorded_at FROM india_gst_accommodation_final_valuation WHERE tenant_id=${TENANT}::uuid AND id=${valuation}::uuid`;
      await connection`INSERT INTO india_gst_accommodation_valuation_room_night SELECT tenant_id,${nextValuation}::uuid,ordinal,business_date,quoted_weight_minor,transaction_value_minor,currency FROM india_gst_accommodation_valuation_room_night WHERE tenant_id=${TENANT}::uuid AND valuation_id=${valuation}::uuid`;
      await connection.unsafe("COMMIT"); open = false;
      connection.release(); held = false;
      if (!parkedRuntime) throw new Error("Order367 runtime connection was not preserved");
      connection = parkedRuntime; parkedRuntime = null; held = true;
      await connection.unsafe("BEGIN"); open = true;
      await connection`SELECT set_config('app.tenant_id',${TENANT},true)`;
      await connection.unsafe("SET LOCAL ROLE app_role");
      const [correction] = await connection<Array<{
        tax_id: string; generation: number; valuation_id: string; valuation_generation: number;
        transaction_value_minor: string; tax_minor: string; grand_total_minor: string;
        evidence_hash: string; created: boolean;
      }>>`
        SELECT * FROM public.record_india_gst_accommodation_final_component_tax(
          ${TENANT}::uuid, ${PROPERTY}::uuid, ${RESERVATION}::uuid, ${FOLIO}::uuid,
          ${applicabilityId}::uuid, ${uuid(367112)}::uuid, ${actor}::uuid,
          ${first.taxId}::uuid, ${first.evidenceHash}
        )
      `;
      expect(correction).toMatchObject({
        generation: 1, valuation_id: nextValuation, valuation_generation: 4,
        transaction_value_minor: "1500000", tax_minor: "179000",
        grand_total_minor: "1679000", created: true,
      });
      await connection.unsafe("SAVEPOINT correction_fork");
      try {
        let rejected: unknown;
        try {
          await connection`
            SELECT * FROM public.record_india_gst_accommodation_final_component_tax(
              ${TENANT}::uuid, ${PROPERTY}::uuid, ${RESERVATION}::uuid, ${FOLIO}::uuid,
              ${applicabilityId}::uuid, ${uuid(367113)}::uuid, ${actor}::uuid,
              ${first.taxId}::uuid, ${first.evidenceHash}
            )
          `;
        } catch (error) {
          rejected = error;
        }
        const postgres = rejected as { readonly code?: string; readonly errno?: string };
        expect(postgres.errno ?? postgres.code).toBe("55000");
      } finally {
        await connection.unsafe("ROLLBACK TO SAVEPOINT correction_fork");
        await connection.unsafe("RELEASE SAVEPOINT correction_fork");
      }
      const finalCounts = await connection<Array<{ roots: number; heads: number; facts: number; events: number }>>`
        SELECT
          (SELECT count(*)::int FROM india_gst_accommodation_final_component_tax WHERE tenant_id=${TENANT}::uuid) roots,
          (SELECT count(*)::int FROM india_gst_accommodation_final_component_tax t WHERE tenant_id=${TENANT}::uuid AND NOT EXISTS (SELECT 1 FROM india_gst_accommodation_final_component_tax n WHERE n.tenant_id=t.tenant_id AND n.supersedes_tax_id=t.id)) heads,
          (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT}::uuid AND entity_type=${ROOT}) facts,
          (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT}::uuid AND event_type=${EVENT}) events
      `;
      expect(finalCounts).toEqual([{ roots: 2, heads: 1, facts: 2, events: 2 }]);
    } finally {
      if (open) await connection.unsafe("ROLLBACK").catch(() => undefined);
      if (held) connection.release();
      if (parkedRuntime) parkedRuntime.release();
    }
  }, 120_000);
});
