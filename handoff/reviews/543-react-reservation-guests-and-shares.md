# Order543 — independent React guests/share review

Reviewer: Astra (`/root/astra_review`), non-implementing independent agent. Date: 2026-09-21.

## Verdict: ACCEPT, bounded source and isolated API/DB proof

The final source and existing canonical guest-replacement command pass independent review and personally executed non-public proof. This is not a public deployment/postflight or whole-PMS approval. The order's desktop, 375px portrait, phone-landscape and zoom browser checks remain root-owned prepromotion gates; no reviewer browser run is claimed.

Read PROJECT.md, Order543 and DECISIONS D-298/D-300/D-301/D-304. Used code-review, Yellow entity and PostgreSQL rules to verify reuse of canonical reservation_guest, immutable primary identity/role, transaction-local tenancy and same-transaction evidence. `bash ./state.sh` was attempted and failed because WSL `/bin/bash` is unavailable; no referee/11-11 result is claimed.

## Exact final bytes

Runtime: `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.

| File | SHA-256 |
| --- | --- |
| frontend/yellow/src/App.tsx | `AA3E3A002E35F9669F7B5307284BA9641464522EEEAAB4555F43C4D82EED5365` |
| frontend/yellow/src/styles.css | `0FB32770EF42C444FCCC305F89F512217DD32B1437DE8497EB55A7631B370CD1` |
| tests/yellow-reservation-guests.test.ts | `8B70CF21637067A02C93E5B3B92193237BF871275C775B307A5855525AB8A2E3` |
| tests/yellow-reservation-lifecycle-actions.test.ts | `F58FFDA0FA74E69CE005E59E9CBCAFABB4AC72CABB8571B48A26DD4376374AA4` |
| tests/yellow-next-checkout-confirmation.test.ts | `34BE93B0FF0727D26F670A5F53926240ECB7002DA03907F882BAD21B026629FB` |
| tests/yellow-voice-routing.test.ts | `458FA4275239E55054FD004A55E2B33A3FC2BB644C06A0772A4ED7B957B28C02` |

## Source findings

- Uses only existing property-scoped `PUT .../reservations/:id/guests`, Bearer session and fingerprint-bound idempotency. No Party creation/edit, direct DML, new endpoint/event or financial routing/ownership semantics.
- Primary identity/role is not editable or included as a caller-selected replacement row. Non-primary addition rejects primary/duplicate Party IDs; accompanying role has null share. Server authorization and primary validation remain decisive.
- Legal shares are parsed into bounded integer basis points, not percentage floating-point calculations. Every canonical positive two-decimal value from 0.01 through 100.00 is accepted; exact 10,000-basis-point total is required when sharers exist. Division/toFixed is display only.
- Separate unchecked guest confirmation shows the reservation and proposed allocation. Edits clear consent; retries preserve the same normalized sorted request/key; failures preserve the draft.
- Canonical detail comparison includes exact Party/role/share membership, with sorting to avoid ordering false mismatches. Both successful and uncertain-success paths refetch/reconcile and invalidate the reservation board. No local-only success/state is invented.
- Final guest posting state participates in handler guards, visible lifecycle/operational/check-in/checkout controls, shell busy callback and voice/async supersession. Existing reservation-keyed workspaces prevent cross-record consent reuse.
- CSS contains long IDs/names using bounded grids and wrapping, with single-column touch rules. Source inspection does not replace the specified desktop/portrait/landscape/zoom browser checks.

One preliminary search-state defect was reported: invalidating an in-flight search did not clear its busy flag. The implementer fixed all close/open/query/identity boundaries before the controlled old-bug reproduction ran. That initial harness expected the old defect and therefore failed against already-corrected source; it is not recorded as a product failure. Final controlled regression verifies stale results discarded and searching=false after close/completion.

## Personally executed frontend verification

Commands from runtime source:

```text
bun D:/Yellow/temp/astra-order543-search-proof.ts
  exit0, final App hash printed; stale result discarded, busy state cleared.
