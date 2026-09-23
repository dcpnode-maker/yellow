# Review 264 — Promote Orders262–263 to the sole local app

**Reviewer:** independent non-operating Codex Tier-3 reviewer (`/root/order263_independent_review`)
**Decision:** CHANGES REQUIRED
**Date:** 2026-08-29
**Reviewed commit:** `f715724922e74fdaa75f684e76bd0cbeb58b5305`
**Authority:** Order264 / D-684 / D-685 only

## Blocking finding

Order264 cannot be approved because this independent verification exposed protected
application environment values in agent/tool output.

While attempting to reproduce D-685's protected-environment SHA-256, the reviewer's
PowerShell hash-function name collided with the built-in `h` / `Get-History` alias.
The resulting type-conversion error rendered the input text, including protected
credentials and secrets, into the tool log. This violated Order264's explicit rule
that no credential value may enter logs or review output. None of those values is
repeated or persisted in this review record.

The incident was reported immediately to the coordination owner. Protected-value
inspection stopped, and no authentication attempt was made afterward. No Git,
container, image, runtime, database, cache or volume mutation occurred during this
review. Nevertheless, the exposed credentials and secrets must be treated as
compromised within agent/tool logs. They require rotation under separate authorized
governance, followed by a fresh app promotion if required and a new independent
verification using a logging-safe harness. Order264 remains unapproved until that
work is complete.

Because inspection stopped at the incident boundary, this review does not claim
independent completion of the protected-environment hash comparison, populated root
document, internal authentication, two-property authenticated status, or direct
3002/3188 port probes.

## Completed non-secret read-only evidence

The following evidence was completed before inspection stopped. It does not cure the
blocking exposure.

### Git, image and source identity

- The repository was clean on branch `phase-7/promote-orders262-263-local` at exact
  commit `f715724922e74fdaa75f684e76bd0cbeb58b5305` before this review record.
- The promotion commit changes governance/evidence only relative to Order263; the
  three promoted production files are byte-identical to clean candidate commit
  `10f78fa`.
- The running app is container
  `cadd8c3bded8bbe5df9259ba056a202d2a30116ae99ebebdc0008b95788a5e6b`,
  healthy with zero restarts, from exact candidate image
  `sha256:83a7bb59bd702c3b8fefab26338d2273f293d32b802915fe9034bae21e057c93`.
- Running-image and committed-working-tree SHA-256 values match exactly:
  - `src/project-status.ts` —
    `063aafb2369e6bc87478b70488cd8d651b8406ef3f500649476aa06ce233e2f8`;
  - `src/http/operator.ts` —
    `4cd3e2eae73e1e94d0bfbfdb01ff363de4ee2271e3c39cdace416170aea19843`;
  - `src/http/operator/operator.js` —
    `6d4015b4a2cb46c4c5695dcad0b984d6d183d51b3451937eb53421cf15a6fdde`.

### Container and retained-volume continuity

- PostgreSQL is the exact healthy zero-restart container
  `b0a92182a16a0cb1f5ac4c33fabb73bce498a2f84622007370d7e30695bc0d0f`.
- Valkey is the exact healthy zero-restart container
  `ae62afc8df693ee4cb646007317dbbfe120884278752d16817a72f716c402834`.
- PostgreSQL retains exact named volume
  `yellow-order175-folio-responsive-containment_yellow-pgdata` at
  `/var/lib/postgresql/data`.
- Native Docker had exactly one running app, one running PostgreSQL and one running
  Valkey for the project. The app was published only as
  `127.0.0.1:3000->3000/tcp`. A separate WSL Docker daemon contained only an exited
  PostgreSQL/Valkey pair with no app and no published port; it was not a second
  running local application.

### Backup and rollback

- `D:\Yellow\backups\yellow-pre-order264-20260829T011005Z.dump` exists and is
  741,065 bytes with SHA-256
  `cec27896e2f77d80b27a692c840e190fd370463b7656da4cd47632fe5321bda0`.
- The dump is owned by `ASTHA\astha`, has protected inheritance and exactly two
  non-inherited FullControl allow rules: the owner and `NT AUTHORITY\SYSTEM`.
- PostgreSQL 16.15 `pg_restore -l` read the dump successfully: 1,320 total catalogue
  lines containing 1,305 numbered TOC records. D-685's “1,320 entries” is therefore
  a total-line count; readability and the recorded total are reproduced.
- Rollback tag `yellow-order264-rollback:pre-orders262-263` resolves to exact prior
  image
  `sha256:dab955b933ed92854c66cb9e87655d8d41a51c95805eda26890b7c8d3cc738b6`.

### Read-only PostgreSQL preservation

Every database command used `PGOPTIONS=-c default_transaction_read_only=on` and
contained only catalogue/count SELECTs.

- Migration ledger is exactly 44 rows, minimum 1 and maximum 44.
- Public catalogue is exactly 98 tables and 88 RLS policies.
- Exactly two property nodes remain.
- Migration44 is
  `0044_governed_positive_tax_posting.sql` with checksum
  `5ea338b18aabb3cb2c5a4613c00ebf57806be881b956b13df1e2c95262cce55c`.
- Counts were independently read for all 98 public tables in canonical table order.
  Their no-trailing-newline SHA-256 is exactly D-685's
  `739b6a2d929a2278064e35935351f32fcc9290c16da2db9b5072e9640ed28763`.

## Required remediation and re-review

1. Rotate every protected application credential or secret that appeared in the
   verification log under a separate founder-authorized order; Order264 itself does
   not authorize that mutation.
2. Reconcile/redeploy the sole local app through the governed rotation/promotion
   order while preserving database, cache and volume truth.
3. Run a fresh independent non-operating review from a logging-safe harness. It must
   complete protected-environment byte-hash comparison, masked/no-store populated
   root proof, internal authentication, both exact property snapshots, served helper
   behavior and direct 3000/3002/3188 containment without rendering protected values.

Apart from this review record, the reviewer wrote no repository file.
