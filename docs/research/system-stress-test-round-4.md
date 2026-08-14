# System Coherence Stress Test — Round 4

**Method change from Rounds 1–3:** those rounds compared the spec against external sources (Mews, Apaleo, Cloudbeds, HTNG, benchmarks). This round looks *inward* — at how the decisions already made interact with each other. This is where hidden problems actually live in real systems: not in any one decision, but in the seams between them.
**Continues the lettering from Rounds 1–3 (A–R). This round: S–X.**

---

## The Natural-Solution Test

The standing method, applied to every non-trivial decision from here forward — at each bounded-context or entity finalization, not just on request.

| # | Test | Question |
|---|---|---|
| 1 | Reuse | Is this an instance of an existing primitive, or a new one? |
| 2 | Data, not code | Can the behaviour be expressed as schema-validated config? |
| 3 | Single choke point | Does every path that must preserve an invariant flow through one place? |
| 4 | Removal | If deleted, does anything else break in a surprising way (hidden coupling — bad), or degrade cleanly (good boundary)? |
| 5 | Legibility | Would a hotelier or accountant recognise the concept, or only an engineer? |

Test 5 exists specifically to catch the failure mode of tests 1–4: chasing elegance into abstractions with no operational meaning. Both directions are checked below.

---

## S. Unify bitemporal correction and ledger correction into one insert-only pattern

**Finding.** Two mechanisms are currently doing the same job:
- Event-sourced ledger: postings are immutable; corrections are new rows (contra-entries), never an edit to an old one.
- Bitemporal rates/reservations: a correction typically closes the old row's transaction-time and inserts a new one — Fowler's standard pattern, but as usually implemented it still performs one `UPDATE` (closing the old row), even though business content is never touched.

**Test applied:** fails Reuse — two mechanisms for one underlying idea ("the truth changes over time, keep every version").

**Solution.** Make bitemporal storage insert-only too. Never `UPDATE`, not even to close a row. "Current" is derived, not stored:

```sql
CREATE TABLE fact_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id     uuid NOT NULL,        -- rate_id, reservation_id, account_id, ledger account...
  fact_type     text NOT NULL,        -- discriminator
  valid_from    timestamptz NOT NULL, -- when this is true in the business world
  valid_to      timestamptz,          -- null = open-ended
  recorded_at   timestamptz NOT NULL DEFAULT now(),  -- transaction time
  payload       jsonb NOT NULL,
  supersedes    uuid REFERENCES fact_log(id)
);

-- "Current" is always a query, never a stored flag:
SELECT DISTINCT ON (entity_id, fact_type) *
FROM fact_log
WHERE recorded_at <= :as_of
ORDER BY entity_id, fact_type, recorded_at DESC;
```

One storage mechanism. Ledger postings, rate corrections, reservation corrections, and (see finding V) extension/config versioning all become the same table shape used four times, instead of four bespoke ones. This is the clearest instance in the whole design of "the basic framework supports any kind of upgrade with ease" — a fifth use case later costs nothing structurally.

**Caveat, matching Round 3's discipline:** this needs the same treatment as the space-occupancy constraint did — prototype the `DISTINCT ON` "current" query under load before committing, since it's doing real work on every read of current state.

---

## T. Single-choke-point rule for space_occupancy

**Finding.** Round 3's space-occupancy projection (the partial exclusion constraint solving composite-slot integrity) only protects you if *every* write path that can affect occupancy updates it in the same transaction. Finding S introduces a specific way this breaks: if a future "backdate a correction" feature writes a new `fact_log` row for a reservation without also updating `space_occupancy` in that same transaction, the exclusion constraint silently stops meaning anything — a retroactive edit could create a real double-booking that the database will never catch, because the row that would have caught it was never touched.

**Test applied:** this is the Single Choke Point test made concrete. It doesn't fail on its own — Round 3's design was right — but nothing was said yet about *enforcing* the discipline.

**Solution.** Not a new mechanism — a rule stated explicitly and enforced structurally: `space_occupancy` may only ever be written by the same function/transaction boundary that writes to `fact_log` for occupancy-affecting entities. No other code path touches that table, ever, including admin tools and data-fix scripts. Enforce it with a Postgres `REVOKE` on direct table access plus a single `SECURITY DEFINER` function as the only write path — the database enforces the discipline, not code review.

This is why S and T are presented together: making corrections insert-only (S) is what makes it *tractable* to guarantee (T), because there's only ever one shape of write to intercept.

---

## U. Trust accounting collapses into existing primitives — cost revised down

**Finding.** The earlier research round flagged trust accounting (owner/agent fund segregation, three-way reconciliation) as a genuine, high-cost gap implying a new subsystem. Re-tested against what's already settled, it isn't one.

**Test applied:** Reuse. Decompose what trust accounting actually needs:
- Segregated balances → an `Account` with a `role = trust` flag. Already exists (Round 1, A1: folios belong to accounts).
- Commission/fee split on every charge → a `BillingAutomation` rule: trigger = charge posted to a folio linked to an owner-managed unit; action = split into owner-portion and management-fee-portion, post each to its account. Already exists (Round 1, A2).
- Three-way reconciliation (bank ledger vs bank statement vs owner balances) → a projection/report comparing derived balances against an imported bank statement. A Reporting concern, not a ledger mechanism.
- Payout (ACH/NACHA/cheque) → a payment-provider integration, same shape as any other payment method.

