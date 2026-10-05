import { describe, expect, test } from "bun:test";

const files = {
  domain: new URL("../src/contexts/financials/business-day-roll.ts", import.meta.url),
  source: new URL("../src/workers/postgres-due-business-day-scopes.ts", import.meta.url),
  migration: new URL("../migrations/0061_runtime_due_business_day_scopes.sql", import.meta.url),
};

describe("Order 347 intentional red: automatic property-local business-day roll", () => {
  test("requires the absent service, runtime source, worker wiring and canonical event", async () => {
    const readIfPresent = async (url: URL): Promise<string> =>
      (await Bun.file(url).exists()) ? Bun.file(url).text() : "";
    const [domain, source, migration, server] = await Promise.all([
      readIfPresent(files.domain),
      readIfPresent(files.source),
      readIfPresent(files.migration),
      Bun.file(new URL("../src/server.ts", import.meta.url)).text(),
    ]);

    expect(domain).toContain("export class BusinessDayRollService");
    expect(domain).toContain("export class BusinessDayRollWorker");
    expect(source).toContain("FROM runtime_due_business_day_scopes(${limit})");
    expect(migration).toContain("runtime_due_business_day_scopes");
    expect(server).toContain("new BusinessDayRollWorker(");
    expect(domain).toContain('"business_day.opened"');
  });
});
