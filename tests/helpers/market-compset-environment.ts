import {
  ORDER472_PROOF_DATABASE,
  ORDER472_PROOF_OPT_IN,
  readMarketCompsetProofEnvironment,
} from "../../scripts/native/prepare-market-compset-proof";

export const MARKET_COMPSET_CI_DATABASE = "yellow_order472_market_ci";
const CI_MODE = "YELLOW_ORDER472_MARKET_COMPSET_CI_MODE";
const DEPLOY_URL = "YELLOW_ORDER472_MARKET_COMPSET_DEPLOY_DATABASE_URL";
const RUNTIME_URL = "YELLOW_ORDER472_MARKET_COMPSET_RUNTIME_DATABASE_URL";
const REGISTRAR_URL = "YELLOW_ORDER472_MARKET_COMPSET_REGISTRAR_DATABASE_URL";

export interface MarketCompsetIntegrationEnvironment {
  readonly mode: "native" | "ci";
  readonly database: typeof ORDER472_PROOF_DATABASE | typeof MARKET_COMPSET_CI_DATABASE;
  readonly deployDatabaseUrl: string;
  readonly runtimeDatabaseUrl: string;
  readonly registrarDatabaseUrl: string;
}

function fail(code: string): never {
  throw new Error(code);
}

function ciAddress(value: string | undefined): string {
  const match = /^127\.0\.0\.1:([1-9]\d{0,4})$/u.exec(value ?? "");
  if (!match || Number(match[1]) > 65_535) fail("market_compset_ci_address_invalid");
  return value!;
}

function ciUrl(value: string | undefined, role: string, address: string, variable: string): string {
  if (typeof value !== "string" || value.length === 0) fail(`market_compset_ci_${variable}_missing`);
  let parsed: URL;
  try { parsed = new URL(value); } catch { fail(`market_compset_ci_${variable}_invalid`); }
  let username = "";
  try { username = decodeURIComponent(parsed.username); } catch { fail(`market_compset_ci_${variable}_invalid`); }
  const [host, port] = address.split(":");
  if ((parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:")
    || parsed.hostname !== host || parsed.port !== port || username !== role
    || parsed.pathname !== `/${MARKET_COMPSET_CI_DATABASE}` || parsed.search !== "" || parsed.hash !== "" || parsed.password.length === 0) {
    fail(`market_compset_ci_${variable}_invalid`);
  }
  return value;
}

/**
 * Tests-only selector. Native mode delegates byte-for-byte authority validation to
 * the immutable native preparer; CI mode is a separately named, loopback-only
 * ephemeral authority and can never fall back to a generic database variable.
 */
export function readMarketCompsetIntegrationEnvironment(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): MarketCompsetIntegrationEnvironment {
  if (environment[ORDER472_PROOF_OPT_IN] !== "1") fail("market_compset_integration_not_opted_in");
  const mode = environment[CI_MODE];
  if (mode === undefined) {
    if (environment.CI === "true" || environment.GITHUB_ACTIONS === "true") fail("market_compset_integration_mode_ambiguous");
    const native = readMarketCompsetProofEnvironment(environment);
    return Object.freeze({ mode: "native", database: ORDER472_PROOF_DATABASE,
      deployDatabaseUrl: native.deployDatabaseUrl, runtimeDatabaseUrl: native.runtimeDatabaseUrl,
      registrarDatabaseUrl: native.registrarDatabaseUrl });
  }
  if (mode !== "1" || environment.CI !== "true" || environment.GITHUB_ACTIONS !== "true") {
    fail("market_compset_integration_mode_invalid");
  }
  const address = ciAddress(environment.POSTGRES_ADDRESS);
  return Object.freeze({ mode: "ci", database: MARKET_COMPSET_CI_DATABASE,
    deployDatabaseUrl: ciUrl(environment[DEPLOY_URL], "yellow_deploy", address, "deploy_url"),
    runtimeDatabaseUrl: ciUrl(environment[RUNTIME_URL], "yellow_runtime", address, "runtime_url"),
    registrarDatabaseUrl: ciUrl(environment[REGISTRAR_URL], "yellow_extension_registrar", address, "registrar_url") });
}
