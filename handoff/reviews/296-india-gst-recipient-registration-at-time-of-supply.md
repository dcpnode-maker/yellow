# Order 296 independent Tier-3 review

**Reviewer:** `order296_fresh_review`, fresh non-implementing OpenAI Codex agent  
**Candidate:** `58c6b49a20e4e4ba9560118c62cb7517ad95a930`  
**Approved base:** `912cc1f827c702224251610aa778e9312b152220`  
**Result:** APPROVED — no finding

## Independent inspection

The candidate is an exact descendant of the independently approved Order295
governance frontier and changes only the admitted Order296 source, tax-fiscal export,
three proofs, bounded documentation and append-only coordination evidence. It adds no
migration, schema, writer, API, UI, seed or local-runtime surface.

The reviewer inspected the complete source and predecessor implementations. The
composer performs one tenant-leading SELECT under transaction-local runtime tenancy,
equality-binds every selected Order285 and Order294 identity/date, rejects missing or
duplicate rows, and independently reconstructs both complete predecessor envelopes
before comparing the caller-selected hashes. It accepts only the exact status date
equal to the recomputed time-of-supply date, recursively freezes the fixed-order
result, and keeps tenant identity plus recipient GSTIN/address out of the result. It
contains no clock, network, lock, latest/nearest selection or write authority.

Current official India Code CGST Act sections 25, 29 and 30 and CBIC Rule 21A were
independently checked. They preserve distinct registration, cancellation, revocation
and suspension states. The candidate's deliberately narrow use of one governed
exact-date `active` snapshot as evidence, without inferring a validity interval or
legal-buyer/tax consequence, is consistent with that distinction.

## Reviewer-executed proof

- Focused intentional-red/current and hostile suite: `8 passed, 0 failed`, 134
  assertions.
- Canonical isolated PostgreSQL 16.15 `./setup.sh --db-only`: all 58 migrations,
  exactly 110 public tables, referee `11 passed, 0 failed of 11`.
- Fresh real PostgreSQL 16.15 two-tenant Order285+294 composition through
  `yellow_runtime` -> `app_role`: `3 passed, 0 failed`, 31 assertions. This directly
  proved transaction-local tenant identity, exact hash replay, recursive freeze,
  tenant/GSTIN/address concealment, cross-tenant and mixed-lineage rejection, selected
  date/hash attacks, duplicate rejection, and unchanged fiscal/financial/shared effect
  counts.
- An additional independent PostgreSQL 17.2 run of the same live proof also passed
  `3/0` (31); it is supplementary and does not replace the canonical 16.15 proof.
- Standing suite: `1,036 passed, 880 expected database skips, 0 failed`, 15,904
  assertions across 1,916 tests / 338 files.
- TypeScript, 119 import boundaries, 23-package licence policy, exact container-image
  pins, dependency audit (zero vulnerabilities), ancestry, bounded scope,
  `git diff --check`, and clean worktree all passed.

Approval is limited to migration-free, SELECT-only
`active_recipient_registration_at_time_of_supply` evidence. It grants no inferred
registration interval, recipient legal-buyer/B2B designation, place or nature of
supply, `BuyerDtls`, `Pos`, `SupTyp`, `IgstOnIntra`, rate, levy, decomposition, tax,
document, numbering, journal, posting, IRP, submission, API, UI, local promotion,
merge, deployment, phase-complete or application-complete authority.
