# ORDER 468 — live synthetic reconciliation deployment

**Phase:** 0 · **Branch:** `phase-0/live-synthetic-reconciliation-deployment` · **Written by:** Codex · **Date:** 2026-09-20

## Goal

Apply the independently accepted migrations 0092 and 0093 to the currently served,
private-loopback Yellow Demo database, execute the accepted offline synthetic
`ARR-CLEAN` reconciliation once through the runtime role, and collect an
independent current-target proof without resetting, reseeding or altering any
non-Party operational record.

## Scope

- The runtime migration runner, using its existing private deployment environment.
- The accepted `scripts/reconcile-synthetic-clean-arrival.ts` command, using the
  existing private runtime environment.
- Read-only current-target pre/post evidence and
  `handoff/reviews/468-live-synthetic-reconciliation-deployment.md`.
- This deployment order document only.

## Required sequence

1. Read-only preflight: verify the serving runtime’s recorded database identity,
   schema-migration ledger frontier/checksums, loopback-only listener and the one
   expected synthetic Party/reservation/role shape using booleans/counts/hashes only.
2. Abort if the frontier is not exactly 91, migration ledger does not match the
   accepted 0092/0093 source history, or the target is not the recorded synthetic
   demo database. Never guess or repair a different target.
3. Run the normal migration runner once using the private deploy environment; record
   only versions applied and exit status. It must apply exactly 0092 and 0093.
4. Run the reconciler once using the private runtime environment; record only
   changed/no-op and changed-field count. Never log raw Party values or URLs.
5. Read-only postflight: prove frontier 93 and correct checksums; Party/reservation/
   guest-role structural integrity; exactly the allowed new fact/outbox event shape;
   no deltas to reservation, segment, guest, contact, occupancy, account, folio,
   journal, posting, payment, document, identity or unrelated Party records.
6. A nonimplementing reviewer personally executes the current-target read-only
   pre/post proof. The public endpoint must remain healthy.

## Forbidden

- Any reset, restore, clone replacement, seed/reseed, review-provisioner execution,
  generic Party edit, direct Party SQL update, or public URL/credential disclosure.
- Any change to reservations, roles, contacts, occupancy, financial, document,
  identity, user, provider, tunnel or application runtime configuration.
- Treating a successful migration alone as demo readiness or Order 461 acceptance.
