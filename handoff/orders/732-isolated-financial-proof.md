# Order732 — isolate financial proof from inherited cluster-role drift

Nonimplementer guest_contract709 found Order727's retained proof database shares a
cluster with yellow_runtime INHERIT and app_role membership inherit=true, contrary
to canonical authority provisioning. The exact function ACL remains correct.
Do not alter that shared cluster or its roles to make a test pass.

## Scope / independent owner

- Reviewer guest_contract709 initially owned D:/Yellow/temp/order732/ proof helper/artifacts
  and handoff/reviews/732-isolated-financial-proof.md. Root owns this order,
  docs/PROJECT-STATUS.md and handoff/LEDGER.md.
- One disposable PostgreSQL18.6 local Docker container named
  yellow-order732-financial-proof, loopback-only port55434 if free. Use existing
  official image, <=512MiB memory,1CPU, diagnostics bounded, no restart policy.
  No serving database/volumes/networks/configuration/credentials are reused.
  New transient proof credentials stay in process memory/container env, never logs
  or git. Root may inspect generated redacted receipt but not credentials.
- Apply existing canonical provision-local-database-authority.ts and migration
  runner only to the exact new instance/database. No source migrations changes.
- Personally run the three727 financial suites and required flags sequentially;
  confirm canonical NOINHERIT and exact role/ACL expectations. Record original
  failure and fresh proof separately; fresh success does not remediate serving
  cluster authority drift or imply production readiness.
- Stop/remove only this owned proof container after identity/label verification.
  Synthetic database is disposable; no source or serving data deletion. If port,
  resource or canonical setup fails, stop and report rather than widen scope.

No local app promotion, grants changed in existing cluster, public tunnel, provider
activation or financial actions against hotel data are authorized by this order.

## Bounded setup retry after observed readiness error

The first attempt used pg_isready without -h: it detected the official image's
temporary bootstrap Unix-socket server before the final TCP listener was ready.
Provisioning returned Connection closed; no migrations or fixtures were applied.
Root authorizes one fresh attempt with all original isolation/resource constraints.
Require a successful host-side Bun SQL SELECT 1 against exact loopback55434 and
database identity before invoking the unchanged canonical provisioner. Bound this
readiness loop to60seconds with short per-connection timeout. Do not use --rm until
bounded redacted container logs and proof results have been captured. Finally
identity-check, stop and remove only this owned disposable container. No shared
role/schema repair or production-readiness claim is admitted by this retry.

Root reassigned the unstarted bounded retry to independent financial_proof732 after
interrupting guest_contract709. Only the new reviewer may use this container name
now; no overlapping proof processes. The new reviewer must personally execute the
tests and record results in the same732 review, retaining the first failed attempt.
Order727 final independent source/proof record is also assigned to this reviewer;
they did not implement any727 application or tests.

Handoff correction: previous reviewer's last command completed exit1 before role
provisioning because runtime/registrar password environment variables were unset.
Host TCP SELECT1 and exact DB/role identity DID pass. Its already-started retry
container49b670a09658ee2f55fdde7d0d64fbbfe442a306707d8b9ab1bded67d09a3a9f
remains, with original guest_contract709/order732 labels and no running script.
financial_proof732 takes exclusive ownership of that exact instance instead of
starting a third instance. The proof-only deploy credential may be read internally
from that container environment, never printed or persisted. Generate new unique
runtime/registrar credentials in process memory and run canonical setup/proofs.
Cleanup accepts the exact recorded original labels/ID after verifying them.
