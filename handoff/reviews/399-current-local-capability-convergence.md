# Order 399 — fresh independent Tier 3 review

**Verdict:** APPROVED

**Reviewer:** `/root/order399_fresh_tier3`, fresh independent non-implementing and
non-operating Tier 3

**Reviewed candidate:** `e5a7d8be98fd682056b140f76ad1ee6979eb36f2`

## Scope and implementation inspection

I approve the exact Order 399 candidate. I read `PROJECT.md`, current `state.sh`
truth, Order 399, D-1168/D-1169, the PostgreSQL and compliance skills, roster and
workflow before inspecting or executing proof. I did not author or operate the
reconciliation and did not mutate the database, application or containers.

The candidate adds only the allowed standalone reconciliation script, package
command, three focused tests, bounded local-review documentation and append-only
governance. It changes no migration, RLS policy, schema, application route, domain
service, UI asset, credential, Docker definition or product capability.

The script accepts only a credentialed loopback PostgreSQL URL, takes one
transaction-scoped advisory lock, locks and compares the exact canonical identities,
migration ledger and six user-role assignments, then admits only seven exact
permission descriptions and nine exact role grants. Existing rows must match
byte-for-byte at the value level; ambiguity fails closed. It contains no delete or
update path. Both insertion sets are exact-key checked before insert, making replay a
zero-change operation. Any identity, catalogue, grant or checker-exclusion failure
rolls back the single transaction. The specialized checker is tested before and
after insertion for absence of both seal permissions and the carry-maker permission.

## Reviewer-executed proof

- Focused Order 399 proof: **3 pass, 0 fail, 15 assertions**.
- TypeScript strict check passed; import boundaries passed for **143 TypeScript
  files**; licence policy passed for **23 installed packages**; production dependency
  audit found no vulnerabilities; exact parent/candidate `git diff --check` passed.
- Read-only PostgreSQL proof found exactly migrations **1–68**, exactly two canonical
  properties and exactly six canonical user-role/property assignments.
- The seven permission catalogue rows have the exact canonical descriptions. The
  ordinary role has exactly the approved five grants. The checker has exactly the
  approved four grants and no internal seal, edge seal or carry-maker grant.
- The two-hotel scenario remains exactly **8 parties / 0 contacts / 8 party roles /
  75 facts / 22 outbox rows** with **0 journals / 0 posting lines**.
- A fresh authenticated runtime proof, retaining the token only in memory, returned
  login **200**, property discovery **200**, owner-trust **200** for both properties,
  close-workbench **200** for the configured main property and **404** for the
  identity-only property. The latter is no longer the pre-reconciliation 403 scope
  denial and is the bounded absence of its intentionally missing business-day fixture.
- Root and health both return **200**, the sign-in prefill remains present under
  `Cache-Control: no-store`, and exactly one application is exposed at
  `127.0.0.1:3000`. Ports 3002, 3123 and 3188 have zero listeners.
- The application is healthy with restart count zero, image
  `sha256:15707acfdf251ab6e6269cbb7cee9ab9c8a1f84d919a889e8a205cc3b49ec247`
  and exact source label `d1f6f45e1835df86bf0c27c50beba66113b4ae96`. The retained PostgreSQL container
  has no host port binding.

No scope inflation, authorization weakening, tenant ambiguity, financial mutation or
runtime mismatch was found. This approval closes Order 399 only and makes its bounded
postcondition eligible for Order 398 recovery review. It does not close Order 398,
approve deployment, merge or push, or claim any phase complete.
