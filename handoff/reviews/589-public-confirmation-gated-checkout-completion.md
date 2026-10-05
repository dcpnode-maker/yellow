# Review 589 — public confirmation-gated checkout completion

**Reviewer:** `/root/order589_checkout_review` (independent; did not implement the
checkout UI, deploy Order 588, or submit any Order 589 mutation)  
**Date:** 2026-09-22  
**Public target:** `https://editing-alto-artists-quilt.trycloudflare.com`  
**Target stay:** Rohan Kapoor / `L3R-DO-0013` /
`b6d0f949-8538-5fcb-8783-79f55e75ea0c`  
**Verdict:** **APPROVED for the exact three confirmation-gated Order 589 public-demo
operations and their attributable consequences. No financial, occupancy, tenancy or
state-transition blocker.** This is not a whole-PMS, real-guest, payment, posting,
document, physical inspection, housekeeping, luggage, production-readiness or
colleague-shareability approval.

## Independence and scope

I read `PROJECT.md`, `AGENTS.md`, Order 589, and Reviews 587/588 before beginning.
`state.sh` could not execute because this Windows host's `bash` resolves to a WSL
relay without `/bin/bash`; I performed the equivalent branch, head, dirty-tree,
order, decision and runtime checks in PowerShell. The canonical tree was already
dirty on `phase-0/founder-context-demo-readiness` at `a043bb29`.

I sent **READY** only after personally capturing the preflight and inspecting the
public no-write journey. I did not check a consent, invoke an endpoint, retry an
operation, or mutate source, configuration or data. The primary agent alone ran the
three authorized controls after my READY message. My database sessions were
`REPEATABLE READ READ ONLY`; my browser guards allowed only reads and the existing
synthetic-session `POST /api/v1/auth/demo:enter`. My only canonical write is this
review.

## Independent preflight

The first snapshot covered all **129** public tables in one repeatable-read/read-only
transaction. Its aggregate was:

```text
450726c50debfacbb2ab190be6adc20d41ec4fafc2e44b9d6ba5621064eb6268
```

The exact target state was:

- reservation `b6d0…` was `due_out`, confirmation `L3R-DO-0013`, SAR, at Locanda;
- its only segment `cdde…` was `in_house`, room sellable unit `9682…`, with period
  `[2026-09-18T15:00:00Z, 2026-09-20T11:00:00Z)`;
- exact occupancy `d01f…` was the one exclusive segment claim on space `e636…`
  (room 113), with the same period;
- there were zero folios and zero canonical Locanda/SAR guest accounts for Rohan's
  party `f0df…`;
- the sole Locanda non-fiscal folio series `e578…` was prefix `L3R-FOL-`, `next_no=3`;
- journal `2`, posting line `4`, payment `0`, payment operation `0`, document `0`;
- `api_idempotency=117`, `fact_log=1012`, `outbox=952`,
  `space_occupancy=233`.

In the actual public UI I entered `checkout Rohan Kapoor` and independently observed
the server response: `due_out`, room 113, zero folios and sole blocker
`folio_window_missing`. The Bill ribbon showed the exact missing-window disclosure,
one unchecked confirmation, and a disabled primary-folio action. I made no mutation.

| CSS width | document width | body width | tabs | selected | depth cards | checked consents |
|---:|---:|---:|---:|---:|---:|---:|
| 1440 | 1440 | 1424 | 5 | 1 | 2 | 0 |
| 375 | 375 | 359 | 5 | 1 | 2 | 0 |

The no-write preflight had no console/page error, failed request, HTTP error or
blocked write. Its only non-read request was `POST /api/v1/auth/demo:enter`.

## Action-session evidence personally inspected

I inspected the exact action harness and its immutable receipt. The harness had a
deny-by-default route guard. It permitted only the demo-session POST and these three
target-bound operations; every other non-read request would have been aborted. For
each operation it first asserted that the named consent was unchecked and the action
disabled, checked only that consent, asserted that the action unlocked, submitted it
once, and waited for the refreshed authoritative state before moving on.

| Order | Governed endpoint | Result | Retained operation identity |
|---:|---|---:|---|
| 1 | `POST …/reservations/b6d0…/primary-folio` | 201 | `yellow-checkout-folio-06c20e16-0f65-4d74-aa18-13369e692072` |
| 2 | `POST …/folios/d1ded15b-9043-433f-8ed6-40dad8bd42fc/status` (`settle`) | 200 | `yellow-checkout-settle-d9f315ea-f938-49c7-ba10-8734fcd5346a` |
| 3 | `POST …/reservations/b6d0…/checkout` | 200 | `yellow-checkout-9a3c8a20-85c2-4b28-bffa-f6c2d73701a0` |

The receipt records no blocked write, browser error, bad response or failure. The
three literal-key SHA-256 values I computed independently are respectively:

