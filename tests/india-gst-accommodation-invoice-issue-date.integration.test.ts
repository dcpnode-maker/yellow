import { describe, expect, test } from "bun:test";
import {
  IndiaGstAccommodationInvoiceIssueDateConflictError,
  IndiaGstAccommodationInvoiceIssueDateNotFoundError,
  IndiaGstAccommodationInvoiceIssueDateService,
  IndiaGstAccommodationInvoiceIssueDateValidationError,
  createPositiveTaxAttributionSnapshot,
} from "../src/contexts/tax-fiscal";
import type { CreatePositiveTaxAttributionSnapshotInput } from "../src/contexts/tax-fiscal";
import type { Tx } from "../src/kernel";

const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const TENANT = id(29201), OTHER = id(29202), PROPERTY = id(29203), RESERVATION = id(29205);
const LINE = id(29206), HOLD = id(29207), ATTR = id(29208), SEGMENT = id(29209);
const SERVICE = id(29210), INVOICE = id(29211), OTHER_INVOICE = id(29212), EXTENSION = id(29213);
const QUOTE = "a".repeat(64), SNAPSHOT = "b".repeat(64), EVIDENCE = "c".repeat(64);
const LEGAL = "CGST_ACT_13_2_INVOICE_DATE_INPUT_ONLY";

type Row = Record<string, unknown>;
const attribution = (overrides: Partial<CreatePositiveTaxAttributionSnapshotInput> = {}) => createPositiveTaxAttributionSnapshot({
  origin: { kind: "rate_quote", quoteHash: QUOTE }, currency: "INR",
  line: { lineId: "room", revenueGroup: "room_revenue", amountMinor: 10000n, nights: 1, personNights: 2, roomNights: [{ businessDate: "2039-01-01", amountMinor: 10000n }] },
  assignments: [{ businessDate: "2039-01-01", jurisdictionKey: "in.order292.gst.27", evidenceRef: `tax-assignment:${QUOTE}` }],
  jurisdiction: { extensionId: EXTENSION, ownerTenantId: TENANT, key: "in.order292.gst.27", version: 7, contentHash: "d".repeat(64), evidenceRef: `tax-jurisdiction:${"e".repeat(64)}` },
  evaluation: { schemaVersion: 1, jurisdictionKey: "in.order292.gst.27", country: "IN", priceDisplay: "tax_exclusive", rounding: "line", inputTotalMinor: 10000n, baseTotalMinor: 10000n, taxTotalMinor: 500n, grandTotalMinor: 10500n, taxes: [{ code: "GST_ROOM", name: "GST", taxMinor: 500n, components: [{ lineId: "room", revenueGroup: "room_revenue", baseMinor: 10000n, taxMinor: 500n, rateBasisPoints: 500 }] }] },
  ...overrides,
});
const row = (overrides: Row = {}): Row => ({
  tenant_id: TENANT, id: INVOICE, service_provision_snapshot_id: SERVICE,
  currency: "INR", amount_minor: "10500", coverage_scope: "full_attribution",
  invoice_series: "FY2043", invoice_serial: "000042", invoice_issue_date: "2043-06-19",
  invoice_issue_source: "governed_supplier_tax_invoice_record",
  invoice_issue_evidence_sha256: EVIDENCE, legal_rule: LEGAL,
  service_tenant_id: TENANT, service_id: SERVICE, property_node: PROPERTY,
  reservation_lineage_id: LINE, hold_binding_id: HOLD, attribution_id: ATTR,
  reservation_id: RESERVATION, segment_id: SEGMENT, origin_quote_hash: QUOTE,
  snapshot_hash: attribution().snapshotHash, service_currency: "INR", service_provision_date: "2043-06-20",
  service_provision_source: "governed_service_provision_record",
  service_provision_evidence_sha256: "d".repeat(64),
  service_legal_rule: "CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY",
  lineage_id: LINE, lineage_property_node: PROPERTY, lineage_hold_binding_id: HOLD,
  lineage_attribution_id: ATTR, lineage_reservation_id: RESERVATION,
  lineage_segment_id: SEGMENT, lineage_origin_quote_hash: QUOTE,
  lineage_snapshot_hash: attribution().snapshotHash, lineage_currency: "INR",
  attribution_snapshot: attribution(),
  ...overrides,
});