bun D:/Yellow/temp/astra-order543-evidence.ts
  exit0; exact isolated evidence checks, plus extracted share parser:
  all 10,000 legal basis-point values and 12 hostile/noncanonical forms pass.
bun test tests/yellow-reservation-guests.test.ts tests/yellow-reservation-operational-details.test.ts tests/yellow-reservation-lifecycle-actions.test.ts tests/yellow-native-reservation-creation.test.ts tests/yellow-next-checkout-confirmation.test.ts tests/yellow-voice-routing.test.ts tests/yellow-stateful-neon-bloom.test.ts tests/yellow-next-public-surface.test.ts
  44 passed, 0 failed, 360 assertions across eight files; exit0.
bunx tsc --project frontend/yellow/tsconfig.json
  exit0, no diagnostics.
bun run typecheck
  exit0, no diagnostics.
bunx vite build --config frontend/yellow/vite.config.ts --outDir D:/Yellow/temp/astra-order543-reviewed-build
  exit0, 469 modules; index-DOTZFZ1n.js / index-Dl8Wzuow.css.
```

## Reviewer-owned non-public PostgreSQL/API proof

No public database, public API, tunnel, or deployed app was used. Fresh reviewer container:

```text
docker run -d --name yellow-astra-order543-pg -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=yellow_astra_order543 -p 127.0.0.1:55643:5432 postgres:16-alpine
bun D:/Yellow/temp/astra-order543-bootstrap.ts
```

The initial bootstrap applied migrations1–14 then correctly stopped at migration15 because the new database belonged to postgres rather than yellow_deploy. Corrected only the disposable database owner with `ALTER DATABASE yellow_astra_order543 OWNER TO yellow_deploy`, then normal `scripts/migrate.ts` completed15–95. No migration was edited or bypassed.

Independently ran the existing authenticated adapter suite against that isolated database:

```powershell
$env:YELLOW_OPERATOR_RESERVATION_GUESTS_URL='postgres://yellow_deploy@127.0.0.1:55643/yellow_astra_order543'
$env:YELLOW_REQUIRE_OPERATOR_RESERVATION_GUESTS='1'
bun test tests/operator-reservation-guests.integration.test.ts --timeout 120000
```

Result: **4 passed, 0 failed, 22 assertions**, including authorization/shape/total/replay/conflict and transactional outbox-failure rollback.

Then built a distinct reviewer-owned authenticated HTTP proof, reusing canonical app/services and test fixture construction but adding a future stay segment, an actual occupancy claim through `record_occupancy()`, exact full-row snapshots and reviewer assertions. Its first run stopped because the harness expected primary-replacement denial400 while the domain correctly returned conflict409. That was corrected in the reviewer harness, not implementation. To avoid relying on a consumed fixture, created another fresh database `yellow_astra_order543_retry` on the same isolated cluster, owned by yellow_deploy; normal `runMigrations` applied **95/95** from empty. The proof and follow-up catalog check verified contiguous ledger1–95.

```text
bun D:/Yellow/temp/astra-order543-api-proof.ts
  exit0 on the fresh retry database.
bun D:/Yellow/temp/astra-order543-evidence.ts
  exit0; read-only exact payload/key/ledger proof.
