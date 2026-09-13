# Order466 — Independent read-only credit-note workflow acceptance

**Date:** 2026-09-13 (local). **Result:** accepted source; subsequently published
under Q257 as41415cc5. Exact CI34725373251 passed at that head; later verified
live by separate Q258r2 at2026-09-13T04:19:14UTC. Not main-merged.
**Nonimplementing reviewer:** /root. Root implemented neither production nor tests.
Production workbench/pure test: /root/q255_artifact_adapter (Terra).
Shared facade/parity test: /root/q251_artifact.
Separate real-Chromium proof: /root/q255_cutover (Sol).

## Outcome and scope

Existing invoice detail now deliberately discovers its existing full credit and
then reads that credit's registration metadata. It uses the two already-built
Orders448/452 GET routes, exact immutable identities and current request authority.
No credit issuance, debit valuation, refund, provider command, database/schema,
router, CSS/theme or runtime change. Q253 remains an unresolved economic policy.
Q256 was admitted before the extra print-asset facade was edited.

The facade calls unchanged private structural validators and status functions.
It returns only frozen code/label or null, not a signed payload, provider settings,
QR or print detail. This is structural revalidation of an already server-authorized
receipt; it is NOT independent browser signature verification.

## Root-executed acceptance

Root personally inspected both production diffs and the parity/browser proof.
Root's exact combined command (native Bun, active worktree):

```
bun test tests/operator-invoice-credit-note.test.ts tests/operator-invoice-credit-note-parity.test.ts tests/operator-invoice-credit-note.browser.test.ts tests/operator-invoices.browser.test.ts tests/operator-invoices.integration.test.ts tests/operator-invoice-print.test.ts tests/fiscal-submission-receipt.test.ts tests/operator-fiscal-credit-note.integration.test.ts tests/operator-fiscal-credit-note-list.integration.test.ts tests/operator-native-credit-delivery.integration.test.ts
```

Result: **79 pass, 9 skip, 0 fail; 1,394 assertions; 16.20 seconds.**
This includes the new real Chromium workflow (1/0,48 assertions) and unchanged
invoice browser journeys (6/0,133 assertions), using synthetic in-memory request
responses and actual served source. It does not authenticate to the retained app.

The nine explicitly gated real-PostgreSQL tests/hooks were skipped (three each in
the original credit issuance/discovery, credit-list and native-delivery suites).
They are NOT executed database proof. Those APIs/storage are unchanged; their
predecessor independently executed real-DB evidence is not re-labelled as a new run.
Injected-Tx HTTP/receipt tests did execute. No database admission was consumed.

Root also personally executed:
- native Bun + node_modules/typescript/bin/tsc --noEmit: exit0;
- native Bun + scripts/check-import-boundaries.ts: exit0,198 files;
- scoped git diff --check: no errors;
- byte back-projection: removing only the new facade from invoice-print.js yields
  the exact HEAD print source byte-for-byte. Existing rendering/validator source
  was not rewritten.

Earlier root subsets also passed: print/shared receipt30/0(528);
new pure + existing invoice/native-delivery HTTP17/3skip/0(245);
new parity + credit/credit-list HTTP25/6skip/0(440). These overlap the combined
suite and must not be summed as unique tests.

## Verified boundaries

Exact original/property/reservation/folio/recipient/document-hash bindings;
accessor-free receipt shape; positive signed-int64 money as strings; canonical
dates/timestamps; backend-compatible fiscal year; bounded Unicode scalar reasons
rendered with textContent. Malformed or foreign records do not trigger delivery.

Loading prevents duplicate reads. Refresh clears previous disclosure; denied
refresh cannot leave old credit data. A separately valid credit summary remains
visible when only delivery fails. Discovery absence, role denial, network/service
failure and invalid data remain distinguishable without asserting that a concealed
document does not exist. Delivery403/404/503/invalid states remain honest.

Pending/rejected/cancelled/sandbox never display production registration.
Only the shared accepted-production state displays IRP registered. Detached,
navigated, hidden, suspended, disposed and property-replaced views suppress stale
rendering and follow-up reads. Existing print/issue/read journeys pass unchanged.
Browser proof checks exact GET paths, no mutating credit/provider request, no
URL/storage PII and normal-width summary containment; not every possible device
or real provider is claimed tested.

