import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function source(path: string): Promise<string> {
  return readFile(new URL(path, root), "utf8");
}

describe("Order 193 intentional red proof", () => {
  test("hosted deposit schema and domain are absent before implementation", async () => {
    const migration = await source("migrations/0022_hosted_deposit_workbench.sql");
    const domain = await source("src/contexts/financials/hosted-deposits.ts");
    expect(migration).toContain("CREATE TABLE public.hosted_payment_request");
    expect(migration).toContain("CREATE TABLE public.deposit_application");
    expect(domain).toContain("class HostedDepositService");
  });

  test("guest, provider, callback and operator workbench markers are absent", async () => {
    const app = await source("src/app.ts");
    const operator = await source("src/http/operator.ts");
    const provider = await source("src/http/provider.ts");
    const guest = await source("src/http/guest/index.html");
    expect(app).toContain("hostedDepositRoutes");
    expect(operator).toContain("financials.deposits:apply");
    expect(provider).toContain("timingSafeEqual");
    expect(guest).toContain("data-hosted-deposit-status");
  });
});
