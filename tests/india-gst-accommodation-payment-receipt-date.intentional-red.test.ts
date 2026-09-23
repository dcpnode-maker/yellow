import { describe, expect, test } from "bun:test";

const migration = new URL(
  "../migrations/0057_india_gst_accommodation_payment_receipt_date.sql",
  import.meta.url,
);
const source = new URL(
  "../src/contexts/tax-fiscal/india-gst-accommodation-payment-receipt-date.ts",
  import.meta.url,
);
const index = new URL("../src/contexts/tax-fiscal/index.ts", import.meta.url);

describe("Order 291 intentional red: exact India GST accommodation payment-receipt date", () => {
  test("P0: the snapshot, resolver module and bounded-context export are absent before implementation", async () => {
    expect(await Bun.file(migration).exists()).toBeTrue();
    expect(await Bun.file(source).exists()).toBeTrue();

    const sql = await Bun.file(migration).text();
    const service = await Bun.file(source).text();
    const moduleSurface = await Bun.file(index).text();

    expect(sql).toContain(
      "CREATE TABLE public.india_gst_accommodation_payment_receipt_snapshot",
    );
    expect(sql).toContain(
      "FOREIGN KEY (tenant_id, service_provision_snapshot_id)",
    );
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("FORCE ROW LEVEL SECURITY");
    expect(sql).toMatch(
      /GRANT\s+SELECT\s+ON\s+TABLE\s+public\.india_gst_accommodation_payment_receipt_snapshot\s+TO\s+app_role/i,
    );
    expect(service).toContain(
      "export class IndiaGstAccommodationPaymentReceiptDateService",
    );
    expect(service).toContain("async resolve(");
    expect(moduleSurface).toContain(
      'from "./india-gst-accommodation-payment-receipt-date"',
    );
  });
});
