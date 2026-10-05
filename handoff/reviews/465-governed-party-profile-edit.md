# Order 465 — review and verification record

**Date:** 2026-09-20  
**Implementation status:** in progress; not approved for live use.

## Independent source review

An independent reviewer initially rejected the candidate because its update event
always named both fields, its replay reread mutable current state, its omitted
`legalName` semantics were ambiguous, and database proof was incomplete. The
candidate was revised to derive actual changed fields, return a stable receipt
shape, and preserve an omitted legal name. The revised candidate still requires a
fresh independent review and executed database proof.

## Local checks executed by implementer

```text
bun run typecheck                         PASS
bun test tests/party-profiles.integration.test.ts
                                          0 pass, 9 skip, 0 fail
```

The integration suite correctly skipped because no isolated test database variables
were available. That result is not acceptance evidence.

## Isolated database attempt

A newly named isolated database was created on the local native PostgreSQL cluster.
The current source migrations began successfully but stopped at migration 0012 with
the source guard reporting an active `yellow_runtime` session. The active session is
the separately serving public demo; it was not interrupted. No test fixture, Party
update, review seed, or public-demo data change was executed.

The disposable database must be removed only after a safe independent-cluster or
admitted-template proof route is selected. It must not be repurposed as a public
demo database.

## Executed isolated-cluster test

The independent-loopback PostgreSQL cluster subsequently migrated through the
current migration frontier and ran the focused suite with the deploy and runtime
identities separated.

```text
8 pass, 1 fail, 119 expectations
```

The failing case was the new Party update and failed with `SQLSTATE 42501`:
`permission denied for table party`. This is the intended runtime privilege boundary,
not a test-environment fault: the runtime identity cannot directly update `party`.
The existing implementation must therefore not be promoted. A new migration-backed,
security-definer governed Party-update command is required; it must preserve the
runtime privilege denial and produce the fact/outbox evidence in one transaction.