```

The API is `createApp().handle(new Request(...))`, not a mocked adapter. Application/identity/event pools connect as **yellow_runtime**, and a personally executed transaction asserts current_user=app_role, session_user=yellow_runtime, and the exact transaction-local tenant. Privileged access is confined to constructing the fictional isolated fixture and read-only evidence snapshots.

Dedicated tenant `00000000-0000-0000-0000-000000054301`; reservation `00000000-0000-0000-0000-000000054341`; future segment period2035-03-01T12:00Z to2035-03-02T08:00Z. No real guest/contact data was used.

| Proof | Result |
| --- | --- |
| Replace with primary60.00, one sharer40.00 | HTTP200, non-replayed |
| Identical body/key retry | HTTP200, replayed; identical response and all snapshots |
| Invalid total99.99 | HTTP400; no changed snapshots |
| Changed body under same key | HTTP409; no changed snapshots |
| Attempt primary as accompanying replacement row | HTTP409; no changed snapshots |
| Read-only authenticated actor tries write | HTTP403; no changed snapshots |

Exact evidence:

- Primary Party and role preserved; only permitted primary share changes null→60.00. Exactly two guest rows, primary60.00 and sharer40.00.
- One new reservation.modified fact, one matching outbox event and one completed reservation.guests.replace idempotency record; fact/event actor, property, reservation and correlation binding checked.
- Read-only follow-up asserts exact before/after guest diff arrays in both fact/event and SHA-256 binding to `astra543-exact-replace`, response_status200 and completed timestamp.
- Full tenant-scoped rows of reservation, reservation_segment, the nonempty space_occupancy, journal, posting_line, payment_operation, document, account, folio and Party are unchanged across guest replacement. Exact complete row comparison is stronger than count-only or hash-only comparison.
- Replay and each denial preserve complete snapshots including guest rows, facts, outbox and idempotency; no extra evidence/claim is created.
- Evidence snapshots are `SET TRANSACTION READ ONLY` after beginning, with `set_config('app.tenant_id', ..., true)`. No direct occupancy insertion/update/delete was used; fixture claim uses its governed function.

## Evidence artifacts and environment status

| Reviewer artifact | SHA-256 |
| --- | --- |
| D:/Yellow/temp/astra-order543-api-proof.ts | `CBE6BAB2FBF997C918D1E28722EDDC31AB73ECCA64DAEC538BAE3B54A4CE1D07` |
| D:/Yellow/temp/astra-order543-evidence.ts | `F83891EE1AC67B32745834FA5AE9EC9324BB02FF1C16F23F92191459290AB09B` |
| D:/Yellow/temp/astra-order543-search-proof.ts | `D9D80540795226E6CADB79FE963A25AA79A2233D73DE53D9008A9910666A67BB` |

Verified exact reviewer container name/image/loopback55643 binding, then personally ran `docker stop yellow-astra-order543-pg` (exit0). The container and fictional evidence are retained stopped; nothing was deleted. Public container/database remained untouched. No implementation edit or deployment was performed.

**Final: ACCEPT for the exact reviewed source and bounded isolated canonical-command proof.** Root must still execute/record required browser surfaces before promotion and perform a separate target-bound release/postflight. No financial split functionality, Party identity mutation, whole-PMS readiness, or referee11/11 claim is implied.

## Root-owned public deployment and browser postflight

Root deployed the exact frozen reviewed frontend to the single public application at
`https://editing-alto-artists-quilt.trycloudflare.com` without recreating or mutating
the PostgreSQL service. Post-deploy local and public `/health` returned HTTP 200.

On 2026-09-21 root used the public colleague session to open reservation
`L3R-FU-0097`, open **Guests & shares**, and visibly verify the server-owned primary
guest, existing-Party search, unchanged-allocation state, exact reservation-named
confirmation, and disabled save until a legal change exists. No browser write was
performed; the independent isolated API/DB proof above remains the mutation proof.

Responsive browser evidence:

| Surface | Result |
| --- | --- |
| Default desktop | Reservation and guest editor loaded from the public URL; no document horizontal overflow. |
| 375 x 812 portrait | Document `scrollWidth=clientWidth=360`; editor card, search field and 44px control contained. |
| 812 x 375 landscape | Document `scrollWidth=clientWidth=797`; search field and 44px control contained. |

Yellow AI activation on the same live page exposed `.yellow-neon-field` with
`background-image: none`, no `img`, `picture`, `canvas`, or `video` descendant, and
the intended CSS-only inset neon bloom/filter. The shell's broader radial CSS wash
is also procedural CSS, not an image asset. The temporary viewport override was
reset after proof. This closes Order543's root-owned browser and target postflight
only; it is not a whole-PMS completion claim.
