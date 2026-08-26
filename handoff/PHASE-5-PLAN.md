# Phase 5 plan — folios, postings and settlement

Phase 5 turns Yellow's existing financial schema into one usable, immutable money path.
The sequence begins with the canonical payer/account/folio target, then adds balanced
posting, operator presentation, corrections/transfers, token-only payment states,
settlement and an independently reproducible phase gate. Every command uses integer
minor units, tenant transactions, exact property authorization, durable idempotency,
facts and outbox evidence. Customer configuration never weakens journal balance,
sealed-day, token-only, trust, tax or fiscal guardrails.

| Order | Risk | Slice | Outcome | Hard proof |
|---|---:|---|---|---|
| 103 | 3 | Account-owned reservation folio foundation | A reservation receives one account-owned primary folio with a transactional human reference | Tenant-coherent FKs, one concurrent window, gap-free rollback, account reuse, no money rows |
| 104 | 3 | Balanced charge posting | One strict `postCharge` command creates a two-line immutable journal from governed routing | Exact signs/currency/date, balance, sealed-day serialization, replay/rollback, 1,000-posting trial balance |
| 105 | 3 | Operator folio statement and charge workbench | Authorized staff inspect immutable statement rows and post bounded charges | Property scopes, server balance, exact money strings, no arbitrary-line/browser accounting |
| 106 | 1 | Future Workbench artifact preservation | Founder-approved target-state UX and its complete minimal source remain byte-verifiable repository evidence | Exact source hashes, standalone browser page, explicit prototype/production boundary, zero application change |
| 107 | 1 | Founder-status review-count accuracy | Review coverage displays its exact recorded numerator while zero Gate-3 debt remains a distinct fact | Asset binding regression, authenticated snapshot, no subjective progress or review inflation |
| 108 | 3 | Critical SECURITY DEFINER containment | Every current definer resists hostile temporary-schema shadowing and exposes least execution authority | Hostile `pg_temp` red/green, exact ACL catalog/behavior, invariant regression, independent proof |
| 109 | 3 | Transfer, adjustment and reversal | Corrections append traceable contra journals and transfers never reassign history | Original rows immutable, exact linkage, approval thresholds, concurrent replay |
| 110 | 3 | Token-only payment foundation | Provider port and idempotent auth/capture/void/refund lifecycle post correct journals | No PAN/CVV anywhere, duplicate callback one effect, timeout reconciliation, transition proof |
| 111 | 3 | Hosted payment and deposit workbench | Staff/guest hosted collection settles a folio through server/provider truth | Signed callbacks, partials, stale response guards, no browser/provider authority |
| 112 | 3 | Cashier sessions | Cash handling opens/closes attributable sessions with exact over/short | One active session, exact counted money, no hidden balancing entry |
| 113 | 3 | Folio settlement and AR transfer | Every window settles or explicitly transfers under credit authority | Zero-balance/AR guard, credit limits, multi-window completeness, rollback |
| 114 | 3 | Phase-5 journey and gate | Reservation → folio → charge → payment → settlement runs on pristine PostgreSQL | Non-skipped journey, schema/deployment/referee, hostile money/tenant/role boundaries |

Founder-priority recovery splits the original Order 109 outcome into independently
reviewable slices. Order 183 delivered immutable whole-charge correction and exact
post-seal authority. Order 188 now delivers additional folio windows plus governed
whole-group routing for Business, Personal and Corrections presentation. Together
they satisfy the correction/transfer foundation without silently importing payment,
AR, document, tax or settlement behavior.

Current founder-visible delivery: Order 171 wires the already-approved primary-folio
command behind its own property permission and an explicit reservation action, then
reuses the existing statement and governed untaxed-charge surfaces. Reservation commit
remains financially decoupled; the local-review seed supplies only deterministic
non-production folio numbering, room-revenue routing and the current open business day.

Tax evaluation, fiscal documents, statutory submissions, owner/trust payout automation
and multi-currency FX stay outside this sequence until their dedicated compliance and
research orders. Trust accounts may exist in the baseline but no Phase-5 command may
route owner funds without its approval-backed model.

Every order requires its own Natural-Solution Test, exact Scope and Forbidden list,
intentional red, fresh PostgreSQL proof and independent non-implementing review.
