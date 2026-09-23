import { SQL } from "bun";

export function assertFiscalReplayProofTargets(deploy: string, runtime: string): void {
  const targets = [new URL(deploy), new URL(runtime)];
  for (const [index, target] of targets.entries()) {
    if (!["postgres:", "postgresql:"].includes(target.protocol)
        || target.search !== "" || target.hash !== "" || target.password === ""
        || target.username !== (index === 0 ? "yellow_deploy" : "yellow_runtime")
        || !/^\/yellow_order440_q205_[a-z0-9_]+$/.test(target.pathname)) {
      throw new Error("Fiscal replay proof requires isolated Q205 database authority");
    }
  }
  if (targets[0]!.host !== targets[1]!.host || targets[0]!.pathname !== targets[1]!.pathname) {
    throw new Error("Fiscal replay proof requires matching database targets");
  }
}

export interface FiscalReplayClaim {
  readonly claimed: true;
  readonly claimToken: string;
  readonly attemptId: string;
  readonly documentId: string;
  readonly providerKey: string;
  readonly wireSha256: string;
}

/** Actual runtime capability and reserved transaction, never a transport double. */
export async function claimFiscalReplaySubmission(runtime: SQL, tenantId: string, submissionId: string): Promise<FiscalReplayClaim> {
  return runtime.begin(async (tx) => {
    await tx`SELECT set_config('app.tenant_id',${tenantId},true)`;
    const [row] = await tx<{ receipt: FiscalReplayClaim }[]>`
      SELECT public.claim_india_fiscal_submission(${tenantId}::uuid,${submissionId}::uuid,60) AS receipt
    `;
    if (!row?.receipt.claimed) throw new Error("Fiscal replay fixture claim failed");
    return row.receipt;
  });
}

export async function reconcileFiscalReplaySubmission(
  runtime: SQL, tenantId: string, submissionId: string, claim: FiscalReplayClaim,
  outcome: "known_not_sent" | "accepted" | "rejected",
): Promise<void> {
  const normalized = JSON.stringify({
    type: "transport_result", tenantId, providerKey: claim.providerKey,
    attemptId: claim.attemptId, documentId: claim.documentId,
    payloadSha256: claim.wireSha256, outcome,
    ...(outcome === "known_not_sent" ? {} : {
      authorityRef: `synthetic-q205-${crypto.randomUUID()}`, responseSha256: "c".repeat(64),
    }),
  });
  await runtime.begin(async (tx) => {
    await tx`SELECT set_config('app.tenant_id',${tenantId},true)`;
    await tx`SELECT public.reconcile_india_fiscal_submission(
      ${tenantId}::uuid,${submissionId}::uuid,${claim.attemptId}::uuid,
      ${claim.claimToken}::uuid,${normalized}::jsonb)`;
  });
}

export async function fiscalReplaySnapshot(deploy: SQL, tenantId: string): Promise<readonly string[]> {
  const result: string[] = [];
  for (const table of ["fiscal_submission", "fiscal_submission_history", "fact_log", "outbox",
    "document", "document_series", "journal", "posting_line"] as const) {
    const rows = await deploy.unsafe<{ body: string }[]>(
      `SELECT to_jsonb(source)::text AS body FROM public.${table} source
       WHERE tenant_id=$1::uuid ORDER BY to_jsonb(source)::text`, [tenantId],
    );
    result.push(...rows.map(({ body }) => `${table}:${body}`));
  }
  return Object.freeze(result);
}
