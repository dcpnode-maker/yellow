# Order 492 independent review — embedded check-in slice

Date: 2026-09-20. Reviewer: **Codex Astra**, independent agent `/root/astra_review`, not the implementer.

**Verdict: ACCEPT the final frozen, bounded embedded check-in source slice.** Initial findings were corrected by the implementer and independently rechecked. This is **not acceptance of all Order 492 deliverables**, a browser/mobile usability certification, or authorization to deploy.

## Final reviewed bytes

Runtime source: `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.

- `frontend/yellow/src/App.tsx`: SHA256 `2BC65EFF3A7FC8B62451D26BBB56FC61AC3AD0B7ADC1BC2AC3CBA3270EF334D1`.
- `frontend/yellow/src/styles.css`: SHA256 `A83BEC56EE4207847960151C0B24620B92381EF23F0AD4B992BADCBAC9115ECC`.
- `tests/yellow-voice-routing.test.ts`: SHA256 `D9987E40229C13935568A17FE8F6994257F1FF1A2CC898ECA766D720191D7039`.
- Corrected existing `tests/yellow-next-checkout-confirmation.test.ts` oracle: SHA256 `A43A04EB71F1F52650C2F7E0D63D69F54E439D92DAA82CD96C39E71E0C673FFD`.

Read PROJECT, Order 492 and the canonical check-in HTTP/domain paths. The code-review skill guided behavioral checks; Yellow Postgres/entity skills guided the independently executed real-database proof.

## Findings, remediation and final source assessment

The initial submitted component retained confirmation when a different named reservation reused the same component position, generated a new key for each request, and did not refresh/reset after a denial. Initial step presentation also marked any truthy room condition (including dirty) complete and treated identity readiness alone as folio readiness. These were reported to the implementer; the reviewer did not edit production code.

Final source closes those findings:

- The parent keys `OverwatchCheckInJourney` by reservation ID, so selecting another arrival remounts with confirmation false.
- A `useRef` owns a per-mounted-journey idempotency key; confirmed retries in that journey pass the same key to `commitCheckIn`.
- A failed commit refetches authoritative reservation/readiness and clears confirmation. Loading/error/blocked state does not expose an enabled commit; dirty-room and missing-open-folio steps now display blocked.
- UI enablement requires due_in plus the server's `canCheckIn === true`, a visible checked confirmation, and no in-flight commit. Voice parsing only opens the work surface; it does not call a mutation.
- Reads use only existing reservation detail and `GET /api/v1/properties/:property/reservations/:reservation/check-in/readiness`; the mutation is only existing `POST .../check-in`, bearer authenticated, JSON `{}`, supplied idempotency key. No browser-derived override authority, tenant selection, occupancy write, SQL path, journal or outbox mutation was added.
- The unchanged HTTP layer validates input/key, required scope and property grant, derives actor/tenant/override authority from server context, and delegates to `CheckInService`. The unchanged service rechecks locked authoritative readiness in its tenant transaction and writes reservation transition plus fact/outbox atomically under server idempotency. Frontend stale data cannot override those checks.
- Checkout state remains separated inside `ReservationWorkspace`. Its previous whole-file negative string assertion failed merely because a different component introduced a local variable named `confirmed`; narrowing the assertion to its intended component correctly repairs that oracle without a checkout behavior change.

## Personally executed frontend proof

In runtime source:

```powershell
bun test tests/yellow-voice-routing.test.ts tests/yellow-next-checkout-confirmation.test.ts tests/yellow-next-public-surface.test.ts
bunx tsc --project frontend/yellow/tsconfig.json
bunx tsc --noEmit
bun D:/Yellow/temp/astra-order492-review-20260920/component-proof.ts
```

Final combined result: **15 pass / 0 fail / 68 assertions**. Both explicit TypeScript commands exited **0**. Separately, voice-only suite: **12 pass / 0 fail / 47 assertions**.

The retained independent component harness extracts/transpiles the actual component/helper and exercises controlled hooks/queries, not a separately reimplemented command. It passed:

- reservation-key remount starts unconfirmed;
- denial refetches both queries and clears consent;
- confirmed same-mount retries reuse the key;
- dirty readiness disables commit and marks its step blocked;
- missing open folio marks the step blocked;
- query error renders no commit action;
- helper emits exact canonical POST, bearer header, `{}` body and stable supplied key.

Harness SHA256: `E7DE5EE9492EAAB5CA5B32FC0A702B94ACCA0024E7BD6347A853AEFB79DADC28`. This is a **controlled component-function proof**, not an actual React DOM/browser test; remount behavior follows the inspected React key and is modeled by the harness. The initial exploratory harness became stale when implementation changed during review and was not used as final proof. The final hashes above were checked after all reruns.

## Personally executed fresh PostgreSQL proof

Created a completely new reviewer-owned native **PostgreSQL 16.15** cluster at `D:/Yellow/temp/astra-order492-review-20260920/data`, bound only to **127.0.0.1:55517**, database `yellow_astra492_review`. No public database, app or tunnel was accessed.

```powershell
initdb.exe -D D:/Yellow/temp/astra-order492-review-20260920/data -U yellow_deploy --auth=trust --encoding=UTF8
# Hidden postgres: -D <above> -h 127.0.0.1 -p 55517
# Created documented owner/runtime/registrar roles with random in-process passwords.
# Created yellow_astra492_review and applied runMigrations through 0095.
$env:YELLOW_DEPLOY_DATABASE_URL='postgres://yellow_deploy@127.0.0.1:55517/yellow_astra492_review'
$env:YELLOW_RUNTIME_DATABASE_URL='postgres://yellow_runtime@127.0.0.1:55517/yellow_astra492_review'
$env:YELLOW_REQUIRE_STAY_CHECKIN='1'
bun test tests/stay-checkin.integration.test.ts tests/operator-checkin-workbench.integration.test.ts --timeout 120000
```

Result: **11 pass / 0 fail / 59 assertions**, no skipped cases. Tests create their own synthetic fixtures. Personally verified executable coverage includes:

- clean due-in transition, one fact/outbox and exact replay;
- wrong-state, assignment and primary-folio blockers with no writes;
- dirty-room override requires server-derived authority and an attributable reason;
- configured identity gate fails closed without leaking document data;
- foreign tenant/property/actor and raw runtime authority denial;
- actor-bound replay and twenty contenders converging to one effect;
- HTTP no-store readiness, property grants, rejection of browser authority fields and fail-closed key/input handling.

These are the **existing canonical check-in/API tests**, not the separate 11-invariant referee. They demonstrate the reused server safeguards; they do not constitute a new end-to-end browser-to-database test. This UI slice neither writes occupancy directly nor introduces a charge/journal command. Charge-posting/journal-balance proof remains part of the undelivered broader order, not claimed here.

## Remaining delivery/release gates

Order 492 also calls for governed prerequisite actions, eligible-room selection/assignment preview, cashier charge capture/confirmation, comprehensive capability catalogue and desktop/mobile browser evidence. This bounded component summarizes current readiness and allows a ready arrival to commit; it does not complete those broader workflows. Do not mark the entire order complete on this review.

The key is stable within one mounted journey, not durable across reload/unmount. No across-reload unknown-outcome recovery or visual/mobile interaction proof is claimed. Cached client readiness is advisory; commit correctness relies on the independently tested server revalidation. Permanent rendered-component tests would strengthen the current source-string assertions and should accompany broader journey delivery.

Whole-repository referee/CI, public-target preflight and separate release approval remain outstanding. No deployment occurred. Reviewer stopped only the owned cluster with `pg_ctl.exe -D D:/Yellow/temp/astra-order492-review-20260920/data -m fast -w stop` (exit 0); retained data/harnesses remain available. No source implementation was edited by the reviewer.
