# Order 194 — Approved hosted-deposit single-local promotion

**Status:** READY — D-520
**Phase:** 5 · founder human testing
**Branch:** `phase-5/folio-charge-correction-resumed`
**Base:** `1cedcbf` (independent Tier-3 approval over exact product `6d804f9`)
**Risk tier:** 3 — reversible persistent-local migration and financial UAT operation
**Owner:** Codex operations; independent non-operating post-promotion reviewer

## Outcome

Promote independently approved Order193 product `6d804f9`, plus only D-520's
founder-directed local sign-in convenience adapter, to the sole founder
local: PMS on `http://127.0.0.1:3000` and its same-stack loopback synthetic provider
companion on `http://127.0.0.1:3001`. Preserve the populated database, credentials,
previous rollback image and single-local topology while applying migrations 0021–0022
and narrowly provisioning one deterministic Yellow Demo/FOL-1 USD deposit fixture.

## Scope

- `handoff/orders/194-approved-hosted-deposit-local-promotion.md`
- `scripts/provision-local-hosted-deposit-uat.ts`
- `tests/local-hosted-deposit-provision.integration.test.ts`
- `src/app.ts`
- `src/server.ts`
- `src/http/operator.ts`
- `docker-compose.yml`
- `tests/local-login-prefill.security.test.ts`
- `DECISIONS.log`
- `handoff/LEDGER.md`
- `handoff/reviews/194-approved-hosted-deposit-local-promotion-review.md`

No other product, migration, fixture, test, configuration or documentation file is
admitted. If implementation requires one, stop and open a numbered question.

## Fixed local sign-in convenience contract

- Disabled by default and admitted only for the explicitly enabled operator workbench
  on a loopback bind. Production/default HTML remains byte-for-byte free of credentials.
- Read tenant, email and password only from process environment populated from the
  ignored owner-only founder credential file. Require the complete trio or fail before
  listen; never log, persist, commit, cache or expose them through an API.
- HTML-escape every attribute value and return the credential-bearing document with
  `cache-control: no-store`. The password remains a masked password input.
- The browser token stays memory-only and reload still requires one click to sign in.
- Docker may listen on its internal wildcard only behind the existing host-loopback
  publication; credential values are emitted only for loopback-host requests.

## Fixed provisioning contract

- Local-only, deterministic UUIDv5 identities; one transaction; exact replay and
  collision checks; no password, signing-secret or existing scenario regeneration.
- Add only `financials.payments:read`, `financials.payments:write` and
  `financials.deposits:apply` to the existing Local Availability Reviewer role over
  its existing property grants.
- Provision only Yellow Demo Property / FOL-1 / USD: `card_clearing` and
  `deposit_liability` accounts, `CARD_PAYMENT` and `DEP` transaction codes/routes,
  and one active `card_network_token` instrument for the existing FOL-1 guest.
- The instrument PSP is `local-deposit` and stores an opaque non-PAN token. The
  provisioner must never create a hosted request, payment operation/receipt, deposit
  application, journal or posting line.

## Required operation and proof

1. Preflight exact approved base and only the admitted D-520 delta, clean worktree,
   sole healthy current local, loopback
   3000/5643/6590, unbound 3002 and owner-only credential/database authority files
   without printing secrets.
2. Test the provisioner against a disposable migrated database, including first run,
   replay, collision failure, exact cardinality and zero financial artifacts.
3. Build exact runtime and database-tools images while the previous app stays live.
4. Create an owner-restricted PostgreSQL custom backup beneath
   `D:\Yellow\backups\order194\`; record size/SHA-256 and prove catalogue readability.
5. Stop only the current app, apply migrations 0021–0022 through the migration runner,
   prove exact replay, 89 tables, 79 RLS-enabled/policy tables and referee 11/11, then
   run the tested provisioner twice.
6. Start exactly one candidate stack with PMS 3000 and distinct synthetic provider
   3001 using a fresh shared callback secret kept only in process environment. Reuse
   existing signing/database/credential authority without changing or exposing it.
7. Execute authenticated hosted-deposit UAT: approve and replay, partial then final
   application, and decline/cancel/timeout paths. Prove exact bounded financial
   cardinalities, balances and zero financial artifacts for non-capture outcomes.
8. A fresh non-operating Tier-3 reviewer verifies exact image identity, D-520's
   disabled/default and local-only secret containment, topology,
   backup, migration/schema/referee, provisioning, browser journey and immutable
   accounting. Never auto-restore the database; retain the backup and old image.

## Forbidden

Second compose project/local, port 3002, public bind, real PSP/account/spend, raw
PAN/CVV/VPA/bank data, credential reset/disclosure, data reset, settlement, refund,
chargeback, cashier, AR/trust, tax/fiscal/document issue, merge, push, public or
production deployment, or Phase-completion claim.

## Definition of done

- [ ] Provisioner test proves deterministic replay/collision containment and no financial artifacts.
- [ ] Sign-in fields are pre-filled only on the owner-controlled loopback local and require only the login click.
- [ ] Owner-only backup is readable and prior rollback image is retained.
- [ ] Migrations 0021–0022, replay, exact schema and referee 11/11 are green.
- [ ] Sole loopback local serves exact Order193 product on 3000 plus provider on 3001; 3002 is closed.
- [ ] Authenticated hosted-deposit UAT and negative outcomes are green.
- [ ] Independent non-operating Tier-3 review approves the promotion.
