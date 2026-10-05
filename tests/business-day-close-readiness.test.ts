import { describe, expect, test } from "bun:test";

import {
  BusinessDayCloseReadinessService,
  BusinessDayCloseReadinessUnavailableError,
  BusinessDayCloseReadinessValidationError,
} from "../src/contexts/financials";
import type { Database, Tx } from "../src/kernel";

const TENANT = "00000000-0000-0000-0000-000000034900";
const PROPERTY = "00000000-0000-0000-0000-000000034901";
const ACTOR = "00000000-0000-0000-0000-000000034902";
const DAY = "2047-05-06";

function row(overrides: Record<string, unknown> = {}) {
  return {
    tenant_id: TENANT, property_node: PROPERTY, business_date: DAY,
    captured_at: new Date("2047-05-07T00:00:00.000Z"),
    due_in: 0n, due_out: 0n, open_cashiers: 0n, discrepancies: 0n,
    financial_interface: 0n, fiscal_interface: 0n, statutory_interface: 0n, channel_delivery: 0n,
    unknown_due: 0n, unknown_discrepancy: 0n, unknown_outbox: 0n, unknown_financial: 0n,
    unknown_fiscal: 0n, unknown_statutory: 0n, unknown_channel: 0n,
    oldest_unpublished: null, outbox_age_ms: null, outbox_over_threshold: null,
    ...overrides,
  };
}

function harness(rows: unknown[]) {
  let transactions = 0;
  let statements = 0;
  let sql = "";
  const tx = ((parts: TemplateStringsArray) => {
    statements += 1;
    sql = parts.join("?");
    return Promise.resolve(rows);
  }) as unknown as Tx;
  const database = {
    withTenantTransaction: async (tenantId: string, operation: (inner: Tx) => Promise<unknown>) => {
      transactions += 1;
      expect(tenantId).toBe(TENANT);
      return operation(tx);
    },
  } as unknown as Database;
  return { service: new BusinessDayCloseReadinessService({ database }), stats: () => ({ transactions, statements, sql }) };
}

const input = () => ({ tenantId: TENANT, propertyNode: PROPERTY, businessDate: DAY, actorId: ACTOR });

describe("Order 349 business-day close readiness read model", () => {
  test("returns one deeply frozen ready snapshot from one tenant transaction and one statement", async () => {
    const { service, stats } = harness([row()]);
    const result = await service.read(input());
    expect(result).toEqual({
      tenantId: TENANT, propertyNode: PROPERTY, businessDate: DAY,
      capturedAt: "2047-05-07T00:00:00.000Z", ready: true, reasons: [],
      counts: { unresolvedDueIn: 0, unresolvedDueOut: 0, openCashiers: 0,
        unresolvedDiscrepancies: 0, financialInterface: 0, fiscalInterface: 0,
        statutoryInterface: 0, channelDelivery: 0, unknownAttribution: 0 },
      outboxLag: { kind: "none", ageMilliseconds: 0 },
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.reasons)).toBe(true);
    expect(Object.isFrozen(result.counts)).toBe(true);
    expect(Object.isFrozen(result.outboxLag)).toBe(true);
    expect(stats().transactions).toBe(1);
    expect(stats().statements).toBe(1);
    expect(stats().sql).toContain("transaction_timestamp()");
    expect(stats().sql).toContain("ORDER BY event.seq DESC");
    expect(stats().sql).toContain("interval '5 minutes'");
    expect(stats().sql).not.toContain("->>");
    expect(stats().sql).not.toContain("event.payload");
    expect(stats().sql).toContain("approval.payload=canonical.approval_binding");
  });

  test("decodes every blocker in fixed order and collapses unsafe attribution once", async () => {
    const result = await harness([row({
      due_in: "2", due_out: 1, open_cashiers: 3n, discrepancies: 4n,
      financial_interface: 5n, fiscal_interface: 6n, statutory_interface: 7n, channel_delivery: 8n,
      unknown_due: 2n, unknown_discrepancy: 3n, unknown_outbox: 0n, unknown_financial: 5n,
      unknown_fiscal: 7n, unknown_statutory: 11n, unknown_channel: 13n,
      oldest_unpublished: "2047-05-06T23:54:59.999Z", outbox_age_ms: 300001n,
      outbox_over_threshold: true,
    })]).service.read(input());
    expect(result.ready).toBe(false);
    expect(result.reasons.map(({ code }) => code)).toEqual([
      "unresolved_due_in", "unresolved_due_out", "open_cashier_session", "unresolved_discrepancy",
      "outbox_lag_exceeded", "financial_interface_pending", "fiscal_interface_pending",
      "statutory_interface_pending", "channel_delivery_pending", "source_attribution_unknown",
    ]);
    expect(result.reasons.at(-1)).toEqual({ code: "source_attribution_unknown", source: "reservations", count: 41 });
    expect(result.counts.unknownAttribution).toBe(41);
    expect(result.outboxLag).toEqual({ kind: "over_threshold", oldestCreatedAt: "2047-05-06T23:54:59.999Z",
      ageMilliseconds: 300001, thresholdMilliseconds: 300000 });
  });

  test("enforces strict five-minute classification and unknown outbox precedence", async () => {
    const within = await harness([row({ oldest_unpublished: new Date("2047-05-06T23:55:00.001Z"),
      outbox_age_ms: 299999n, outbox_over_threshold: false })]).service.read(input());
    expect(within.ready).toBe(true);
    expect(within.outboxLag.kind).toBe("within_threshold");

    const exact = await harness([row({ oldest_unpublished: new Date("2047-05-06T23:55:00.000Z"),
      outbox_age_ms: 300000n, outbox_over_threshold: true })]).service.read(input());
    expect(exact.ready).toBe(false);
    expect(exact.outboxLag.kind).toBe("over_threshold");

    const unknown = await harness([row({ unknown_outbox: 2n, oldest_unpublished: new Date(),
      outbox_age_ms: 0n, outbox_over_threshold: false })]).service.read(input());
    expect(unknown.outboxLag).toEqual({ kind: "unknown", count: 2 });
    expect(unknown.ready).toBe(false);
  });

  test("rejects caller authority, absent targets and hostile database shapes", async () => {
    for (const invalid of [
      { ...input(), ready: true },
      { ...input(), tenantId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaA" },
      { ...input(), propertyNode: "not-a-uuid" },
      { ...input(), businessDate: "06-05-2047" },
      { ...input(), businessDate: "2047-02-30" },
      { ...input(), actorId: "" },
    ]) {
      await expect(harness([row()]).service.read(invalid as never))
        .rejects.toBeInstanceOf(BusinessDayCloseReadinessValidationError);
    }
    await expect(harness([]).service.read(input())).rejects.toBeInstanceOf(BusinessDayCloseReadinessUnavailableError);
    await expect(harness([row(), row()]).service.read(input())).rejects.toBeInstanceOf(BusinessDayCloseReadinessUnavailableError);
    await expect(harness([row({ tenant_id: crypto.randomUUID() })]).service.read(input()))
      .rejects.toThrow("different target");
    await expect(harness([row({ due_in: -1 })]).service.read(input())).rejects.toThrow("invalid due-in count");
    await expect(harness([row({ oldest_unpublished: null, outbox_age_ms: 0n })]).service.read(input()))
      .rejects.toThrow("incoherent empty outbox lag");
    await expect(harness([row({ oldest_unpublished: new Date(), outbox_age_ms: 299999n,
      outbox_over_threshold: true })]).service.read(input())).rejects.toThrow("incoherent outbox threshold");
  });
});
