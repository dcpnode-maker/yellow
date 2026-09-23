# Order 355 carried-discrepancy lineage readiness — fresh Tier-3 review

**Disposition:** WITHHOLD — CHANGES REQUIRED

**Reviewer:** `/root/order355_final_reviewer`, fresh independent non-implementing Tier-3

**Exact product candidate:** `40eed2b7d4a32a114121023688b9561a052b5c8d`

**Exact governance:** `cafd6d95927c11e34c7984aa665ac6d7150c8578`

## Blocking finding

The carried-lineage readiness query validates `source_business_date` only by finding
an existing same-tenant/property `business_day` and by recomputing a self-consistent
migration0063 request hash. It does not bind the immutable carry link's source
property/date to the source discrepancy's exactly one canonical typed
`discrepancy.reported` event. That permits a forged but internally self-consistent
source-date lineage to be treated as a known unresolved blocker.

On a fresh isolated PostgreSQL 16.15 database, the reviewer executed a valid governed
carry, created a third same-property business day, changed only the immutable test
link's `source_business_date` from the canonical reported date to that third date,
and recomputed `request_hash` with the exact migration0063 formula and typed link
state. The target readiness result was **unresolvedDiscrepancies 1** and
**unknownAttribution 0**; fail-closed behavior requires **0** and at least **1**.
The reviewer-only exact case therefore failed **0/1** at its expected-unresolved
assertion (`expected 0, received 1`). This violates Order355 P3's exact source-date
containment and its requirement that foreign or mismatched lineage remain unknown.

The repair must bind carried attribution to the source discrepancy's exactly one
canonical typed `discrepancy.reported` event and require exact tenant, aggregate,
source discrepancy id, property and source business date agreement without trusting
payload JSON. A permanent hostile case must preserve the third existing day and
recomputed hashes and prove fail-closed behavior. Any repair requires a separately
scoped order and a different fresh Tier-3 review.

## Reviewer-executed evidence

- Detached clean checkout at governance `cafd6d9`; product diff confirmed exact
  candidate `40eed2b`, and candidate bytes were restored after every reviewer-only
  mutation.
- Fresh isolated package PostgreSQL **16.15** cluster, UTC, migrations 1–63 and
  disposable database/roles.
- Exact readiness plus carry matrix: **26/0 (1,968 assertions)**.
- Mutation sensitivity: removing only
  `carry.request_hash = canonical.request_hash` made the isolated hostile case red
  **0/1** (`expected unresolved 0, received 1`); production restored with SHA-256
  `6371E34202954D25A9AC4927ED6FEB3F649760C8E71B020FD89E12217CC70B9F`.
- Reviewer-only source-date/event-binding exploit reproduced as described above;
  permanent test restored with SHA-256
  `289D4B803001C5B8353543FC60DA1C28A049D84E3845FB036E395AF6F2E9FA9F`.
- Typecheck, 139-file boundaries, 23-package licence policy, production audit and
  candidate diff hygiene passed.
- A broad standing attempt produced 1,216 pass, 948 expected skips and one unrelated
  Order239 five-second timeout while an official upstream PostgreSQL build consumed
  the host. The isolated rerun also exceeded five seconds under that contention.
  This is not relied upon as approval evidence.
- The official upstream PostgreSQL 16.15 archive checksum passed, but its build and
  the remaining broad gates were deliberately stopped after the reproducible P3
  defect made approval impossible. Prior checkpoints are context, not substituted
  reviewer proof.

No product or permanent test candidate was edited. Order355 is not approved or
closed. Stable port3000 and `.yellow` were untouched; only disposable reviewer
resources are removed.
