import { SQL } from "bun";

export type Phase3DatabaseProof = Readonly<{
  databaseName: string;
  testFile: string;
  requireEnv: string;
  urlEnv: string;
  passwordEnv: string | null;
}>;

export type Phase3GateProcess = Readonly<{
  kind: "migrate" | "test";
  label: string;
  testFile: string;
  command: readonly string[];
  env: Readonly<Record<string, string>>;
}>;

/** Deployment tooling and application proofs intentionally use distinct DSNs. */
export type Phase3GateDatabaseUrls = Readonly<{
  deployUrl: string;
  runtimeUrl: string;
}>;

export interface Phase3GateHarness {
  recreateDatabase(adminUrl: string, databaseName: string): Promise<void>;
  runProcess(process: Phase3GateProcess): Promise<number>;
  dropDatabase(adminUrl: string, databaseName: string): Promise<void>;
}

export const PHASE_3_DATABASE_PROOFS: readonly Phase3DatabaseProof[] = Object.freeze([
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
  {
    databaseName: "yellow_ci_p5_app_role_nonlogin",
    testFile: "tests/app-role-nonlogin.integration.test.ts",
    requireEnv: "YELLOW_REQUIRE_APP_ROLE_NONLOGIN",
    urlEnv: "YELLOW_APP_ROLE_NONLOGIN_URL",
    passwordEnv: null,
  },
  {
    databaseName: "yellow_ci_p5_actor_idempotency",
    testFile: "tests/operator-idempotency-actor.integration.test.ts",
    requireEnv: "YELLOW_REQUIRE_OPERATOR_IDEMPOTENCY_ACTOR",
    urlEnv: "YELLOW_OPERATOR_IDEMPOTENCY_ACTOR_URL",
    passwordEnv: "YELLOW_OPERATOR_IDEMPOTENCY_ACTOR_PASSWORD",
  },
  {
    databaseName: "yellow_ci_p5_business_day_seal",
    testFile: "tests/business-day-seal-authority.integration.test.ts",
    requireEnv: "YELLOW_REQUIRE_BUSINESS_DAY_SEAL",
    urlEnv: "YELLOW_BUSINESS_DAY_SEAL_URL",
    passwordEnv: null,
  },
  {
    databaseName: "yellow_ci_p5_reservation_parent",
    testFile: "tests/reservation-parent-before-occupancy.integration.test.ts",
    requireEnv: "YELLOW_REQUIRE_RESERVATION_PARENT",
    urlEnv: "YELLOW_RESERVATION_PARENT_URL",
    passwordEnv: null,
  },
  {
    databaseName: "yellow_ci_p5_runtime_database_authority",
    testFile: "tests/runtime-database-authority.integration.test.ts",
    requireEnv: "YELLOW_REQUIRE_RUNTIME_AUTHORITY_P0",
    urlEnv: "YELLOW_RUNTIME_AUTHORITY_P0_URL",
    passwordEnv: null,
  },
  {
    databaseName: "yellow_ci_p5_runtime_dml_authority",
    testFile: "tests/runtime-dml-authority.integration.test.ts",
    requireEnv: "YELLOW_REQUIRE_RUNTIME_DML",
    urlEnv: "YELLOW_RUNTIME_DML_URL",
    passwordEnv: null,
  },
]);

const DATABASE_NAME = /^[a-z][a-z0-9_]{0,62}$/;

export function validatePhase3GateInputs(deployUrl: string, runtimeUrl: string, password: string): Phase3GateDatabaseUrls & {
  password: string;
} {
  const parse = (value: string, label: string): URL => {
    if (!value || value !== value.trim()) throw new Error(`${label} must be an exact URL`);
    let parsed: URL;
    try { parsed = new URL(value); } catch { throw new Error(`${label} must be a valid PostgreSQL URL`); }
    if (!new Set(["postgres:", "postgresql:"]).has(parsed.protocol)) throw new Error(`${label} must use PostgreSQL`);
    if (!parsed.hostname || !parsed.pathname || parsed.pathname === "/") throw new Error(`${label} must name a database`);
    if (parsed.search || parsed.hash) throw new Error(`${label} must not contain query or fragment data`);
    return parsed;
  };
  const deploy = parse(deployUrl, "YELLOW_PHASE3_GATE_DEPLOY_URL");
  const runtime = parse(runtimeUrl, "YELLOW_PHASE3_GATE_RUNTIME_URL");
  if (!password || password !== password.trim() || password.length < 16) {
    throw new Error("Phase-3 proof password must be at least 16 exact characters");
  }
  if (deploy.username === runtime.username && deploy.password === runtime.password) {
    throw new Error("Phase-3 deploy and runtime URLs must use distinct credentials");
  }
  return { deployUrl, runtimeUrl, password };
}

