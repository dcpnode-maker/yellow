import { describe, expect, test } from "bun:test";

import {
  PHASE_3_DATABASE_PROOFS,
  runPhase3Gate,
  validatePhase3GateInputs,
  type Phase3GateHarness,
  type Phase3GateProcess,
} from "../scripts/run-phase-3-gate";

const ADMIN_URL = "postgres://yellow:yellow@127.0.0.1:55432/postgres";
const PASSWORD = "Order079-Proof-Only!";

function fakeHarness(exitFor: (process: Phase3GateProcess) => number = () => 0) {
  const events: string[] = [];
  const harness: Phase3GateHarness = {
    async recreateDatabase(adminUrl, databaseName) {
      events.push(`create:${adminUrl}:${databaseName}`);
    },
    async runProcess(process) {
      events.push(`run:${process.label}:${process.command.join(" ")}:${JSON.stringify(process.env)}`);
      return exitFor(process);
    },
    async dropDatabase(adminUrl, databaseName) {
      events.push(`drop:${adminUrl}:${databaseName}`);
    },
  };
  return { events, harness };
}

describe("Orders 079/083/104/113 reproducible cumulative database proof runner", () => {
  test("P1: matrix pins every Phase-3 and inherited F11 database proof with exact environment mapping", () => {
    expect(PHASE_3_DATABASE_PROOFS).toEqual([
      {
        databaseName: "yellow_ci_p3_models",
        testFile: "tests/rate-models.integration.test.ts",
        requireEnv: "YELLOW_REQUIRE_RATE_MODELS",
        urlEnv: "YELLOW_RATE_MODELS_URL",
        passwordEnv: null,
      },
      {
        databaseName: "yellow_ci_p3_targeting",
        testFile: "tests/rate-targeting.integration.test.ts",
        requireEnv: "YELLOW_REQUIRE_RATE_TARGETING",
        urlEnv: "YELLOW_RATE_TARGETING_URL",
        passwordEnv: null,
      },
      {
        databaseName: "yellow_ci_p3_publication",
        testFile: "tests/rate-publication.integration.test.ts",
        requireEnv: "YELLOW_REQUIRE_RATE_PUBLICATION",
        urlEnv: "YELLOW_RATE_PUBLICATION_URL",
        passwordEnv: null,
      },
      {
        databaseName: "yellow_ci_p3_quote",
        testFile: "tests/rate-quote.integration.test.ts",
        requireEnv: "YELLOW_REQUIRE_RATE_QUOTE",
        urlEnv: "YELLOW_RATE_QUOTE_URL",
        passwordEnv: null,
      },
      {
        databaseName: "yellow_ci_p3_builder",
        testFile: "tests/operator-rate-builder.integration.test.ts",
        requireEnv: "YELLOW_REQUIRE_OPERATOR_RATE_BUILDER",
        urlEnv: "YELLOW_OPERATOR_RATE_BUILDER_URL",
        passwordEnv: "YELLOW_OPERATOR_RATE_BUILDER_PASSWORD",
      },
      {
        databaseName: "yellow_ci_p3_intent",
        testFile: "tests/operator-rate-intent.integration.test.ts",
        requireEnv: "YELLOW_REQUIRE_OPERATOR_RATE_INTENT",
        urlEnv: "YELLOW_OPERATOR_RATE_INTENT_URL",
        passwordEnv: "YELLOW_OPERATOR_RATE_INTENT_PASSWORD",
      },
      {
        databaseName: "yellow_ci_p3_review_seed",
        testFile: "tests/review-seed.integration.test.ts",
        requireEnv: "YELLOW_REQUIRE_REVIEW_SEED",
        urlEnv: "YELLOW_REVIEW_SEED_URL",
        passwordEnv: "YELLOW_REVIEW_SEED_PASSWORD",
      },
      {
        databaseName: "yellow_ci_p3_founder_status",
        testFile: "tests/founder-status.integration.test.ts",
        requireEnv: "YELLOW_REQUIRE_FOUNDER_STATUS",
        urlEnv: "YELLOW_FOUNDER_STATUS_URL",
        passwordEnv: null,
      },
      {
        databaseName: "yellow_ci_p2_operator_inventory",
        testFile: "tests/operator-inventory.integration.test.ts",
        requireEnv: "YELLOW_REQUIRE_OPERATOR_INVENTORY",
        urlEnv: "YELLOW_OPERATOR_INVENTORY_URL",
        passwordEnv: "YELLOW_OPERATOR_INVENTORY_PASSWORD",
      },
      {
        databaseName: "yellow_ci_p2_operator_rate",
        testFile: "tests/operator-rate-configuration.integration.test.ts",
        requireEnv: "YELLOW_REQUIRE_OPERATOR_RATE",
        urlEnv: "YELLOW_OPERATOR_RATE_URL",
        passwordEnv: "YELLOW_OPERATOR_RATE_PASSWORD",
      },
      {
        databaseName: "yellow_ci_p2_operator_pricing",
        testFile: "tests/operator-rate-pricing.integration.test.ts",
        requireEnv: "YELLOW_REQUIRE_OPERATOR_PRICING",
        urlEnv: "YELLOW_OPERATOR_PRICING_URL",
        passwordEnv: "YELLOW_OPERATOR_PRICING_PASSWORD",
      },
      {
        databaseName: "yellow_ci_p2_operator_correction",
        testFile: "tests/operator-rate-price-correction.integration.test.ts",
        requireEnv: "YELLOW_REQUIRE_OPERATOR_CORRECTION",
        urlEnv: "YELLOW_OPERATOR_CORRECTION_URL",
        passwordEnv: "YELLOW_OPERATOR_CORRECTION_PASSWORD",
      },
      {
        databaseName: "yellow_ci_p2_operator_bulk_rooms",
        testFile: "tests/operator-bulk-rooms.integration.test.ts",
        requireEnv: "YELLOW_REQUIRE_OPERATOR_BULK_ROOMS",
        urlEnv: "YELLOW_OPERATOR_BULK_ROOMS_URL",
        passwordEnv: "YELLOW_OPERATOR_BULK_ROOMS_PASSWORD",
      },
      {
        databaseName: "yellow_ci_p5_financial_postings",
        testFile: "tests/financial-postings.integration.test.ts",
        requireEnv: "YELLOW_REQUIRE_FINANCIAL_POSTINGS",
        urlEnv: "YELLOW_FINANCIAL_POSTINGS_URL",
        passwordEnv: null,
      },
      {
        databaseName: "yellow_ci_p5_security_definer",
        testFile: "tests/security-definer-containment.integration.test.ts",
        requireEnv: "YELLOW_REQUIRE_SECURITY_DEFINER",
        urlEnv: "YELLOW_SECURITY_DEFINER_URL",
        passwordEnv: null,
      },
    ]);
    expect(new Set(PHASE_3_DATABASE_PROOFS.map(({ databaseName }) => databaseName)).size).toBe(15);
  });

  test("P1: inputs fail closed before orchestration", () => {
    expect(() => validatePhase3GateInputs("", PASSWORD)).toThrow("admin URL");
    expect(() => validatePhase3GateInputs("https://example.test/postgres", PASSWORD)).toThrow(
      "PostgreSQL",
    );
    expect(() => validatePhase3GateInputs(ADMIN_URL, "short")).toThrow("password");
    expect(validatePhase3GateInputs(ADMIN_URL, PASSWORD)).toEqual({
      adminUrl: ADMIN_URL,
      password: PASSWORD,
    });
  });

  test("P1: every suite runs migrate then proof sequentially and is force-cleaned", async () => {
    const { events, harness } = fakeHarness();
    await runPhase3Gate({ adminUrl: ADMIN_URL, password: PASSWORD, harness });

    expect(events).toHaveLength(PHASE_3_DATABASE_PROOFS.length * 4);
    for (const [index, proof] of PHASE_3_DATABASE_PROOFS.entries()) {
      const event = events.slice(index * 4, index * 4 + 4);
      expect(event[0]).toBe(`create:${ADMIN_URL}:${proof.databaseName}`);
      expect(event[1]).toContain(`run:migrate ${proof.testFile}:bun run db:migrate:`);
      expect(event[2]).toContain(`run:${proof.testFile}:bun test ${proof.testFile}:`);
      expect(event[2]).toContain(`\"${proof.requireEnv}\":\"1\"`);
      expect(event[2]).toContain(`\"${proof.urlEnv}\":\"postgres://yellow:yellow@127.0.0.1:55432/${proof.databaseName}\"`);
      if (proof.passwordEnv) {
        expect(event[2]).toContain(`\"${proof.passwordEnv}\":\"${PASSWORD}\"`);
      }
      expect(event[3]).toBe(`drop:${ADMIN_URL}:${proof.databaseName}`);
    }
  });

  test("P1: an assertion failure is labelled, cleaned and stops later suites", async () => {
    const failedFile = PHASE_3_DATABASE_PROOFS[1]!.testFile;
    const { events, harness } = fakeHarness((process) =>
      process.kind === "test" && process.testFile === failedFile ? 7 : 0
    );

    await expect(runPhase3Gate({ adminUrl: ADMIN_URL, password: PASSWORD, harness })).rejects.toThrow(
      `${failedFile} failed with exit code 7`,
    );
    expect(events.at(-1)).toBe(
      `drop:${ADMIN_URL}:${PHASE_3_DATABASE_PROOFS[1]!.databaseName}`,
    );
    expect(events.some((event) => event.includes(PHASE_3_DATABASE_PROOFS[2]!.testFile))).toBeFalse();
  });

  test("P1: a migration failure is labelled and cleaned before any suite assertion runs", async () => {
    const failedFile = PHASE_3_DATABASE_PROOFS[0]!.testFile;
    const { events, harness } = fakeHarness((process) => process.kind === "migrate" ? 9 : 0);

    await expect(runPhase3Gate({ adminUrl: ADMIN_URL, password: PASSWORD, harness })).rejects.toThrow(
      `${failedFile} failed with exit code 9 during migrate`,
    );
    expect(events).toHaveLength(3);
    expect(events[1]).toContain(`run:migrate ${failedFile}`);
    expect(events[2]).toBe(`drop:${ADMIN_URL}:${PHASE_3_DATABASE_PROOFS[0]!.databaseName}`);
    expect(events.some((event) => event.startsWith(`run:${failedFile}:bun test`))).toBeFalse();
  });

  test("P1/P3: package and CI use one exact command in the database job", async () => {
    const packageJson = await Bun.file(new URL("../package.json", import.meta.url)).json();
    const workflow = await Bun.file(new URL("../.github/workflows/ci.yml", import.meta.url)).text();
    expect(packageJson.scripts["test:phase3-gate"]).toBe("bun scripts/run-phase-3-gate.ts");
    expect(workflow).toContain("YELLOW_PHASE3_GATE_ADMIN_URL: ${{ env.ADMIN_URL }}");
    expect(workflow).toContain("YELLOW_PHASE3_GATE_PASSWORD: Order079-CI-Proof-Only!");
    const commandIndex = workflow.indexOf("run: bun run test:phase3-gate");
    expect(commandIndex).toBeGreaterThan(workflow.indexOf("Resolve PostgreSQL address through Compose"));
    expect(commandIndex).toBeLessThan(workflow.indexOf("Start application and verify exact health"));
  });
});
