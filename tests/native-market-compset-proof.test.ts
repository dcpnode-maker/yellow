import { describe, expect, test } from "bun:test";
import {
  ORDER472_PROOF_DATABASE,
  ORDER472_PROOF_OPT_IN,
  readMarketCompsetProofEnvironment,
} from "../scripts/native/prepare-market-compset-proof";

const KEYS = {
  deploy: "YELLOW_ORDER472_MARKET_COMPSET_DEPLOY_DATABASE_URL",
  runtime: "YELLOW_ORDER472_MARKET_COMPSET_RUNTIME_DATABASE_URL",
  registrar: "YELLOW_ORDER472_MARKET_COMPSET_REGISTRAR_DATABASE_URL",
} as const;
const ROLES = {
  deploy: "yellow_deploy", runtime: "yellow_runtime", registrar: "yellow_extension_registrar",
} as const;

function environment(): NodeJS.ProcessEnv {
  return {
    [ORDER472_PROOF_OPT_IN]: "1",
    ...Object.fromEntries(Object.entries(KEYS).map(([name, key]) => [
      key,
      `postgres://${ROLES[name as keyof typeof ROLES]}:synthetic-test-only@127.0.0.1:55503/${ORDER472_PROOF_DATABASE}`,
    ])),
  };
}

describe("Order472 native proof environment boundary (pure; no database connection)", () => {
  test("requires explicit opt-in and all three dedicated authority URLs", () => {
    expect(() => readMarketCompsetProofEnvironment({})).toThrow();
    expect(() => readMarketCompsetProofEnvironment({ ...environment(), [ORDER472_PROOF_OPT_IN]: "0" })).toThrow();
    for (const key of Object.values(KEYS)) {
      const candidate = environment();
      delete candidate[key];
      expect(() => readMarketCompsetProofEnvironment(candidate)).toThrow();
    }
  });

  test("returns frozen exact configuration, without consulting generic database variables", () => {
    const candidate = environment();
    candidate.YELLOW_DEPLOY_DATABASE_URL = "postgres://wrong:synthetic@remote.invalid/live";
    candidate.DATABASE_URL = "postgres://wrong:synthetic@remote.invalid/live";
    const result = readMarketCompsetProofEnvironment(candidate);
    expect(result).toEqual({
      deployDatabaseUrl: candidate[KEYS.deploy]!,
      runtimeDatabaseUrl: candidate[KEYS.runtime]!,
      registrarDatabaseUrl: candidate[KEYS.registrar]!,
    });
    expect(Object.isFrozen(result)).toBe(true);
  });

  test("rejects real/research/template databases, role substitutions and remote connection options", () => {
    for (const name of Object.keys(KEYS) as Array<keyof typeof KEYS>) {
      const candidate = environment();
      const valid = candidate[KEYS[name]]!;
      const variations = [
        valid.replace(ORDER472_PROOF_DATABASE, "yellow_order442_review"),
        valid.replace(ORDER472_PROOF_DATABASE, "yellow_pricelabs_staging"),
        valid.replace(ORDER472_PROOF_DATABASE, "yellow_order434_production"),
        valid.replace("127.0.0.1", "localhost"),
        valid.replace("127.0.0.1", "remote.invalid"),
        valid.replace(":55503/", ":5432/"),
        valid.replace(ROLES[name], "postgres"),
        valid.replace("postgres:", "https:"),
        valid.replace(":synthetic-test-only@", "@"),
        `${valid}?options=-c%20search_path=other`,
        `${valid}#untrusted`,
        `${valid}/extra`,
      ];
      for (const url of variations) {
        expect(() => readMarketCompsetProofEnvironment({ ...candidate, [KEYS[name]]: url })).toThrow();
      }
    }
  });

  test("failure text never includes even synthetic credentials or the rejected destination", () => {
    const candidate = environment();
    candidate[KEYS.deploy] = "postgres://yellow_deploy:private-canary@remote-canary.invalid/live-canary";
    let message = "";
    try { readMarketCompsetProofEnvironment(candidate); } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message.length).toBeGreaterThan(0);
    for (const privateValue of ["private-canary", "remote-canary", "live-canary", "postgres://"]) {
      expect(message).not.toContain(privateValue);
    }
  });
});
