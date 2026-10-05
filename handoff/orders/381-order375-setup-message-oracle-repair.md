# Order 381 — Order375 setup-message oracle repair

**Status:** APPROVED-CLOSED-D1096
**Phase:** 5 — Financials
**Branch:** `phase-5/setup-message-oracle-repair`
**Base:** exact withheld Order380 governance `bae06a4c4023e257bffcf3b4878510957cd52184`
**Risk tier:** 1 — two stale test-only setup message strings

Repair only D1093's independently reproduced two assertions in
`tests/setup-current-catalogue-oracle.test.ts` from `migrations 1-63` to the
authoritative `setup.sh` text `migrations 1-64`. Scope is those two string fragments
plus order/review/decisions/ledger. No source, setup script, migration, schema, other
test, UI, status or local change. D1093 remains the intentional red. Fresh complete
focused proof and a different independent reviewer are mandatory before Order375
restarts.

## Definition of done

- [x] Fresh review reproduced both expected `1-63` strings versus actual `1-64`.
- [x] Exact two-string candidate is ready for complete focused proof.
- [x] Fresh non-implementing reviewer approves the bounded repair.

## Builder note

D1095 changes exactly the two authorized expected string fragments from `1-63` to
`1-64`. No source, setup script, migration, schema, other test, UI, status or local
artifact changed.

## Independent review

D1096 independently approves exact candidate
`30266ae1d143792382af698e85f740684f79f573`. The bounded diff contains only the two
authorized expected message fragments plus Order381 governance. Windows-native Bun
1.3.14 passes the complete focused suite **1/0 with 5 assertions**; independent disk
derivation confirms migration count 64, highest migration 64, public base tables 116,
both authoritative `1-64` setup messages present and both stale `1-63` messages
absent. `git diff --check` is clean, `wsl-crashes` is absent, and no database, WSL,
source, setup, migration, schema, other test, UI, status, local, deployment, merge or
Order375 approval action occurred.
