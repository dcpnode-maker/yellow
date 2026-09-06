import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

test("Q203 intentional red: authenticated fiscal request and retry edges are composed but transport stays inactive", () => {
  const operator = readFileSync(new URL("../src/http/operator.ts", import.meta.url), "utf8");
  const app = readFileSync(new URL("../src/app.ts", import.meta.url), "utf8");
  const server = readFileSync(new URL("../src/server.ts", import.meta.url), "utf8");
  const ci = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");

  expect(operator).toContain("requestFiscalSubmission");
  expect(operator).toContain("retryFiscalSubmission");
  expect(app).toContain('properties/:property/fiscal-submissions"');
  expect(app).toContain("fiscal-submissions/:submission/retry");
  expect(server).toContain("new FiscalSubmissionAdapterAvailabilityService([])");
  expect(server).not.toContain("FiscalSubmissionWorker");
  expect(server).not.toContain("VerifiedIndiaIrpAdapterRegistry");
  expect(ci).toContain('q203_database="yellow_order440_q203_ci"');
  expect(ci).toContain("YELLOW_ORDER440_HTTP_DEPLOY_DATABASE_URL");
  expect(ci).toContain("YELLOW_ORDER440_HTTP_RUNTIME_DATABASE_URL");
  expect(ci).toContain("YELLOW_REQUIRE_ORDER440_HTTP=1");
  expect(ci).toContain("bun test tests/operator-fiscal-submission.integration.test.ts");
});
