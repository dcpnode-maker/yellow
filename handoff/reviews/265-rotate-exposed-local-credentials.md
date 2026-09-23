# Review 265 — Rotate exposed sole-local application credentials

**Reviewer:** independent non-operating Codex Tier-3 reviewer (`/root/order265_independent_review`)
**Decision:** APPROVED
**Date:** 2026-08-29
**Reviewed commit:** `86e772e47802b2674546e6a2bde83c16d05cfe43`
**Authority:** Order265 / D-687 / D-688 / D-689 only

## Verdict

Order265 is approved. A fresh constant-output verifier independently proves the
current rotated generation, the protected handoffs, external SCRAM authentication,
canonical local identity, retained database truth and sole-local containment without
printing, serializing, hashing individually, or passing any protected value as a
command-line argument. The stable application, PostgreSQL, Valkey and retained volume
were not restarted, replaced or mutated by this review. Database inspection was
read-only. The two external authentication checks used disposable PostgreSQL client
containers, passed passwords only through standard input inside the container, and
left zero transient containers.

## Independent evidence

### Git, image and stable runtime

- The repository was clean before this review record on branch
  `phase-7/rotate-exposed-local-credentials` at exact commit `86e772e`.
- Relative to incident base `347f24c`, the exact scope is governance/evidence only:
  `BUILD-PLAN.md`, `DECISIONS.log`, `handoff/LEDGER.md` and Order265. No product,
  migration, schema, seed or dependency file changed.
- The exact healthy zero-restart app is `b084c60b9fe6` on approved image
  `sha256:83a7bb59bd702c3b8fefab26338d2273f293d32b802915fe9034bae21e057c93`,
  published only as `127.0.0.1:3000->3000/tcp`.
- PostgreSQL `b0a92182a16a` and Valkey `ae62afc8df69` are healthy with zero
  restarts. PostgreSQL retains exact named volume
  `yellow-order175-folio-responsive-containment_yellow-pgdata` at
  `/var/lib/postgresql/data`.
- The Compose project has exactly one running app, one PostgreSQL and one Valkey.

### Logging-safe protected truth

- Exactly five required rotated categories are present, non-empty, bounded and
  pairwise distinct: runtime database, extension registrar, local review sign-in,
  token signing and hosted-deposit callback.
- The running runtime, registrar and local-review values byte-match their exact
  entries in the two ignored protected handoff files. Deploy and approver values are
  present, distinct from each other and outside the five rotated values.
- The assertion-only record has SHA-256
  `7b621731a9903b63f96463f5710e105b09806992cb2f5e2e63da05163a0ecb8e`.
  This hashes only fixed boolean assertion results, never a protected value.
- Both protected files have protected inheritance and exactly two FullControl
  entries: the owner and `NT AUTHORITY\SYSTEM`.
- The current runtime and registrar credentials each independently authenticated as
  their exact PostgreSQL role from disposable external containers over the Compose
  network's SCRAM path.

### Identity, roles and retained database truth

- The current populated local credential returns HTTP200 through the canonical
  local-login endpoint. The canonical `yellow-demo` review identity remains exactly
  one active row and exactly one local Argon2id record.
- `yellow_runtime` remains LOGIN, connection limit -1, no superuser/create-db/
  create-role/inherit/replication/bypass-RLS authority; the password verifier is
  present. `yellow_extension_registrar` has the same restricted attributes with
  connection limit 4.
- Relevant membership is exactly `app_role -> yellow_runtime`; the registrar has
  zero role membership.
- Every database query used `default_transaction_read_only=on`. Migration ledger is
  exactly 44 rows with versions 1–44, the public catalog is exactly 98 tables and 88
  RLS policies, and exactly two property nodes remain.
- All 98 public-table row counts were read in canonical table-name order. SHA-256 of
  their no-trailing-newline `table=count` serialization is exactly
  `739b6a2d929a2278064e35935351f32fcc9290c16da2db9b5072e9640ed28763`.

### Sole-local application proof

- Root, health, login and every referenced CSS/JavaScript asset return HTTP200.
- Root is `no-store`; its exact login form has one populated tenant, email and
  masked password field, with each populated value matching its private local
  default and autocomplete disabled.
- Authenticated property discovery returns exactly two properties. Each independently
  reports recorded date `2026-08-29`, latest built Order262, current Order263,
  independent review through Order91 and active Phase7.
- Direct probes confirm port3000 open and ports3002/3188 closed. No disposable client
  container or Order265 credential/secret temporary file remains.

## D-689 provenance and bounded limitation

D-689 correctly distinguishes the two earlier localhost-trust attempts from the
final valid proof: PostgreSQL localhost trust could not establish old-password
rejection, while the final rotation used external Compose-network SCRAM and recorded
both new acceptance and immediately prior runtime/registrar rejection. It also
records new local-login acceptance and immediately prior local password/JWT
rejection. The redirection-parser attempt stopped before its transaction and removed
its unused protected temporary files.

This reviewer deliberately did not recover prior protected values from compromised
tool logs or other historical output. Consequently the historical old-value rejection
cannot be personally replayed without violating the logging-safety boundary. That is
an explicit, non-blocking historical limitation: D-689 records the final external
old/new proof, while this independent review personally proves every safely
reproducible current-generation, integrity and containment assertion. No old value is
required for or present in this review record.

Apart from this review record, the reviewer wrote no repository file.
