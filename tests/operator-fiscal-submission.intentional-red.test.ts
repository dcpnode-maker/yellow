import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

test("Q203 edges remain composed while Q207 protected transport stays default-off", () => {
  const operator = readFileSync(new URL("../src/http/operator.ts", import.meta.url), "utf8");
  const app = readFileSync(new URL("../src/app.ts", import.meta.url), "utf8");
  const server = readFileSync(new URL("../src/server.ts", import.meta.url), "utf8");
  const ci = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");

  expect(operator).toContain("requestFiscalSubmission");
  expect(operator).toContain("retryFiscalSubmission");
  expect(app).toContain('properties/:property/fiscal-submissions"');
  expect(app).toContain("fiscal-submissions/:submission/retry");
  expect(server).toContain(
    'const fiscalSubmissionDeliveryEnabled = workbenchEnabled && Bun.env.YELLOW_FISCAL_SUBMISSION_WORKER === "1"',
  );
  expect(server).toContain(
    "const providerConfiguration = await loadIndiaIrpAdapterRegistrationsFromEnvironment(Bun.env)",
  );
  expect(server).toContain("const verifiedIndiaIrpAdapterRegistrations = providerConfiguration.value");
  expect(server).toContain("new VerifiedIndiaIrpAdapterRegistry(verifiedIndiaIrpAdapterRegistrations)");
  expect(server).toContain(
    "new FiscalSubmissionAdapterAvailabilityService(fiscalAdapterRegistry.identities())",
  );
  expect(server).toContain("new FiscalSubmissionWorker(fiscalRepository, fiscalAdapterRegistry)");
  const load = server.indexOf("await loadIndiaIrpAdapterRegistrationsFromEnvironment(Bun.env)");
  const invalid = server.indexOf("if (!providerConfiguration.ok)");
  const emptyEnabled = server.indexOf("enabled fiscal submission worker requires a verified provider adapter");
  const firstPool = Math.min(server.indexOf("Database.connect"), server.indexOf("new SQL"));
  const listen = server.indexOf("runtimeApp().listen");
  expect([load, invalid, emptyEnabled, firstPool, listen].every((index) => index >= 0)).toBe(true);
  expect(load).toBeLessThan(invalid);
  expect(invalid).toBeLessThan(firstPool);
  expect(emptyEnabled).toBeLessThan(firstPool);
  expect(firstPool).toBeLessThan(listen);
  expect(server).not.toMatch(/YELLOW_(?:FISCAL|IRP).*(?:JSON|URL|TOKEN|SECRET|PASSWORD)/);
  expect(ci).toContain('q203_database="yellow_order440_q203_ci"');
  expect(ci).toContain("YELLOW_ORDER440_HTTP_DEPLOY_DATABASE_URL");
  expect(ci).toContain("YELLOW_ORDER440_HTTP_RUNTIME_DATABASE_URL");
  expect(ci).toContain("YELLOW_REQUIRE_ORDER440_HTTP=1");
  expect(ci).toContain("bun test tests/operator-fiscal-submission.integration.test.ts");
});
