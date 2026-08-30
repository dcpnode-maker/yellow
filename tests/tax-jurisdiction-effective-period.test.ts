import { describe, expect, test } from "bun:test";

import { TaxJurisdictionResolutionService } from "../src/contexts/tax-fiscal";
import {
  ExtensionRegistry,
  type ConnectionPool,
  type ExtensionInstance,
  type Tx,
} from "../src/kernel";

const TENANT = "00000000-0000-0000-0000-000000029901";
const PROPERTY = "00000000-0000-0000-0000-000000029911";
const EXTENSION = "00000000-0000-0000-0000-000000029921";
const KEY = "in-order299-effective";

function tx(): Tx {
  return (async (strings: TemplateStringsArray) => {
    const sql = strings.join("?");
    if (/FROM\s+org_node/i.test(sql)) return [{
      tenant_id: TENANT,
      property_timezone: "UTC",
      business_day_from_instant: "2026-06-01T00:00:00.000000Z",
      business_day_to_instant: "2026-06-02T00:00:00.000000Z",
    }];
    if (/FROM\s+tax_assignment/i.test(sql)) {
      return [{ jurisdiction_key: KEY, effective_from: "2026-01-01", effective_to: null }];
    }
    throw new Error(`unexpected SQL: ${sql}`);
  }) as unknown as Tx;
}

const visible: ExtensionInstance = {
  id: EXTENSION,
  tenantId: TENANT,
  type: "tax_jurisdiction",
  key: KEY,
  version: 2,
  content: { country: "IN", taxes: [] },
  status: "active",
};

type Period = Awaited<ReturnType<ExtensionRegistry["readVisibleEffectivePeriod"]>>;

function service(period: Period, calls: string[][] = []): TaxJurisdictionResolutionService {
  return new TaxJurisdictionResolutionService({
    async listVisible(tenantId: string) {
      expect(tenantId).toBe(TENANT);
      return [visible];
    },
    async readVisibleEffectivePeriod(tenantId: string, extensionId: string) {
      calls.push([tenantId, extensionId]);
      return period;
    },
  });
}

function deeplyFrozen(value: unknown, seen = new Set<object>()): boolean {
  if (typeof value !== "object" || value === null || seen.has(value)) return true;
  seen.add(value);
  if (!Object.isFrozen(value)) return false;
  return Reflect.ownKeys(value).every((key) =>
    deeplyFrozen((value as Record<PropertyKey, unknown>)[key], seen));
}

describe("Order 299 tax-jurisdiction effective-period evidence", () => {
  test("registry calls only the narrow projection and canonicalizes driver instants", async () => {
    const statements: string[] = [];
    let released = false;
    const connection = (async (strings: TemplateStringsArray) => {
      statements.push(strings.join("?"));
      return [{
        extension_id: EXTENSION,
        owner_tenant_id: TENANT,
        effective_from_instant: "2026-01-01T00:00:00.123456Z",
        effective_to_instant: "2027-01-01T00:00:00.654321Z",
      }];
    }) as unknown as Tx;
    Object.assign(connection, { release() { released = true; } });
    const registry = new ExtensionRegistry({
      async reserve() { return connection; },
    } as ConnectionPool);

    expect(await registry.readVisibleEffectivePeriod(TENANT, EXTENSION)).toEqual({
      extensionId: EXTENSION,
      ownerTenantId: TENANT,
      effectiveFromInstant: "2026-01-01T00:00:00.123456Z",
      effectiveToInstant: "2027-01-01T00:00:00.654321Z",
    });
    expect(statements).toHaveLength(1);
    expect(statements[0]).toContain("runtime_visible_extension_effective_period");
    expect(released).toBe(true);
  });

  test("binds the exact selected id and canonical UTC bounds into deeply frozen evidence", async () => {
    const calls: string[][] = [];
    const result = await service({
      extensionId: EXTENSION,
      ownerTenantId: TENANT,
      effectiveFromInstant: "2026-01-01T00:00:00.000000Z",
      effectiveToInstant: "2027-01-01T00:00:00.000000Z",
    }, calls).resolve(tx(), { propertyNode: PROPERTY, businessDate: "2026-06-01" });

    expect(calls).toEqual([[TENANT, EXTENSION]]);
    expect(result.state).toBe("resolved");
    if (result.state !== "resolved") throw new Error("expected resolved evidence");
    expect(result.jurisdiction.effectiveFromInstant).toBe("2026-01-01T00:00:00.000000Z");
    expect(result.jurisdiction.effectiveToInstant).toBe("2027-01-01T00:00:00.000000Z");
    expect(deeplyFrozen(result)).toBe(true);
  });

  test("preserves either unbounded end and changes the evidence reference with either bound", async () => {
    const lowerUnbounded = await service({
      extensionId: EXTENSION, ownerTenantId: TENANT,
      effectiveFromInstant: null, effectiveToInstant: "2027-01-01T00:00:00.000000Z",
    }).resolve(tx(), { propertyNode: PROPERTY, businessDate: "2026-06-01" });
    const upperUnbounded = await service({
      extensionId: EXTENSION, ownerTenantId: TENANT,
      effectiveFromInstant: "2026-01-01T00:00:00.000000Z", effectiveToInstant: null,
    }).resolve(tx(), { propertyNode: PROPERTY, businessDate: "2026-06-01" });
    const changedLower = await service({
      extensionId: EXTENSION, ownerTenantId: TENANT,
      effectiveFromInstant: "2026-02-01T00:00:00.000000Z", effectiveToInstant: null,
    }).resolve(tx(), { propertyNode: PROPERTY, businessDate: "2026-06-01" });
    if (lowerUnbounded.state !== "resolved" || upperUnbounded.state !== "resolved"
        || changedLower.state !== "resolved") throw new Error("expected resolved evidence");
    expect(lowerUnbounded.jurisdiction.effectiveFromInstant).toBeNull();
    expect(upperUnbounded.jurisdiction.effectiveToInstant).toBeNull();
    expect(lowerUnbounded.jurisdiction.evidenceRef).not.toBe(upperUnbounded.jurisdiction.evidenceRef);
    expect(upperUnbounded.jurisdiction.evidenceRef).not.toBe(changedLower.jurisdiction.evidenceRef);
  });

  test("fails closed on changed identity, malformed bounds and non-increasing periods", async () => {
    const cases: Period[] = [
      { extensionId: "00000000-0000-0000-0000-000000029929", ownerTenantId: TENANT,
        effectiveFromInstant: null, effectiveToInstant: null },
      { extensionId: EXTENSION, ownerTenantId: null,
        effectiveFromInstant: null, effectiveToInstant: null },
      { extensionId: EXTENSION, ownerTenantId: TENANT,
        effectiveFromInstant: "2026-01-01T00:00:00Z", effectiveToInstant: null },
      { extensionId: EXTENSION, ownerTenantId: TENANT,
        effectiveFromInstant: "2027-01-01T00:00:00.000000Z",
        effectiveToInstant: "2026-01-01T00:00:00.000000Z" },
    ];
    for (const period of cases) {
      await expect(service(period).resolve(tx(), {
        propertyNode: PROPERTY,
        businessDate: "2026-06-01",
      })).rejects.toThrow("Tax jurisdiction resolution failed");
    }
  });
});