```text
0ce1cd7b03b8cb148ca3f99209eed47d2ccb617768f7f3d51db867576d439bfc
7c3b95fe5339d0092fb5c9858c91aef20e85e51fe30ed56c286fa3e7b0c55f5c
d9d4023c529afcf04a36e7b3e2c6d41b6ec45466a216bf7c3742ab96f8b0fc20
```

They match exactly the three new `api_idempotency.key_hash` values. Each operation
has one—and only one—completed row, with response status `201`, `200`, `200` and the
target-bound response body. There is no evidence of a retry under a different key or
an uncertain outcome.

## Independent postflight and complete delta attribution

My second all-table snapshot produced aggregate:

```text
2af37d091b40f5bec2cd5d1c69b9b78760a5133b55a24d443b9d21f25f12bff6
```

Exactly 12 tables changed. Every changed row is attributable to the three commands or
their two existing consumers:

| Table | Pre → post | Exact attribution |
|---|---:|---|
| `account` | 19 → 20 | one guest account `6922524d…`, Rohan's party, Locanda, SAR, open; created in the folio-open transaction |
| `api_idempotency` | 117 → 120 | exactly the three completed rows and key hashes above |
| `availability_projection` | 76 → 85 | the existing consumer rebuilt/inserted exactly nine Locanda rows for three unit types × stay dates 18–20 September from outbox seq 1001 |
| `consumer_cursor` | 2 → 2 | the two existing consumers advanced from Review 586's stable seq 998 to seq 1002 |
| `consumer_processed` | 1904 → 1912 | exact cross-product of four new outbox IDs × `arrival-pickup-task` and `availability-projection`; no extra row |
| `document_series` | 2 → 2 | only Locanda series `e578…` advanced `next_no 3→4`; emitted reference `L3R-FOL-3`; no document row |
| `fact_log` | 1012 → 1016 | exactly `folio.opened`, `folio.settled`, `occupancy.released`, `reservation.checked_out` |
| `folio` | 9 → 10 | exactly primary window `d1ded15b…`, account `6922524d…`, `L3R-FOL-3`, window 1, ending `settled` |
| `outbox` | 952 → 956 | seq 999–1002: `folio.opened`, `folio.settled`, exact `occupancy.released`, `reservation.checked_out` |
| `reservation` | 654 → 654 | only target `b6d0…`, `due_out→checked_out` |
| `reservation_segment` | 654 → 654 | only target `cdde…`, `in_house→departed`; period was already ended and stayed byte-equivalent |
| `space_occupancy` | 233 → 232 | exact claim `d01f…` removed; no replacement occupancy row and no other target-segment claim remains |

PostgreSQL row-version inspection found no other account, folio, document-series,
reservation or reservation-segment row written by the three command transactions.
The occupancy table dropped by exactly one, contains no new action-transaction row,
and the exact former claim is absent. That proves the one-row release rather than a
net-count coincidence.

The checkout transaction produced two facts and two outbox events under the same
request correlation: one exact segment occupancy release (`claim_count=1`, occupancy
`d01f…`, space `e636…`) and one reservation checkout containing the single settled
folio at balance zero. The open and settle facts likewise share their individual
request correlations with their matching outbox events.

The nine projection rows were not accepted merely because the consumer wrote them. I
independently recomputed the authoritative projection from current sellable mappings,
property timezone/policy, `space_occupancy`, OOO/OOS and the exact local date envelope
using a read-only query equivalent to the production projection select:

```text
expected_rows=9  actual_rows=9  mismatch_rows=0
expected_hash=f5a88b79fefa97ee3930bd5d16f9c82d
actual_hash  =f5a88b79fefa97ee3930bd5d16f9c82d
```

All other **117** public tables retain their exact preflight count and ordered-row
fingerprint. In particular, these financial/fiscal surfaces are byte-stable:

```text
journal           count 2  md5 0c6371ac285c0e11469603917024e0df
posting_line      count 4  md5 881c8e2a4fbfe353fa1a944f27ef9156
payment           count 0  md5 d41d8cd98f00b204e9800998ecf8427e
payment_operation count 0  md5 d41d8cd98f00b204e9800998ecf8427e
document          count 0  md5 d41d8cd98f00b204e9800998ecf8427e
```

No Ella Clarke or other reservation/folio/occupancy record was written.

## Final target truth and public views

Independent database and fresh public API reads agree:

- reservation `b6d0…` is `checked_out`;
- its only segment `cdde…` is `departed`, retaining the exact original ended period;
- occupancy `d01f…` and every occupancy for that segment are absent;
- exactly one target folio exists: `d1ded15b…`, `Primary`, `L3R-FOL-3`, window 1,
  `settled`;
- its governed statement is HTTP 200, SAR, zero rows and `balanceMinor="0"`;
- the target has one canonical guest account `6922524d…`;
- journal, posting, payment, payment operation and document remain unchanged.

