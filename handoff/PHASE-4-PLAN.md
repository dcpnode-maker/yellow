# Phase 4 plan — Honest reservations from search to committed stay

**Product direction:** `BUILD-PLAN.md` Phase 4, `docs/CONTRACTS.md` §2–§4 and
`docs/STATE-MACHINES.md` §1/§6  
**Baseline entering this phase:** Orders 028–031 provide the canonical inventory graph, audited
holds and PostgreSQL truth search. Orders 047 and 070 provide durable HTTP idempotency and
reproducible stay quotes. Orders 045–082 remain explicit Gate-3 review debt; Phase 4 builds on
their preserved contracts without claiming independent approval.

**Current status:** Orders 080–085 are built with builder-executed proofs. Independent review ends
at Order 044; none of the Phase-4 rows is represented as approved or merged.

## Product promise

A hotel may configure rate, cancellation, deposit, guarantee, assignment and operational policy,
but a reservation becomes real only when PostgreSQL grants occupancy through the one existing
choke point. Search is evidence, a hold is temporary arbitration, and commit is the atomic promise.
No user preference, AI proposal, projection, cache or operator screen can bypass that boundary.

Every reservation keeps stable confirmation identity while stay legs are immutable in meaning:
room moves create a new segment, and date changes on the same unit release and re-record occupancy
inside one transaction. Guests and sharers are explicit parties; `share_pct` is configurable but
validated. Alerts and waitlist offers assist staff without creating hidden booking authority.

## Canonical flow

1. **Search** — return bounded bookable options with rate, policy, restriction and availability
   evidence. It is never a promise and never reads browser-computed truth.
2. **Hold** — reserve one exact sellable configuration for at most 900 seconds through the existing
   `HoldService` and occupancy choke. Expiry/release remain audited and kind-separated.
3. **Commit** — atomically convert an active hold, or directly arbitrate an exact option, into one
   reservation and one or more segments. Exact retries replay through the kernel idempotency store.
4. **Operate** — modify, cancel, reinstate, move, extend and shorten only through the exhaustive
   state/segment rules, re-arbitrating occupancy where required.
5. **Assist** — manage guests/shares, alerts and waitlist offers with explicit windows and no
   implicit confirmation.

## Hotel choices versus mandatory guardrails

Hotels may configure applicable policies, channel/market/source codes, guest/sharer allocation,
assignment timing, waitlist priority and offer windows, and approval-backed operational overrides.
The UI and AI layer may propose those values through the same typed commands.

Hotels may not disable or redefine tenant/RLS boundaries, exact idempotency, occupancy arbitration,
reservation lifecycle legality, immutable audit/outbox evidence, journal balance, statutory guest
requirements, fiscal/tax obligations or country-required retention. A requested configuration that
crosses that envelope must be rejected with a clear reason rather than silently approximated.

## Requirement-to-order matrix

| Order | Tier | Deliverable | Canonical requirements | Pre-registered proof focus |
|---:|---:|---|---|---|
| 080 | 2 | Executable reservation state contract | Exact statuses, transitions, guards and events from `STATE-MACHINES.md` | Markdown-to-code equality; all unlisted pairs fail closed |
| 081 | 3 | Atomic hold-to-reservation commit service | Active hold consumption, reservation/segment/guest creation, occupancy transfer, exact idempotency | Rollback at every injected boundary; hold and segment can never both own the claim |
| 082 | 3 | Direct commit and racing-commit HTTP contract | `POST /reservations:commit`, 201/409, positional bounded retry, tenant/property authorization | Last-unit race yields exactly one 201; no partial reservation/fact/event on losers |
| 083 | 2 | Review-seed fixture isolation and inherited Gate-3 coverage | Preserve founder demo data while legacy proofs request only their explicit fixture; run all five inherited suites in isolated CI | Order 050 empty-state proof restored; thirteen suites migrate/run/clean independently |
| 084 | 3 | Complete availability offer search | Contract §2 option shape with published rate, policy, restriction and truth availability evidence | Search cannot promise inventory; stale projection/cache cannot authorize commit |
| 085 | 3 | Modify, cancel and reinstate commands | Diff evidence, policy/approval boundary, occupancy release/re-arbitration, exact events | Invalid transitions and failed re-arbitration roll back; reinstate cannot overbook |
| 086 | 3 | Segment move, extend and shorten | Move creates next segment; same-unit date change releases/re-records atomically | No gap/double claim; failed destination leaves original segment untouched |
| 087 | 2 | Guests, shares, alerts and waitlist offers | `reservation_guest`, bounded `share_pct`, alerts, explicit offer window | Shares validate exactly; an expired/declined offer never creates a reservation |
| 088 | 3 | Founder reservation workbench and reproducible Phase-4 gate | Search → hold → commit → lifecycle inspection using canonical services | Clean-checkout database gate, hostile browser inputs, accessibility, no client authority |

The order numbers reserve sequence only. Each order requires a fresh schema/decision preflight,
an exact Scope and Forbidden section, an intentional red proof, and a Natural-Solution Test before
it authorizes implementation.

## Required preflight for every implementation order

1. Re-read the immutable reservation, segment, guest, hold, occupancy, fact and outbox schema.
2. Search `DECISIONS.log` before choosing any state, event, persistence or arbitration behavior.
3. Name every transition, event and occupancy effect in the order. A migration, journal/fiscal
   effect, new state/event or alternate occupancy path hits the D-92 hard floor.
4. Reuse `HoldService`, `AvailabilityService`, `RateQuoteService`, `PostgresIdempotency`, tenant
   transactions, facts and outbox. Do not create a reservation-only substitute.
5. Commit the intentional red before implementation and restart a proof from the top after any
   assertion or precondition correction.

## Phase exit evidence

- Search → hold → commit returns one durable reservation whose occupancy ownership transfers
  atomically from hold to segment and whose exact retry does not duplicate anything.
- Two direct commits racing for the last exclusive unit yield exactly one 201 and one 409
  `conflict/occupancy`; positional capacity retries only within the documented bound.
- Modify, cancel, reinstate, move, extend and shorten match the executable state contract and
  preserve occupancy under rollback and concurrency.
- Guest/share, alert and waitlist behavior remains tenant-scoped, bounded, audited and explicit.
- The complete Phase-4 gate runs from a clean checkout against fresh isolated databases, while the
  founder can inspect the same capabilities at localhost without that persistent stack becoming
  proof authority.
