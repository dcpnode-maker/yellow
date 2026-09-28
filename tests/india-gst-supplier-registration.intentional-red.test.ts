import { describe, expect, test } from "bun:test";
import {
  IndiaGstSupplierRegistrationConflictError,
  IndiaGstSupplierRegistrationNotFoundError,
  IndiaGstSupplierRegistrationService,
  createPositiveTaxAttributionSnapshot,
  type CreatePositiveTaxAttributionSnapshotInput,
  type PositiveTaxFolioEligibilityResult,
} from "../src/contexts/tax-fiscal";
import type { Tx } from "../src/kernel";

const migration = new URL("../migrations/0047_property_fiscal_registration.sql", import.meta.url);
const sourceRoot = new URL("../src/contexts/tax-fiscal/", import.meta.url);
const id = (suffix: number): string =>
  `00000000-0000-0000-0000-${String(suffix).padStart(12, "0")}`;
const TENANT = id(27201);
const PROPERTY = id(27202);
const RESERVATION = id(27203);
const EXTENSION = id(27204);
const REGISTRATION = id(27205);
const HASH = "a".repeat(64);

function eligibility(country = "IN", currency = "INR"): PositiveTaxFolioEligibilityResult {
  const snapshotInput: CreatePositiveTaxAttributionSnapshotInput = {
    origin: { kind: "rate_quote", quoteHash: "b".repeat(64) },
    currency,
    line: {
      lineId: "room", revenueGroup: "room_revenue", amountMinor: 10_000n,
      nights: 1, personNights: 2,
      roomNights: [{ businessDate: "2035-01-01", amountMinor: 10_000n }],
    },
    assignments: [{
      businessDate: "2035-01-01", jurisdictionKey: "in.order272.gst",
      evidenceRef: `tax-assignment:${"c".repeat(64)}`,
    }],
    jurisdiction: {
      extensionId: EXTENSION, ownerTenantId: TENANT, key: "in.order272.gst",
      version: 7, contentHash: HASH, evidenceRef: `tax-jurisdiction:${"d".repeat(64)}`,
    },
    evaluation: {
      schemaVersion: 1, jurisdictionKey: "in.order272.gst", country,
      priceDisplay: "tax_exclusive", rounding: "line", inputTotalMinor: 10_000n,
      baseTotalMinor: 10_000n, taxTotalMinor: 500n, grandTotalMinor: 10_500n,
      taxes: [{
        code: "GST_ROOM", name: "Aggregate GST", taxMinor: 500n,
        components: [{
          lineId: "room", revenueGroup: "room_revenue", baseMinor: 10_000n,
          taxMinor: 500n, rateBasisPoints: 500,
        }],
      }],
    },
  };
  const snapshot = createPositiveTaxAttributionSnapshot(snapshotInput);
  return Object.freeze({
    lineageId: id(27211), bindingId: id(27212), attributionId: id(27213),
    reservationId: RESERVATION, segmentId: id(27214), folioId: id(27215),
    guestAccountId: id(27216), propertyNode: PROPERTY,
    quoteHash: snapshot.origin.quoteHash, snapshotHash: snapshot.snapshotHash,
    currency, snapshot,
  });
}

function registration(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: REGISTRATION, tenant_id: TENANT, property_node: PROPERTY,
    scheme: "in-gstin", currency: "INR", jurisdiction_extension_id: EXTENSION,
    jurisdiction_owner_tenant_id: TENANT, jurisdiction_key: "in.order272.gst",
    jurisdiction_version: 7, jurisdiction_content_hash: HASH,
    registration_number: "27AAPFU0939F1ZV", region_code: "27",
    legal_name: "Yellow Hospitality Private Limited", trade_name: "Yellow Hotels",
    address_line: "1 Marine Drive", locality: "Mumbai", postal_code: "400001",
    ...overrides,
  };
}

function resolver(
  result: PositiveTaxFolioEligibilityResult,
  rows: readonly Record<string, unknown>[],
  sql?: { value: string },
): IndiaGstSupplierRegistrationService {
  const service = new IndiaGstSupplierRegistrationService({
    async discover() { return result; },
    async resolve() { return result; },
  });
  const tx = (async (strings: TemplateStringsArray) => {
    if (sql) sql.value = strings.join(" ");
    return rows;
  }) as unknown as Tx;
  Object.defineProperty(service, "__testTx", { value: tx });
  return service;
}

function testTx(service: IndiaGstSupplierRegistrationService): Tx {
  return (service as unknown as { __testTx: Tx }).__testTx;
}

async function resolve(
  result = eligibility(),
  rows: readonly Record<string, unknown>[] = [registration()],
) {
  const service = resolver(result, rows);
  return service.resolve(testTx(service), {
    tenantId: TENANT, propertyNode: PROPERTY, reservationId: RESERVATION,
  });
}

function expectDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBeTrue();
  for (const key of Reflect.ownKeys(value)) {
    expectDeepFrozen((value as Record<PropertyKey, unknown>)[key], seen);
  }
}

describe("Order 272 intentional red: exact India GST supplier registration", () => {
  test("P0: the tenant registration root and deterministic resolver surface exist", async () => {
    expect(await Bun.file(migration).exists()).toBeTrue();
    expect(await Bun.file(new URL("india-gst-supplier-registration.ts", sourceRoot)).exists())
      .toBeTrue();

    const sql = await Bun.file(migration).text();
    const service = await Bun.file(new URL("india-gst-supplier-registration.ts", sourceRoot)).text();
    const index = await Bun.file(new URL("index.ts", sourceRoot)).text();
    expect(sql).toContain("CREATE TABLE public.property_fiscal_registration");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("GRANT SELECT ON TABLE public.property_fiscal_registration TO app_role");
    expect(service).toContain("export class IndiaGstSupplierRegistrationService");
    expect(service).toContain("async discover(");
    expect(service).toContain("async resolve(");
    expect(service).toContain("jurisdiction_owner_tenant_id IS NOT DISTINCT FROM");
    expect(service).toContain('new Bun.CryptoHasher("sha256")');
    expect(index).toContain('from "./india-gst-supplier-registration"');
  });

  test("P1: exact GSTIN evidence is stable, deeply frozen and SELECT-only", async () => {
    const captured = { value: "" };
    const service = resolver(eligibility(), [registration()], captured);
    const input = { tenantId: TENANT, propertyNode: PROPERTY, reservationId: RESERVATION };
    const first = await service.resolve(testTx(service), input);
    const second = await service.resolve(testTx(service), input);
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      registrationId: REGISTRATION, propertyNode: PROPERTY, scheme: "in-gstin",
      currency: "INR", gstin: "27AAPFU0939F1ZV", stateCode: "27",
      legalName: "Yellow Hospitality Private Limited", tradeName: "Yellow Hotels",
      addressLine: "1 Marine Drive", locality: "Mumbai", postalCode: "400001",
      jurisdiction: {
        extensionId: EXTENSION, ownerTenantId: TENANT, key: "in.order272.gst",
        version: "7", contentHash: HASH,
      },
    });
    expect(first.evidenceHash).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.keys(first)).not.toContain("eligibility");
    expect(Object.keys(first)).not.toContain("tenantId");
    expectDeepFrozen(first);
    expect(captured.value).toContain("FROM public.property_fiscal_registration");
    expect(captured.value).not.toMatch(/\b(?:INSERT|UPDATE|DELETE)\b/);
  });

  test("P2: malformed, checksum-invalid, prefix-mismatched and noncanonical fields fail closed", async () => {
    const defects: readonly Record<string, unknown>[] = [
      { registration_number: "27AAPFU0939F1ZA" },
      { registration_number: "29AAPFU0939F1ZP", region_code: "27" },
      { region_code: "00", registration_number: "00AAPFU0939F1ZM" },
      { region_code: "39", registration_number: "39AAPFU0939F1ZQ" },
      { region_code: "96", registration_number: "96AAPFU0939F1ZQ" },
      { legal_name: " Yellow Hospitality" },
      { trade_name: "" },
      { address_line: "1 Marine Drive\n" },
      { locality: "Mumbai\u0000" },
      { postal_code: "040001" },
      { jurisdiction_content_hash: "A".repeat(64) },
    ];
    for (const defect of defects) {
      await expect(resolve(eligibility(), [registration(defect)]))
        .rejects.toBeInstanceOf(IndiaGstSupplierRegistrationConflictError);
    }
  });

  test("P3: missing or duplicate configured evidence has distinct fail-closed errors", async () => {
    await expect(resolve(eligibility(), []))
      .rejects.toBeInstanceOf(IndiaGstSupplierRegistrationNotFoundError);
    await expect(resolve(eligibility(), [registration(), registration({ id: id(27206) })]))
      .rejects.toBeInstanceOf(IndiaGstSupplierRegistrationConflictError);
  });

  test("P4: non-India country or non-INR currency never reaches registration lookup", async () => {
    for (const result of [eligibility("CA", "INR"), eligibility("IN", "CAD")]) {
      let calls = 0;
      const service = new IndiaGstSupplierRegistrationService({
        async resolve() { return result; },
      });
      const tx = (() => { calls += 1; return Promise.resolve([registration()]); }) as unknown as Tx;
      await expect(service.resolve(tx, {
        tenantId: TENANT, propertyNode: PROPERTY, reservationId: RESERVATION,
      })).rejects.toBeInstanceOf(IndiaGstSupplierRegistrationConflictError);
      expect(calls).toBe(0);
    }
  });
});