I personally viewed the 375 px and 1440 px completion-session captures. Both show
Rohan Kapoor as **Departed**, the Release ribbon selected with the approved thin
yellow edge, Bill and Release complete, and the green verified statement that the
stay is departed and its recorded occupancy released. The 375 px horizontal ribbon
reveal is intentional; the work card remains inside the viewport. The two decorative
depth cards remain behind the active layer. There is no minibar, damage, missing-item,
luggage, housekeeping or inspection claim.

### Retrieval limitation (non-blocking finding)

A fresh post-checkout session cannot reopen this completed guided journey with
`checkout Rohan Kapoor`: checkout-name resolution correctly filters to active
departure candidates, so the completed Release state is transient to the session
that committed it. The completion-session captures are genuine and the persistent
API/database state is correct, but the same command is not a post-departure history
route. Until a separate UX order adds that retrieval path, staff must use checked-out
today/reservation history for a fresh post-checkout review. The completed header also
conservatively says `Room not resolved` after readiness is disabled, although the
server evidence and audit trail retain exact room 113/space `e636…`.

This does not invalidate the authorized state transition or the Order 589 requirement
to capture final 375/1440 completion views, but it must not be described as a
reload-persistent completion workspace.

## Stable post-operation baseline

After the browser/API and projection checks, I captured a third independent
all-129-table repeatable-read/read-only snapshot. It exactly matches the first
postflight:

```text
aggregate=2af37d091b40f5bec2cd5d1c69b9b78760a5133b55a24d443b9d21f25f12bff6
changedTables=[]
equal=true
```

## Evidence receipts

| Evidence | SHA-256 |
|---|---|
| `D:\Yellow\temp\order589-review-preflight-129.json` | `afa5129ff4dbf1f47d4177653a3a3a1e9e7225650d49a63b4fb8eb034cb1e9e9` |
| `D:\Yellow\temp\order589-review-target-preflight.json` | `a23f81a887b9253a87c9bb2990aa7d5f98a85a6c29d92ac0959303a5de5d7677` |
| `D:\Yellow\temp\order589-root-action-receipt.json` | `8a88f86da46d4f824dbff89e2c00569d586a05b52cfe1336432e1ef0e0807b73` |
| `D:\Yellow\temp\order589-public-checkout-action.mjs` | `fbcfb88e663e1745ce12371ae318d90252003bca685bede23540b9a72ceb04cc` |
| `D:\Yellow\temp\order589-review-postflight-129.json` | `dcb405ef2ba4cc5e2cec051567f35827681fd484f1958738471994287132ad5f` |
| `D:\Yellow\temp\order589-review-target-postflight.json` | `9eff2f7a8163866868ce128a67986ea393172909ed1d768ed1501b7a3bcc84c2` |
| `D:\Yellow\temp\order589-review-stable-129.json` | `bb8b911275e83254888095aa14a77eb7b5c386a225a9829d94d778989eb31c3e` |
| `D:\Yellow\temp\order589-public-completed-375.png` | `e2e42814a5543cc46f0a56d75d5119f8bc1e4a64a6502c56a2c02bde4fd78632` |
| `D:\Yellow\temp\order589-public-completed-1440.png` | `f5d7ebd99c05b68ae9b94c457b7c670766c2bd004afec047a0894410fe5352c4` |

## Commands personally executed

```text
bun D:\Yellow\temp\astra586-db.ts preflight  D:\Yellow\temp\order589-review-preflight-129.json
node D:\Yellow\temp\order589-review-preflight-ui.mjs
bun D:\Yellow\temp\astra586-db.ts postflight D:\Yellow\temp\order589-review-postflight-129.json D:\Yellow\temp\order589-review-preflight-129.json
bun D:\Yellow\temp\order589-review-target-snapshot.ts D:\Yellow\temp\order589-review-target-postflight.json D:\Yellow\temp\order589-review-target-preflight.json
psql read-only row-version, target-balance, exact-occupancy, fact, outbox,
  idempotency, consumer and projection attribution queries
psql -f D:\Yellow\temp\order589-projection-verification.sql
node D:\Yellow\temp\order589-review-final-api.mjs
bun D:\Yellow\temp\astra586-db.ts postflight D:\Yellow\temp\order589-review-stable-129.json D:\Yellow\temp\order589-review-postflight-129.json
Get-FileHash <all receipts, harnesses and captures> -Algorithm SHA256
view_image <preflight and completed 375/1440 captures>
```

## Approval boundary

The bounded public synthetic checkout is valid: separate human consent preceded each
governed command; each command ran once under one retained identity; exactly one
zero-balance primary folio ended settled; the reservation and segment departed; the
exact occupancy claim was released through the canonical path; all facts/outbox and
consumer effects reconcile; unrelated hotel and financial records remained stable.

The fresh-session history/retrieval limitation above remains real follow-up work and
prevents using this review as proof that the entire Yellow demo is colleague-ready.
