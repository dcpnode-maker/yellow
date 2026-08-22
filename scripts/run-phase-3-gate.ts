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
]);

const DATABASE_NAME = /^[a-z][a-z0-9_]{0,62}$/;

export function validatePhase3GateInputs(adminUrl: string, password: string): {
  adminUrl: string;
  password: string;
} {
  if (!adminUrl || adminUrl !== adminUrl.trim()) {
    throw new Error("YELLOW_PHASE3_GATE_ADMIN_URL must be an exact admin URL");
  }
  let parsed: URL;
  try {
    parsed = new URL(adminUrl);
  } catch {
    throw new Error("YELLOW_PHASE3_GATE_ADMIN_URL must be a valid PostgreSQL URL");
  }
  if (!new Set(["postgres:", "postgresql:"]).has(parsed.protocol)) {
    throw new Error("YELLOW_PHASE3_GATE_ADMIN_URL must use PostgreSQL");
  }
  if (!parsed.hostname || !parsed.pathname || parsed.pathname === "/") {
    throw new Error("YELLOW_PHASE3_GATE_ADMIN_URL must name an admin database");
  }
  if (parsed.search || parsed.hash) {
    throw new Error("YELLOW_PHASE3_GATE_ADMIN_URL must not contain query or fragment data");
  }
  if (!password || password !== password.trim() || password.length < 16) {
    throw new Error("Phase-3 proof password must be at least 16 exact characters");
  }
  return { adminUrl, password };
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
  adminUrl: string;
  password: string;
  harness?: Phase3GateHarness;
}): Promise<void> {
  const { adminUrl, password } = validatePhase3GateInputs(input.adminUrl, input.password);
  const harness = input.harness ?? createRuntimePhase3GateHarness();

  for (const proof of PHASE_3_DATABASE_PROOFS) {
    const databaseUrl = databaseUrlFor(adminUrl, proof.databaseName);
    let primaryError: unknown;
    try {
      await harness.recreateDatabase(adminUrl, proof.databaseName);
      const migrate: Phase3GateProcess = {
        kind: "migrate",
        label: `migrate ${proof.testFile}`,
        testFile: proof.testFile,
        command: ["bun", "run", "db:migrate"],
        env: { DATABASE_URL: databaseUrl },
      };
      checkedExit(migrate, await harness.runProcess(migrate));

      const suiteEnv: Record<string, string> = {
        [proof.requireEnv]: "1",
        [proof.urlEnv]: databaseUrl,
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
      await harness.dropDatabase(adminUrl, proof.databaseName);
    } catch (cleanupError) {
      if (!primaryError) throw cleanupError;
      console.error(`[phase3-gate] cleanup also failed for ${proof.testFile}`, cleanupError);
    }
    if (primaryError) throw primaryError;
  }

  console.log(`\n[phase3-gate] ${PHASE_3_DATABASE_PROOFS.length}/8 suites passed with isolated databases`);
}

export async function main(): Promise<void> {
  await runPhase3Gate({
    adminUrl: process.env.YELLOW_PHASE3_GATE_ADMIN_URL ?? "",
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
