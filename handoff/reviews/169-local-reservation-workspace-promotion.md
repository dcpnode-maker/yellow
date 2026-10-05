# Independent operational review — Order 169 local reservation-workspace promotion

**Verdict:** APPROVED-LOCALLY
**Reviewed evidence:** `34422233db21a14fe81cd38e51eda27eb7520c0c`
**Approved source:** `ca024eeeebe6560e3e7983c155ee2b344beb1c1d`
**Approved image:** `sha256:acb60c5184255e118472bca3ee36db40f85476db4a864cd0051ba6f1a47e3d65`
**Reviewer:** OpenAI Codex, independent non-operating reviewer
**Date:** 2026-08-26

## Admission and final topology

I did not perform or alter the cutover. I read `PROJECT.md`, ran `./state.sh`, read
Order169, D-436 and the independent Order168 approval, then reviewed exact evidence
commit `3442223`. Its delta from approved Order168 evidence is governance-only: D-436,
the order and one ledger entry. There is no source, package, lockfile, migration,
Compose or schema change.

The final applications are distinct containers on the retained Order163 network:

- port 3000: `cb9f8e9ee85c`, healthy, loopback `127.0.0.1:3000`, image
  `sha256:acb60c...`, zero restarts;
- port 3002: `971da950d179`, healthy, loopback `127.0.0.1:3002`, the same exact image,
  zero restarts.

Both container image IDs equal the approved Order168 image, and the image tag resolves
to that same ID. Their starts preserve the guarded order: 3002 at
`2026-08-25T21:43:29Z`, then 3000 at `21:43:44Z`.

The retained PostgreSQL `3b41170d710a` and Valkey `9ff3e3e55857` remain healthy on
loopback 5643/6590, with unchanged pinned image IDs, zero restarts and original
`18:29:12Z` starts. PostgreSQL still mounts only
`yellow-order163-local-founder-login_yellow-pgdata`; the volume and common network were
created at `18:29:11Z`, before cutover, and remain attached to the final apps and the
same DB/cache containers. Valkey remains intentionally unpersisted. No stage container
or published listener exists on 3103.

## Rollback and protected handoff

The stopped Order165 rollback containers remain exact:

- 3000 rollback `b30bb8c7f13d`, image `sha256:d3615de2...`;
- 3002 rollback `ddf74e9f61ae`, the same exact prior image.

Each retains its original Order163 network and loopback HostConfig binding for its
respective port, ready only after the new peer is stopped. I did not start, restart,
rename or mutate either rollback or active container.

The persistent handoff remains at the Order163 owner worktree path
`.yellow/order163-founder-login.env`, is a regular ignored 187-byte file containing
exactly `YELLOW_REVIEW_PASSWORD` and `YELLOW_REVIEW_APPROVER_PASSWORD`, and its ACL is
only `NT AUTHORITY\SYSTEM:(F)` plus `ASTHA\astha:(F)`. In-memory comparison found zero
matches for either protected value across all four active/rollback container
environments and logs. No value was printed or recorded, and variables were cleared.

## Independent read-only runtime proof

On both 3000 and 3002 I personally executed, without data mutation:

- exact health 200 body `{"status":"ok"}`;
- local login 200, one granted property and authenticated system status 200;
- bounded reservation board 200 with the same six current rows;
- UUID detail 200 with matching UUID and server-provided lifecycle flags;
- current two-night availability search 200 with five bookable offers, all
  `promise=false` and `commit_arbitration_required=true`.

Served HTML, CSS and JavaScript on each port are byte-identical to approved source and
their running container files. Exact SHA-256 values are respectively
`ea4fde10531d...`, `3b351c515a3e...` and `bf66c19dec2d...`. The approved initialized
date and complete workspace code are therefore the exact Order168 assets already given
the full 375/768/1024/1440 Browser and accessibility approval. No additional Browser
mutation was necessary for this topology-only post-cutover review.

## Disclosed reviewer incidents

An initial PowerShell formatting expression failed before inspecting anything. I first
looked for the handoff in the Order169 evidence worktree; it was correctly absent there
and then verified at its persistent Order163 owner path. The first offer probe encoded
PowerShell's nested empty collection ambiguously and returned no bookable option; it
stopped without mutation. Repeating with an explicit empty object array, matching the
JSON API contract, returned five current bookable offers on both ports. These are
review harness incidents, not product findings.

## Verdict boundary

Order169 is **APPROVED-LOCALLY** at evidence `3442223`. This approves only the current
loopback app-only promotion state. It does not authorize source changes, data cleanup,
rollback destruction, public exposure, merge, push or production deployment.