## Failure history retained

The builder's deliberate missing-export RED preceded implementation.
Inspection/executable REDs exposed invalid date/year/int64/Unicode boundaries,
duplicate summaries, conflated malformed/transport and delivery error states,
detached-node rendering, delivery404 classification and accepting a null facade
result as a generic unavailable state. These were corrected before this green run.
The 501-scalar case was an inspection finding fixed before the parity worker's
execution; no independently captured RED is claimed for that specific case.
The new JS-import type declaration initially failed typecheck and was corrected.
No production or proof predicate was weakened to accept these failures.

## Frozen source identities (SHA-256)

| Path | SHA-256 |
| --- | --- |
| src/http/operator/invoices.js | dc6d4ec389d0b326f2e145f977f94aba50dab62bce2992c69a7bb8d49821ee12 |
| src/http/operator/invoice-print.js | 895803a6d7cc36df779dfa6b5e126ddcc1b441578fffd0c3f7a95c8e0f944ee8 |
| tests/operator-invoice-credit-note.test.ts | 7c9121bd724287d5d2cd012ae0c27b15478cafd04cf9e28dcc340df82015a1a5 |
| tests/operator-invoice-credit-note-parity.test.ts | 5e37c348a4f7f6d012ba3aeff3e8027f1f0b739c3fd2acf3b1c074b9a3d4e3e4 |
| tests/operator-invoice-credit-note.browser.test.ts | 027e230db285dd000a456f0633ebf9699c4c316e2cb73b6bf3c3367ae0757207 |

## Exact published-head CI acceptance

Root independently retrieved the exact run with native GitHub CLI:
`& 'C:\Program Files\GitHub CLI\gh.exe' run view 34725373251 --repo dcpnode-maker/yellow --json databaseId,headSha,status,conclusion,createdAt,updatedAt,jobs,url`.
Run34725373251 is `completed`/`success` at head
41415cc5c6953f71d9b3baada6fd9c7853567128. All six jobs passed:
quality103638457873, windows-state103638457947, local-review103638457950,
database103638722985, free-host-arm64103638722987, and
container-smoke103638722996. Root retrieved the exact database log with
`& 'C:\Program Files\GitHub CLI\gh.exe' run view --job 103638722985 --repo dcpnode-maker/yellow --log`; the
canonical result is `RESULT: 11 passed, 0 failed of 11` at
2026-09-12T23:54:19.5097303Z; the database job completed at
2026-09-12T23:54:29Z. This is CI proof for the published head and does not
relabel the prior local combined proof's nine explicit database skips.

## Historical release boundary — before Q258 recovery

The historical Q255 serving source was46004d6f/frontier91 on localhost3000,
with the existing saved login and retained PostgreSQL55503. After the fresh
Windows reboot at2026-09-13 05:02 local, all prior app/PG processes and
listeners on3000/3001/55503 were absent; no local runtime was live at this checkpoint.
New466 source is not in that historical artifact. Publication and exact-head CI
are complete, but any subsequent local promotion requires separately scoped
successor work; no consumed Q254/Q255 action or receipt may be replayed. No phase
or whole-app completion is claimed.

Q257 subsequently published the exact ten-path successor41415cc5 after scoped
working-byte/staged-content/ref preservation and exact committed blob checks.
The earlier flag discrepancy remains documented; the accepted receiving flag
baseline is independently contained and unchanged through commit. No runtime or
database action followed from publication. Exact published-head CI is now
accepted as recorded above; this does not claim local activation, database rerun
or main merge.

## Later Q258r2 delivery

Root separately verified actual immutable41415/frontier91 on the sole3000 listener
at2026-09-13T04:19:14.2088495Z, with retained PostgreSQL55503 and saved login.
Both served fiscal assets matched the frozen hashes above; authenticated invoice
reads passed while supplier issuance remained honestly unavailable. Q258r2
promotion receipt SHA256:
c64e87d70bd5f4bdeaed5ac57fa140dd813a8dc13905fbbe7ddfce680843ee8c.
See Order460/Review460/Q258 for personally executed runtime proof and retained
first-attempt failure. This does not change phase acceptance or provider authority.
