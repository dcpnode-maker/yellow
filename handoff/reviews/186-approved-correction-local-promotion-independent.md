# Order 186 — independent local-promotion review

**Conclusion:** APPROVED LOCALLY
**Governance head reviewed:** `c31eaefa0e7acb1fa780b5f0e96844a9975d0a0f`
**Running candidate image:** `sha256:d778b9b1515c5b56484197032487c1da23a57573a4aba1c2d11e9aff79af4ab2`
**Retained rollback image:** `sha256:10004705c51d569aa2a3dde40c55dc1f2ed03a6e1d20dcc1c5f5b1562f8cf2cc`
**Reviewer:** independent non-operating OpenAI Codex reviewer
**Reviewed:** 2026-08-26

## Boundary

This review was strictly read-only against the current local. It did not restart,
stop, recreate or build a container; run a seed or migration; write the database;
seal a business day; disclose an environment value, password or token; or change any
file before this final governance record. D-481 remains the independently executed
Tier-3 post-seal transaction proof for the identical executable.

## Independent evidence

- Exactly three running containers exist, all in `yellow-local-current`: healthy app,
  PostgreSQL and Valkey. The app binds only `127.0.0.1:3000`; port 3002 is unbound.
  The app reports the exact candidate digest above and the retained prior image reports
  the exact rollback digest above.
- The candidate image is the governance-only Order186 descendant of approved
  candidate `25f11df`. All nine runtime paths changed by Orders183/185 are byte-exact
  against its admitted `b8e9f55` source (zero mismatches). HTTP 200 served HTML, CSS
  and JavaScript are byte-exact to the image with SHA-256 values
  `9329466d69ad8ec7126004552c2181eeecffb1dabfce56bd18c0fc936b62234a`,
  `01679a617bd8bf3a1437249c878444d6532453890ee35c5ad8ad98d62cfc979b` and
  `e191001f69c4e7c1a48b0cbd59095c3663c1219b0f69b2b55ea544d36a76e838`.
  The served catalogue contains exactly Apple, Android, Windows95/98 and Glass
  markers and no retired selector value.
- The pre-operation custom backup is 3,283,996 bytes with SHA-256
  `ab5b22dd65b7420fb264cc21e83cefbfc9f1ef7f54d28734aa1893051486e905`.
  Its ACL inheritance is protected and its sole access rule grants only its owner full
  control. A streamed `pg_restore --list` completed with exit 0 without printing its
  catalogue.
- The persistent migration ledger contains exactly versions 1–19. Version 19 records
  `0019_financial_reversal_authority.sql` and exact checksum
  `40cbd74f4c154ac23f56a1b69edf865c3a5904a98d2264ad6d962671414fcc4d`.
  A fresh read-only PostgreSQL 16 schema dump normalizes byte-exact to
  `tests/schema/expected.sql` (both SHA-256
  `27ef03a03738fc56d3276d4c200607365eb912025b67dfba1ae29ffc3f9a33a7`).
  The unique reversal index and both bounded SECURITY DEFINER functions have the exact
  volatility/search-path/owner capability shape. Only `app_role` may execute them;
  PUBLIC and `yellow_runtime` cannot. `app_role` has neither business-day UPDATE nor
  direct `journal.reverses` INSERT authority.
- Protected operator and approver authentication each returned HTTP 200 with distinct
  tokens retained only in memory. Both received exactly the three intended granted
  properties. For Yellow Demo, Riverstone and Harbourlight, the operator has exactly
  one normal role and zero post-seal roles; the approver has exactly one normal and one
  post-seal role. The normal role has adjustment-write but not post-seal authority;
  the one-purpose approver role has exactly the post-seal permission.
- Founder CRUD drift is preserved: raw current counts are four properties, 2,193
  reservations, 258 occupancy claims and 27 journals. The Riverstone 2024-11-24
  deterministic reservation remains founder-modified (`reserved`/booked). The two
  scenario hotels remain at 2,192 reservations, 257 claims and 24 journals, while the
  independently reviewed authority rows exist. This is consistent with the authority
  phase committing and the data phase failing closed; no reset or regeneration is
  claimed.
- Local UAT original journal `09f7b7cc-ad6a-4280-beb1-afd0a6105b4b` remains a
  governed charge with no `reverses` value. Correction
  `f3bba211-9e53-46b6-b3a1-10b78bb89106` is a later adjustment whose exact lineage
  targets that original. Each has two lines; the correction sums to zero and every
  line is the exact sign-negated original with the same account, folio, code,
  quantity and currency. The combined account/folio/code groups net to zero. The
  guest-facing UAT amounts are +7/-7 and `FOL-1` remains 12,500 across three lines.
  Exact one fact, one outbox event and one completed 201 idempotency record reference
  the correction with the required two-line payload. App-role UPDATE/DELETE remains
  false for journal, posting line and fact history. The current original fingerprint
  is `710dc40a581d7419a1f0823e50fbc64666efab6313771fa17a8e771e5031b559`.
- The correction business day is still open; this review did not create irreversible
  local seal state. D-481's fresh-database operator denial, forged-authority
  zero-mutation and authorized approver success remain authoritative for post-seal
  execution.

## Operation-incident inspection

The disclosed failed Compose seed attempt is consistent with the exact image boundary:
the database-tools stage copies `scripts/` and `migrations/` but not `src/`, while the
canonical review seeder imports `src`; it therefore fails before opening its database
path. Current protected login, canonical roles and exact grants prove the subsequent
host seed result. The scenario evidence above proves the separately committed authority
phase and preserved collision state. The first UAT diagnostic named nonexistent
`source_detail`; current catalogue confirms that column does not exist, while the
already committed +7 charge and exact -7 correction, audit and idempotency records are
complete. None of these incidents leaves a partial financial or scenario-data write.

## Verdict

No topology, backup, candidate identity, schema, authority, authentication,
immutable-ledger, audit or preserved-founder-state finding remains. Order186 is
approved for this sole local only. This does not merge, push, bind publicly, deploy to
production, approve a second local, or claim Phase 5 complete.