const input = (overrides: Record<string, unknown> = {}) => ({
  tenantId: TENANT, propertyNode: PROPERTY, reservationId: RESERVATION,
  serviceProvisionSnapshotId: SERVICE, invoiceIssueSnapshotId: INVOICE,
  invoiceIssueDate: "2043-06-19", invoiceSeries: "FY2043", invoiceSerial: "000042",
  ...overrides,
});
const tx = (rows: readonly Row[], captured: string[] = []): Tx => (async (strings: TemplateStringsArray) => {
  captured.push(strings.join("?")); return rows;
}) as unknown as Tx;

describe("Order 292 exact India GST accommodation invoice issue date", () => {
  test("golden evidence preserves exact invoice identity/date and is replayable", async () => {
    const service = new IndiaGstAccommodationInvoiceIssueDateService();
    const result = await service.resolve(tx([row()]), input());
    expect(result.invoiceIssueDate).toBe("2043-06-19");
    expect(result.invoiceSeries).toBe("FY2043");
    expect(result.invoiceSerial).toBe("000042");
    expect(result.amountMinor).toBe("10500");
    expect(result.currency).toBe("INR");
    expect(result).not.toHaveProperty("tenantId");
    expect(Object.isFrozen(result)).toBeTrue();
    expect(await service.resolve(tx([row()]), input())).toEqual(result);
  });

  test("issue date before, equal to, and after service date is evidence only", async () => {
    const service = new IndiaGstAccommodationInvoiceIssueDateService();
    for (const date of ["2043-06-19", "2043-06-20", "2043-06-21"]) {
      const result = await service.resolve(tx([row({ invoice_issue_date: date })]), input({ invoiceIssueDate: date }));
      expect(result.invoiceIssueDate).toBe(date);
      expect(result.serviceProvisionDate).toBe("2043-06-20");
    }
  });

  test("exact plain eight-key input rejects proxies, accessors, symbols, missing and extras before SQL", async () => {
    const exact = input();
    const bad: unknown[] = [null, [], new Proxy({ ...exact }, {}), { ...exact, extra: true }];
    for (const key of Object.keys(exact)) { const candidate = { ...exact }; delete candidate[key as keyof typeof candidate]; bad.push(candidate); }
    const accessor = { ...exact } as Record<string, unknown>;
    Object.defineProperty(accessor, "invoiceIssueDate", { enumerable: true, get: () => "2043-06-19" }); bad.push(accessor);
    const symbol = { ...exact, [Symbol("hostile")]: true }; bad.push(symbol);
    for (const candidate of bad) {
      let calls = 0; const query = (async () => { calls++; return []; }) as unknown as Tx;
      await expect(new IndiaGstAccommodationInvoiceIssueDateService().resolve(query, candidate as never)).rejects.toBeInstanceOf(IndiaGstAccommodationInvoiceIssueDateValidationError);
      expect(calls).toBe(0);
    }
  });

  test("missing, duplicate, mixed-lineage and substitution evidence fails closed", async () => {
    const service = new IndiaGstAccommodationInvoiceIssueDateService();
    await expect(service.resolve(tx([]), input())).rejects.toBeInstanceOf(IndiaGstAccommodationInvoiceIssueDateNotFoundError);
    await expect(service.resolve(tx([row(), row({ id: OTHER_INVOICE })]), input())).rejects.toBeInstanceOf(IndiaGstAccommodationInvoiceIssueDateConflictError);
    for (const defect of [{ tenant_id: OTHER }, { service_tenant_id: OTHER }, { property_node: id(29290) }, { reservation_id: id(29291) }, { currency: "CAD" }, { amount_minor: "1" }, { coverage_scope: "partial_attribution" }, { invoice_issue_source: "document.issued_at" }, { invoice_issue_evidence_sha256: "C".repeat(64) }, { legal_rule: "CGST_ACT_13" }, { invoice_series: "" }, { invoice_serial: "" }]) {
      await expect(service.resolve(tx([row(defect)]), input())).rejects.toBeInstanceOf(IndiaGstAccommodationInvoiceIssueDateConflictError);
    }
  });

  test("SQL is equality-only complete lineage and has no writer or timestamp substitution", async () => {
    const captured: string[] = [];
    await new IndiaGstAccommodationInvoiceIssueDateService().resolve(tx([row()], captured), input());
    expect(captured).toHaveLength(1);
    for (const term of ["india_gst_accommodation_invoice_issue_snapshot", "india_gst_accommodation_service_provision_snapshot", "tax_attribution_snapshot", "invoice.tenant_id", "invoice.id", "invoice.invoice_issue_date", "invoice.invoice_series", "invoice.invoice_serial", "current_setting('app.tenant_id', true)"]) expect(captured[0]).toContain(term);
    expect(captured[0]).not.toMatch(/ORDER BY|LIMIT|latest|nearest|current_date|now\s*\(/i);
    expect(captured[0]).not.toMatch(/\b(?:INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|TRUNCATE|LOCK|FOR\s+(?:UPDATE|SHARE))\b/i);
    // The approved Order290 root must be selected to bind service truth. Only
    // operational/derived substitutes are forbidden in this invoice resolver.
    expect(captured[0]).not.toMatch(/document|folio|journal|posting|payment|provider|check.?in|check.?out/i);
  });
});

const live = process.env.YELLOW_ORDER292_DATABASE_URL && process.env.YELLOW_ORDER292_DEPLOY_DATABASE_URL ? describe.serial : describe.skip;
live("Order 292 live forced-RLS and ACL proof", () => {
  interface LiveRelation {
    rls: boolean; force: boolean; appSelect: boolean; appInsert: boolean;
    appUpdate: boolean; appDelete: boolean; appTruncate: boolean;
    publicPrivileges: number; policies: number;
  }

  test("app_role is SELECT-only, tenant-isolated, and all mutations fail 42501", async () => {
    const deploy = new (await import("bun")).SQL(process.env.YELLOW_ORDER292_DEPLOY_DATABASE_URL!, { max: 1 });
    const runtime = new (await import("bun")).SQL(process.env.YELLOW_ORDER292_DATABASE_URL!, { max: 1 });
    try {
      const relation = await deploy<LiveRelation[]>`SELECT c.relrowsecurity rls, c.relforcerowsecurity force, has_table_privilege('app_role',c.oid,'SELECT') "appSelect", has_table_privilege('app_role',c.oid,'INSERT') "appInsert", has_table_privilege('app_role',c.oid,'UPDATE') "appUpdate", has_table_privilege('app_role',c.oid,'DELETE') "appDelete", has_table_privilege('app_role',c.oid,'TRUNCATE') "appTruncate", (SELECT count(*)::int FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE a.grantee=0) "publicPrivileges", (SELECT count(*)::int FROM pg_policy p WHERE p.polrelid=c.oid) policies FROM pg_class c WHERE c.oid='public.india_gst_accommodation_invoice_issue_snapshot'::regclass`;
      expect(relation).toEqual([{ rls: true, force: true, appSelect: true, appInsert: false, appUpdate: false, appDelete: false, appTruncate: false, publicPrivileges: 0, policies: 1 }]);
      await runtime.begin(async (connection) => { await connection.unsafe("SET LOCAL ROLE app_role"); await connection`SELECT set_config('app.tenant_id', ${id(29299)}, true)`; expect(await connection<Array<{ count: number }>>`SELECT count(*)::int count FROM public.india_gst_accommodation_invoice_issue_snapshot`).toEqual([{ count: 0 }]); });
      for (const operation of ["INSERT", "UPDATE", "DELETE", "TRUNCATE"] as const) { let code: unknown; try { await runtime.begin(async (connection) => { await connection.unsafe("SET LOCAL ROLE app_role"); await connection`SELECT set_config('app.tenant_id', ${id(29299)}, true)`; if (operation === "INSERT") await connection.unsafe("INSERT INTO public.india_gst_accommodation_invoice_issue_snapshot DEFAULT VALUES"); if (operation === "UPDATE") await connection.unsafe("UPDATE public.india_gst_accommodation_invoice_issue_snapshot SET invoice_issue_date=invoice_issue_date WHERE false"); if (operation === "DELETE") await connection.unsafe("DELETE FROM public.india_gst_accommodation_invoice_issue_snapshot WHERE false"); if (operation === "TRUNCATE") await connection.unsafe("TRUNCATE public.india_gst_accommodation_invoice_issue_snapshot"); }); } catch (error) { code = (error as { errno?: unknown }).errno; } expect(code).toBe("42501"); }
    } finally { await Promise.all([deploy.close(), runtime.close()]); }
  }, 30_000);
});