function quoteDatabaseName(databaseName: string): string {
  if (!DATABASE_NAME.test(databaseName)) {
    throw new Error(`invalid fixed Phase-3 proof database name: ${databaseName}`);
  }
  return `"${databaseName}"`;
}

export function databaseUrlFor(adminUrl: string, databaseName: string): string {
  quoteDatabaseName(databaseName);
  const parsed = new URL(adminUrl);
  parsed.pathname = `/${databaseName}`;
  return parsed.toString();
}

async function withAdmin(adminUrl: string, operation: (sql: SQL) => Promise<void>): Promise<void> {
  const sql = new SQL(adminUrl, { max: 1 });
  try {
    await operation(sql);
  } finally {
    await sql.close();
  }
}

export function createRuntimePhase3GateHarness(): Phase3GateHarness {
  return {
    async recreateDatabase(adminUrl, databaseName) {
      const quoted = quoteDatabaseName(databaseName);
      await withAdmin(adminUrl, async (sql) => {
        await sql.unsafe(`DROP DATABASE IF EXISTS ${quoted} WITH (FORCE)`);
        await sql.unsafe(`CREATE DATABASE ${quoted}`);
      });
    },
    async runProcess(input) {
      console.log(`\n[phase3-gate] ${input.label}`);
      const child = Bun.spawn([...input.command], {
        cwd: process.cwd(),
        env: { ...process.env, ...input.env },
        stdin: "ignore",
        stdout: "inherit",
        stderr: "inherit",
      });
      return await child.exited;
    },
    async dropDatabase(adminUrl, databaseName) {
      const quoted = quoteDatabaseName(databaseName);
      await withAdmin(adminUrl, async (sql) => {
        await sql.unsafe(`DROP DATABASE IF EXISTS ${quoted} WITH (FORCE)`);
      });
    },
  };
}

function checkedExit(input: Phase3GateProcess, exitCode: number): void {
  if (exitCode !== 0) {
    throw new Error(`${input.testFile} failed with exit code ${exitCode} during ${input.kind}`);
  }
}

export async function runPhase3Gate(input: {
  deployUrl: string;
  runtimeUrl: string;
  password: string;
  harness?: Phase3GateHarness;
}): Promise<void> {
  const { deployUrl, runtimeUrl, password } = validatePhase3GateInputs(input.deployUrl, input.runtimeUrl, input.password);
  const harness = input.harness ?? createRuntimePhase3GateHarness();

  for (const proof of PHASE_3_DATABASE_PROOFS) {
    const deployDatabaseUrl = databaseUrlFor(deployUrl, proof.databaseName);
    const runtimeDatabaseUrl = databaseUrlFor(runtimeUrl, proof.databaseName);
    let primaryError: unknown;
    try {
      await harness.recreateDatabase(deployUrl, proof.databaseName);
      const migrate: Phase3GateProcess = {
        kind: "migrate",
        label: `migrate ${proof.testFile}`,
        testFile: proof.testFile,
        command: ["bun", "run", "db:migrate"],
        env: { YELLOW_DEPLOY_DATABASE_URL: deployDatabaseUrl },
      };
      checkedExit(migrate, await harness.runProcess(migrate));

      const suiteEnv: Record<string, string> = {
        [proof.requireEnv]: "1",
        [proof.urlEnv]: deployDatabaseUrl,
        YELLOW_DEPLOY_DATABASE_URL: deployDatabaseUrl,
        YELLOW_RUNTIME_DATABASE_URL: runtimeDatabaseUrl,
      };
      if (proof.passwordEnv) suiteEnv[proof.passwordEnv] = password;
      const suite: Phase3GateProcess = {
        kind: "test",
        label: proof.testFile,
        testFile: proof.testFile,
        command: ["bun", "test", proof.testFile],
        env: suiteEnv,
      };
      checkedExit(suite, await harness.runProcess(suite));
    } catch (error) {
      primaryError = error;
    }

    try {
      await harness.dropDatabase(deployUrl, proof.databaseName);
    } catch (cleanupError) {
      if (!primaryError) throw cleanupError;
      console.error(`[phase3-gate] cleanup also failed for ${proof.testFile}`, cleanupError);
    }
    if (primaryError) throw primaryError;
  }

  console.log(`\n[phase3-gate] ${PHASE_3_DATABASE_PROOFS.length}/${PHASE_3_DATABASE_PROOFS.length} suites passed with isolated databases`);
}

export async function main(): Promise<void> {
  await runPhase3Gate({
    deployUrl: process.env.YELLOW_PHASE3_GATE_DEPLOY_URL ?? "",
    runtimeUrl: process.env.YELLOW_PHASE3_GATE_RUNTIME_URL ?? "",
    password: process.env.YELLOW_PHASE3_GATE_PASSWORD ?? "",
  });
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error("[phase3-gate] FAILED", error);
    process.exit(1);
  }
}
