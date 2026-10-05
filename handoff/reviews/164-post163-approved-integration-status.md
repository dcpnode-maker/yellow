# Independent review — Order 164 approved integration and founder status

**Verdict:** APPROVED
**Reviewed candidate:** `fe8662a4cdfa7a9687abcffea1bcf8abd3542525`
**Exact Base:** `2b02e25931747891fc0ee1bff45e11b49433d689`
**Reviewer:** OpenAI Codex, independent non-implementing reviewer
**Date:** 2026-08-26

## Scope and lineage

I did not implement Order164. I read `PROJECT.md`, ran `./state.sh`, read the order,
D-431, the Order162 approval and the Order163 operator/independent evidence, and
applied the repository PostgreSQL and compliance review rules. Exact Base is an
ancestor of the candidate, whose only four descendant commits are Order164 admission,
the Order162 executable cherry-pick, the Order162 evidence cherry-pick and the
two-path status candidate.

The integrated executable `8fceb7890959296eb64578069ef913691782d395` has stable
patch id `79a52cdd6034a29100723b0562bfb000d4fd59dc`, exactly matching approved Order162
executable `e1a97279bab4dfbe22846ff2ec8ac61f5a8d6984`. The approved review markdown in
`a3fe694088bc69c2f5d16b0ccba0b1bfc8f20fbf` is byte-identical to the source review
in `493e5d0619a68bd597227ffbb6fd65292a31abf6` (blob
`81f8d97bd2d885da2c445eb56d9563ad241b9cb5`), and both commits add the identical
Order162 ledger record. The pre-existing Order163 evidence and approved local-runtime
lineage remain intact.

The final candidate changes only `src/project-status.ts` and its focused test. It
records 2026-08-26, built Order163, current Order164, Phase5 active, thirteen phases,
and review-through91. Orders156/160/161/162/163 are historically recorded as
independently approved and Order164 as proof in progress. Phase0-3 remain reviewed,
Phase4 built-unverified, Phase5 active and Phase6-12 planned. Its wording explicitly
keeps reservation-desk UI next and makes no phase-wide or deployment claim.

## Reviewer-executed proof

On exact candidate I personally ran:

- focused status/publication static run: **6 passed, 12 database-gated skips, 0
  failed**, 67 assertions;
- isolated fresh-database matrix: **22/22 suites**, including rate publication
  **11/11**, 99 assertions and founder status **7/7**, 88 assertions;
- standing `bun test`: **181 passed, 465 skipped, 0 failed**, 2,138 assertions across
  98 files;
- `bun run typecheck`; import boundaries over 64 TypeScript files; dependency licence
  policy over 23 installed packages; `bun audit`; exact image-pin validator; all pass;
- static security/import/licence/image/token suite: **45/45**, 169 assertions;
- live schema: exact match to `tests/schema/expected.sql`;
- fresh deployment acceptance: **6/6**, 13 assertions;
- fresh isolated, app-never-started `./setup.sh --db-only`: 85 public tables and
  referee **11 passed, 0 failed of 11**.

Protected SHA-256 values match the manifest: immutable baseline
`fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`, referee
`2afa95bb7c02cd9637ffc9c3df00d1ddf7cfc5d8d31c4fd8fad29b950c1a418d`, and fixture
`bf71d8fc2987126db61ca3105e5d5cb5a4f48b9e2eba09d8b7fc1f3441fd4c62`.

## Discarded precondition and cleanup

The first reviewer setup invocation stopped before resource creation because its WSL
non-login shell could not see the already installed Bun binary. I added the existing
user-local Bun directory to that child process PATH and restarted the complete fresh
proof. The exclusive reviewer PostgreSQL/Valkey containers, network and volume on
loopback ports 5651/6601 were removed after all proof. No reviewer app container was
created or started, and ports 3000/3002 and all Order163 credentials/runtime/rollback
resources were not touched.

## Verdict boundary

Order164 is approved only at immutable candidate
`fe8662a4cdfa7a9687abcffea1bcf8abd3542525` as the clean prerequisite for the next
reservation-desk UI order. This approval does not merge, push, deploy, change the
approved cursor/login behavior, claim reservation UX completion, advance Phase5, or
inflate contiguous independent coverage beyond Order091.
