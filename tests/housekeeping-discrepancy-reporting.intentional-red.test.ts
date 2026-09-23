import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

function source(path: URL): string {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

describe("Order 235 intentional red: governed room discrepancy reporting", () => {
  test("the owner-mediated discrepancy capability exists", () => {
    const migrationUrl = new URL(
      "../migrations/0036_governed_room_discrepancy_reporting.sql",
      import.meta.url,
    );
    const migration = source(migrationUrl);

    expect(existsSync(migrationUrl)).toBe(true);
    expect(migration).toContain("CREATE FUNCTION public.report_room_discrepancy(");
    expect(migration).toContain("SET search_path = pg_catalog, public");
  });

  test("the housekeeping context exposes one bounded discrepancy service", () => {
    const serviceUrl = new URL(
      "../src/contexts/housekeeping/discrepancies.ts",
      import.meta.url,
    );
    const service = source(serviceUrl);
    const exports = source(new URL("../src/contexts/housekeeping/index.ts", import.meta.url));

    expect(existsSync(serviceUrl)).toBe(true);
    expect(service).toContain("HousekeepingDiscrepancyService");
    expect(service).toContain("async listOpen(");
    expect(service).toContain("async report(");
    expect(exports).toContain("HousekeepingDiscrepancyService");
  });

  test("the application exposes exact unresolved-read and deliberate-report routes", () => {
    const app = source(new URL("../src/app.ts", import.meta.url));
    const route = "/api/v1/properties/:property/housekeeping/discrepancies";

    expect(app).toContain(`.get("${route}"`);
    expect(app).toContain(`.post("${route}"`);
  });

  test("the operator adapter requires the two discrepancy-only scopes", () => {
    const adapter = source(new URL("../src/http/operator.ts", import.meta.url));

    expect(adapter).toContain("housekeeping.discrepancies:read");
    expect(adapter).toContain("housekeeping.discrepancies:report");
  });

  test("the Housekeeping board has semantic report and unresolved-read hooks", () => {
    const script = source(new URL("../src/http/operator/operator.js", import.meta.url));
    const html = source(new URL("../src/http/operator/index.html", import.meta.url));
    const surface = `${html}\n${script}`;

    expect(surface).toContain("housekeeping-discrepancy-report-form");
    expect(surface).toContain("housekeeping-discrepancy-list");
    expect(script).toContain("loadHousekeepingDiscrepancies");
    expect(script).toContain("submitHousekeepingDiscrepancy");
    expect(surface).toContain("Report room observation");
  });
});
