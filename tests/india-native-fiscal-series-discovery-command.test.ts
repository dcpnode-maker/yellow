import { describe, expect, test } from "bun:test";
import type { Tx } from "../src/kernel";
import {
  ReadIndiaNativeFiscalSeriesCommand,
  readIndiaNativeFiscalSeriesInTransaction,
} from "../src/commands/read-india-native-fiscal-series";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const input = Object.freeze({
  tenantId: id(1), propertyNode: id(2), supplierRegistrationId: id(3),
  documentKind: "credit_note" as const, actorId: id(4),
});
const resultRow = Object.freeze({
  authority_allowed: true, supplier_available: true, current_financial_year_start: "2026-04-01",
  series_id: id(5), tenant_id: id(1), property_node: id(2), supplier_registration_id: id(3),
  document_kind: "credit_note", prefix: "C453/", financial_year_start: "2026-04-01", next_no: "9",
});

function txReturning(value: unknown, calls: unknown[][] = []): Tx {
  return (async (_strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push(values);
    return value;
  }) as Tx;
}

describe("Order454 fiscal-series discovery command", () => {
  test("validates before opening the tenant transaction and returns the frozen service result", async () => {
    let transactions = 0;
    const database = {
      withTenantTransaction(tenantId: string, work: (tx: Tx) => Promise<unknown>) {
        transactions++;
        expect(tenantId).toBe(id(1));
        return work(txReturning([resultRow]));
      },
    } as never;
    const command = new ReadIndiaNativeFiscalSeriesCommand(database);
    await expect(command.execute({ ...input })).resolves.toEqual({
      seriesId: id(5), tenantId: id(1), propertyNode: id(2), supplierRegistrationId: id(3),
      documentKind: "credit_note", prefix: "C453/", financialYearStart: "2026-04-01", nextNo: "9",
    });
    expect(transactions).toBe(1);
    await expect(command.execute({ ...input, extra: true })).rejects.toThrow();
    expect(transactions).toBe(1);
  });

  test("caller-transaction helper preserves null discovery and delegates one read", async () => {
    const calls: unknown[][] = [];
    await expect(readIndiaNativeFiscalSeriesInTransaction(txReturning([{
      authority_allowed: true, supplier_available: true, current_financial_year_start: "2026-04-01",
      series_id: null, tenant_id: null, property_node: null, supplier_registration_id: null,
      document_kind: null, prefix: null, financial_year_start: null, next_no: null,
    }], calls), input)).resolves.toBeNull();
    expect(calls).toHaveLength(1);
  });
});
