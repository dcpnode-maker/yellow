/** Q266 explicit market composition; no import-time I/O or authority assignment. */
import type { SQL, ReservedSQL } from "bun";
import {
  MARKET_COMPSET_EXTENSION_TYPE, MARKET_COMPSET_SCHEMA, MARKET_COMPSET_READ_SCOPE, MARKET_COMPSET_WRITE_SCOPE,
  MarketCompsetService, type MarketCompsetDependencies, type MarketRegionalAdmission,
} from "../contexts/distribution";
import { MarketHttpApi } from "../http/market";
import { loadMarketRegionalArtifactCatalog, type MarketRegionalArtifactCatalogResult } from "./market-regional-artifact-loader";

export type MarketWorkbenchConfiguration = Readonly<
  | { readonly enabled: false }
  | { readonly enabled: true; readonly admissions: readonly MarketRegionalAdmission[] }
>;
const STARTUP_FAILURE = "Market workbench deployment configuration is unavailable";
const READINESS_FAILURE = "Market workbench readiness is unavailable";
const AUTHORITY_SIGNATURE = "public.assert_market_compset_authority(uuid,uuid,uuid,text)";
// Exact0092 function body, normalizing Windows line endings only (same release pattern as kernel readiness).
const AUTHORITY_BODY_SHA256 = "29dc4e1c6a905a4258f58dc07f83c592384ef640d762556f41744757dbd3e1e5";

/** Call once, before opening any pool/worker/listener. Never accept request-derived loader options. */
export async function loadMarketWorkbenchConfiguration(
  environment: Readonly<Record<string, string | undefined>>,
  loadCatalog: () => Promise<MarketRegionalArtifactCatalogResult> = loadMarketRegionalArtifactCatalog,
): Promise<MarketWorkbenchConfiguration> {
  try {
    const flag = environment.YELLOW_MARKET_WORKBENCH;
    if (flag === undefined || flag === "" || flag === "0") return Object.freeze({ enabled: false });
    if (flag !== "1" || environment.YELLOW_OPERATOR_WORKBENCH !== "1" || environment.YELLOW_HOSTED_PROVIDER_ONLY === "1") {
      throw new Error(STARTUP_FAILURE);
    }
    const catalog = await loadCatalog();
    if (!catalog.ok || catalog.value.entries.length !== 2
      || catalog.value.entries[0]?.logicalId !== "riyadh" || catalog.value.entries[1]?.logicalId !== "dubai"
      || catalog.value.entries.some(entry => entry.admission.identity.logicalId !== entry.logicalId)
      || catalog.value.entries.reduce((count, entry) => count + entry.admission.artifact.records.length, 0) > 500) {
      throw new Error(STARTUP_FAILURE);
    }
    // The accepted loader owns deeply immutable admissions; only copy its array.
    const admissions = Object.freeze(catalog.value.entries.map(entry => entry.admission));
    return Object.freeze({ enabled: true, admissions });
  } catch { throw new Error(STARTUP_FAILURE); }
}

export function composeMarketWorkbench(
  configuration: MarketWorkbenchConfiguration,
  dependencies: Omit<MarketCompsetDependencies, "admissions">,
): MarketHttpApi | undefined {
  if (!configuration.enabled) return undefined;
  return new MarketHttpApi(new MarketCompsetService({ ...dependencies, admissions: configuration.admissions }));
}

/**
 * Exact global catalog check only, not tenant/property authorization. Caller owns
 * a read-only transaction and SELECT capability (server uses SET LOCAL ROLE app_role).
 * The unchanged kernel release probe establishes runtime identity first. Accepting
 * a supplied transaction also permits hostile-metadata proof with rollback, without
 * committing a changed ACL or impersonating the runtime session.
 */
export async function assertMarketWorkbenchReadiness(tx: SQL | ReservedSQL): Promise<void> {
  try {
    const rows = await tx<Array<{ authorityExact: boolean; schemaExact: boolean; permissionsExact: boolean }>>`
      SELECT
        COALESCE((SELECT
          procedure.prosecdef AND procedure.proowner = 'yellow_owner'::regrole
          AND procedure.proconfig = ARRAY['search_path=pg_catalog, public, pg_temp']::text[]
          AND language.lanname = 'plpgsql' AND procedure.prokind = 'f'
          AND procedure.provolatile = 'v' AND procedure.proparallel = 'u'
          AND NOT procedure.proisstrict AND NOT procedure.proleakproof AND NOT procedure.proretset
          AND procedure.prorettype = 'pg_catalog.bool'::regtype
          AND procedure.proargnames = ARRAY['p_tenant','p_property','p_actor','p_permission']::text[]
          AND procedure.proargdefaults IS NULL AND procedure.provariadic = 0
          AND procedure.proallargtypes IS NULL AND procedure.proargmodes IS NULL
          AND pg_catalog.has_function_privilege('app_role', procedure.oid, 'EXECUTE')
          AND NOT pg_catalog.has_function_privilege('yellow_runtime', procedure.oid, 'EXECUTE')
          AND NOT EXISTS (
            SELECT 1 FROM pg_catalog.aclexplode(COALESCE(procedure.proacl,pg_catalog.acldefault('f',procedure.proowner))) acl
            WHERE acl.grantee NOT IN (procedure.proowner,'app_role'::regrole)
              OR (acl.grantee = 'app_role'::regrole AND (acl.is_grantable OR acl.grantor <> procedure.proowner))
          )
          AND pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
            pg_catalog.replace(procedure.prosrc,chr(13)||chr(10),chr(10)), 'UTF8'
          )), 'hex') = ${AUTHORITY_BODY_SHA256}
          FROM pg_catalog.pg_proc procedure
          JOIN pg_catalog.pg_language language ON language.oid = procedure.prolang
          WHERE procedure.oid = pg_catalog.to_regprocedure(${AUTHORITY_SIGNATURE})
        ), false) AS "authorityExact",
        COALESCE((SELECT json_schema = ${JSON.stringify(MARKET_COMPSET_SCHEMA)}::text::jsonb
          FROM public.extension_type WHERE type = ${MARKET_COMPSET_EXTENSION_TYPE}), false) AS "schemaExact",
        (SELECT count(*) = 2 AND bool_and(
          (code = ${MARKET_COMPSET_READ_SCOPE} AND description = 'Read confirmed market competitor evidence')
          OR (code = ${MARKET_COMPSET_WRITE_SCOPE} AND description = 'Confirm market competitor evidence')
        ) FROM public.permission WHERE code IN (${MARKET_COMPSET_READ_SCOPE},${MARKET_COMPSET_WRITE_SCOPE})) AS "permissionsExact"
    `;
    const proof = rows[0];
    if (rows.length !== 1 || !proof || Object.keys(proof).length !== 3
      || proof.authorityExact !== true || proof.schemaExact !== true || proof.permissionsExact !== true) {
      throw new Error(READINESS_FAILURE);
    }
  } catch { throw new Error(READINESS_FAILURE); }
}
