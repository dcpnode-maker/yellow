# Independent operational review — Order 180 single current founder local

**Verdict:** APPROVED LOCALLY — D-462
**Approved product:** `ad0c895ed9aab7a8246d6ec22320de655d8c381b`
**Admission:** `d517003ac32ad73726366ace566096b334521124`
**Runtime image:** `sha256:72a3060ea96602edfda53488be0d7cef7db6b71b7a74c2e74b9ddef6ae00ad99`
**Reviewer:** OpenAI Codex, independent non-operating reviewer
**Date:** 2026-08-26

## Verdict

Order180 is approved for founder-local use with no finding. The only Docker Compose
project or containers present are `yellow-local-current`: one healthy application on
`127.0.0.1:3000`, one healthy PostgreSQL 16 service on loopback 5643 with the named
`yellow-local-current_yellow-pgdata` volume, and one healthy Valkey 8 service on
loopback 6590. Port3002 is unbound. I did not restart, stop, recreate, seed or mutate
the application, database, credentials or Docker resources.

The application image contains exact SHA-256 matches for all 79 runtime source,
package and lock files in the clean admitted worktree. Approved product `ad0c895` is
an ancestor of admission `d517003`; their executable/product delta is empty and the
only admission delta is the order, D-461 and ledger entry.

## Credential and runtime proof

The ignored `.yellow/current-founder-login.env` is a regular file with ACL
inheritance disabled and only `ASTHA\\astha:(F)`. It contains exactly the two expected
operator/approver keys, both present, distinct and 64 characters. In-memory comparison
found neither protected value in any container inspection, container log, image
inspection or image history. No value was printed, recorded or copied into this
review.

Privately reading the operator value produced HTTP 200 login for tenant
`yellow-demo` and `operator@yellow.local`, exactly one granted UTC property, and an
authenticated HTTP 200/no-store Project status. Served truth is app/database
operational, tenant context true, latest built Order178, current Order179 and
independent-review coverage 91; Order178 is explicitly offline and not imported.
The exact `due_in`, `due_out` and `in_house` property-local Today requests each used
`from`, `to` and `limit=50`, returned HTTP 200, and stayed within the 50-row bound.

## Persistent database and journey evidence

A read-only database transaction confirmed 18 applied migrations, 85 public base
tables, zero Order178 scenario-foundation/import markers, and the retained founder
journey: one reservation linked to one `FOL-1` folio and one balanced journal with two
posting lines. Authenticated HTTP independently returned the matching reservation
detail and folio statement with one governed `ROOM` charge and balance 12500 minor
units. The app container's creation/start history proves it restarted after these
artifacts were created while PostgreSQL and its named volume remained running; the
same artifacts were therefore read after restart.

The operator-provided fresh pre-app-start referee evidence was inspected and records
`RESULT: 11 passed, 0 failed of 11` on the new `yellow_test` database after all 18
migrations and the canonical fixture. Every named case TC-12.1/.2/.3/.4/.5, TC-5.6,
TC-7.1, TC-5.4, TC-8.2, TC-13.1 and TC-13.4 passed with exit 0. This risk-tier-2
operational review records that as operator evidence; I did not rerun the mutating
invariant battery against founder data.

## Disclosed review harness incidents

One first read-only SQL query used a nonexistent journal account column and PostgreSQL
aborted that read-only transaction; the corrected query passed. One local hash script
used PowerShell's reserved `$Host` variable and stopped before hashing; the renamed
script then proved all 79/79 files exact. One Docker inventory formatting attempt was
rejected by the CLI before inspection; the direct JSON inventory then proved only the
three current containers. None changed runtime or data.

## Boundary

Approval is limited to this single persistent loopback founder local. It does not
authorize public exposure, a second local, Order178 import, product/schema/seed-code
change, payment, tax, fiscal action, merge, push or production deployment.
