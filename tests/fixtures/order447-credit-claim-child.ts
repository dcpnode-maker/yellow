import { SQL } from "bun";
import { FiscalSubmissionRepository } from "../../src/contexts/tax-fiscal";
import { assertCreditSubmissionTargets, parseCreditSubmissionTargetMode } from "./india-native-credit-submission-fixture";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HASH = /^[0-9a-f]{64}$/;

/** Pure validation: the child receives no deploy credential and cannot provision a target. */
export function parseCreditClaimChildEnvironment(env: Readonly<Record<string, string | undefined>>) {
  if (env.YELLOW_REQUIRE_ORDER447_RECOVERY !== "1") throw new Error("Order447 claim child requires explicit admission");
  const mode = parseCreditSubmissionTargetMode(env.YELLOW_ORDER447_TARGET_MODE);
  const runtimeUrl = env.YELLOW_ORDER447_RUNTIME_DATABASE_URL;
  if (!runtimeUrl) throw new Error("Order447 claim child runtime identity is missing");
  // Shared paired guard without disclosing a deploy password to this runtime-only child.
  const validationOnly = new URL(runtimeUrl);
  validationOnly.username = "yellow_deploy";
  validationOnly.password = "not-a-database-credential";
  assertCreditSubmissionTargets(validationOnly.toString(), runtimeUrl, "runtime", mode,
    env.YELLOW_REQUIRE_ORDER447_CI_CANONICAL === "1", env.YELLOW_ORDER447_CI_DATABASE_ADDRESS);
  const tenantId = env.YELLOW_ORDER447_CHILD_TENANT;
  const submissionId = env.YELLOW_ORDER447_CHILD_SUBMISSION;
  const documentId = env.YELLOW_ORDER447_CHILD_DOCUMENT;
  const wireSha256 = env.YELLOW_ORDER447_CHILD_WIRE_SHA;
  const nonce = env.YELLOW_ORDER447_CHILD_NONCE;
  if (!tenantId || !UUID.test(tenantId) || !submissionId || !UUID.test(submissionId)
      || !documentId || !UUID.test(documentId) || !wireSha256 || !HASH.test(wireSha256)
      || !nonce || !UUID.test(nonce)) throw new Error("Order447 claim child synthetic identity is invalid");
  return Object.freeze({ runtimeUrl, mode, tenantId, submissionId, documentId, wireSha256, nonce });
}

if (import.meta.main) {
  const deadline = setTimeout(() => process.exit(4), 30_000);
  try {
    const input = parseCreditClaimChildEnvironment(process.env);
    const pool = new SQL(input.runtimeUrl, { max: 1, prepare: false, connectionTimeout: 5 });
    const [identity] = await pool<{ username: string; body_sha: string; backend: number }[]>`
      SELECT current_user username,pg_catalog.pg_backend_pid() backend,pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
        pg_catalog.replace(prosrc,chr(13)||chr(10),chr(10)),'UTF8')),'hex') body_sha
      FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure(
        'public.india_fiscal_submission_project_wire(uuid,uuid,uuid)')`;
    if (identity?.username !== "yellow_runtime"
        || identity.body_sha !== "b34eaf0095dad0df5cd55453b7e4bd1a42f5ae698a02c5ebca3dcac7645c9f96") {
      throw new Error("Order447 claim child catalogue differs");
    }
    const result = await new FiscalSubmissionRepository(pool).claim({
      tenantId: input.tenantId, submissionId: input.submissionId, leaseSeconds: 15,
    });
    if (!result.ok || !result.value.claimed || result.value.action !== "submit"
        || result.value.documentId !== input.documentId || result.value.wireSha256 !== input.wireSha256) {
      throw new Error("Order447 child failed to commit its exact credit claim");
    }
    // claim() has awaited COMMIT. There is no adapter, transport or reconciliation in this child.
    // Intentionally terminate without closing the pool: a real process abandons its committed lease.
    process.stdout.write(JSON.stringify({ kind: "committed_credit_claim", nonce: input.nonce,
      documentId: input.documentId, wireSha256: input.wireSha256, backend: identity.backend }) + "\n", () => process.exit(0));
  } catch {
    clearTimeout(deadline);
    process.stderr.write("Order447 claim child failed closed\n", () => process.exit(1));
  }
}