**Revision.** Downgrade from "genuine gap, high retrofit cost, new subsystem" to "zero new primitives — a role, a rule, a report, and an integration, all composed from what's already built." This is a real cost reduction, not just a reframe.

---

## V. Extension Registry — one mechanism underlying four (and future) plugin points

**Finding.** Four separate "pluggable by jurisdiction/vertical" mechanisms are scattered across the spec: vertical profiles (asset types), tax jurisdiction rules, statutory registration adapters, and fiscal document providers. Each was designed independently as its own registry.

**Test applied:** fails Reuse at the registry/lifecycle level. All four share an identical shape: *a keyed, versioned, schema-validated configuration bundle with an effective-date range and a status.* That shape is worth building exactly once.

**Solution.**

```sql
CREATE TABLE extension_registration (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extension_type text NOT NULL,   -- 'vertical_profile' | 'tax_jurisdiction'
                                   -- | 'statutory_adapter' | 'fiscal_provider' | ...
  extension_key  text NOT NULL,   -- 'marina' | 'AE-VAT-2026' | 'IT-alloggiati' | ...
  schema_version int NOT NULL,
  json_schema    jsonb NOT NULL,  -- validates payload
  payload        jsonb NOT NULL,  -- the actual typed content
  status         text NOT NULL,   -- draft | active | deprecated
  valid_from     timestamptz,
  valid_to       timestamptz
);
```

Because this table has effective-date ranges and a status, it's itself an instance of the pattern from finding S — versioning a jurisdiction's tax rules and versioning a rate plan are now, mechanically, the same operation. Adding a fifth plugin type later (lock vendor adapters, channel mappings, RMS connectors) is "write a JSON Schema and register instances against it," not "design a new subsystem."

**Guardrail — this is where over-unifying becomes the EAV mistake one layer up.** The registry/lifecycle layer is generic. **The content is not.** A marina's `payload` (LOA, beam, draft, amperage) and a tax jurisdiction's `payload` (compounding order, value bands, exemptions) must never be forced into a common shape just because they share a table. Each `extension_type` owns its own concrete `json_schema`, checked at write time, and the application code that *reads* a given type still works with fully typed structures, not a generic blob passed around untyped. The unification buys you one lifecycle mechanism to build, version, and audit — it must never become an excuse to stop typing the content. This is Test 5 (Legibility) doing its job: an operator configuring a marina should see LOA and beam, not a generic "attributes" JSON editor.

---

## W. Collapse master reservation, block, and share into one `ReservationGroup` entity

**Finding.** Three near-identical hierarchy concepts exist in parallel: master/sub reservations (linked travelling parties), business blocks (with wash schedules and cutoff), and shares (multiple reservations, one room). All three are "more than one reservation relates to a common parent, with some optional behaviour attached."

**Test applied:** fails Reuse and risks failing Removal — as separate entities, "can a family linked-reservation later be converted into a block" becomes a migration between tables instead of a state change, and the two will drift apart as each gets features the other doesn't.

**Solution.** One entity, `ReservationGroup`, with a `kind` discriminator (`linked | block | share`) that gates which optional behaviours attach — wash schedule and cutoff only apply where `kind = block`; rate-split logic only where `kind = share`. A family trip that later needs a wash schedule is a `kind` change on an existing row, not a data migration.

---

## X. Revised scope, and how "continuous" actually works from here

### What changed

| Item | Before this round | After |
|---|---|---|
| Bitemporal storage + ledger corrections | Two mechanisms | One (insert-only fact log) |
| Trust accounting | New subsystem, high cost | Composition of existing primitives, near-zero marginal cost |
| Vertical profiles / tax / statutory / fiscal plugins | Four bespoke registries | One registry mechanism, typed content per type |
| Master reservation / block / share | Three parallel entities | One entity, discriminated by kind |

Net effect: fewer primitives in the system than after Round 3, not more — despite this being a "find more problems" pass. That's the expected shape of a good coherence review.

### How continuous evaluation actually works, given I don't run in the background

**Now (design phase):** I apply the five-part test at every context or entity finalization, as a standing practice, not on request.

**Once Claude Code work starts:** this method and the S–X findings become a `pms-architecture-review` skill, so the discipline survives context resets across sessions. Deliberately not built yet — a skill encodes settled decisions, and folding S–X into the ERD is still pending, so writing the skill now risks it going stale before it's ever used.

**Once real code exists:** the actual mechanical form of "continuous." T's single-choke-point rule becomes a Postgres grant plus a test that tries to write around it and asserts failure. The space-occupancy constraint becomes a property-based concurrency test. These run in CI forever, for free, without needing me at all — which is the correct answer for a two-person team's cost model: pay for the discipline once, in code, not repeatedly, in review time.

---

## Next

S–X are ready to fold into the ERD. Nothing here should keep changing once that's done — nine rounds in, the remaining churn has been in how many mechanisms express an idea, not in the ideas themselves. That's a sign the domain model itself is closer to settled than the mechanism count suggested.
