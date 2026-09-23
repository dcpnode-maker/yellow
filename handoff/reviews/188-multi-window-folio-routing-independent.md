# Order 188 — multi-window folio routing independent Tier-3 review

**Conclusion:** CHANGES-REQUIRED

**Reviewed candidate:** `3ee48f60407055ca754c21567a0456ad4e63e707`

**Reviewer:** independent non-implementing OpenAI Codex agent

## Blocking finding

The mandatory fresh database-acceptance gate is red. Migration `0020` applies and its
schema is exact, but `tests/database-acceptance.integration.test.ts` still defines the
exact migration ledger only through `0019_financial_reversal_authority.sql`. On a
database recreated from zero, the test receives the correct additional `0020` row and
fails its exact equality assertion:

```text
5 pass, 1 fail
Expected migration ledger: 0001..0019
Received migration ledger: 0001..0020
0020 checksum: 137c9aea660aea953b86b8bdb1233af6385ddf73daa01a25bfa3149af416d9f1
```

This is an in-scope migration-acceptance fixture omission. Required repair: append the
exact migration-0020 tuple and committed checksum to `EXPECTED_MIGRATIONS`, then rerun
the complete Order188 proof on a new candidate. Do not weaken exact ledger equality.

## Reviewer-executed evidence

- P0: exact intentional-red predecessor `8e1e98f` failed **12/12** preregistered
  additional-window, lineage, transfer-domain, HTTP and UI assertions. The disposable
  detached worktree was removed afterward.
- Fresh disposable database on loopback `:5442`: migrations `0001`–`0020` applied from
  zero, exact **85 public tables**, schema drift green, migration replay a no-op.
- Referee: **11 passed, 0 failed of 11**, including occupancy races, immutable ledger,
  sealed day, gapless numbering and tenant isolation through tables/views.
- P1–P6 focused proof: **32 passed, 0 failed, 363 assertions**. This personally covered
  exact lineage constraints/index/ACL/owner/search path, pg_temp containment, runtime
  DML authority, raw and forged denial, 20-way gap-free window creation, replay and
  rollback, balanced whole-group routes, original-row immutability, zero-net stay
  truth, repeated routing, 20-way same-group race, publisher rollback, transfer versus
  correction arbitration, sealed/closed/foreign/hostile boundaries and static HTTP/UI
  contracts.
- Standing non-database suite: **258 passed, 501 database-gated skipped, 0 failed,
  3,335 assertions**.
- TypeScript typecheck green; import boundaries green over **68 TypeScript files**;
  licence policy green for **23 installed packages**; `bun audit` reported no
  vulnerabilities.
- Combined operator payload gzip: HTML 19,860 + CSS 17,853 + JavaScript 60,455 =
  **98,168 / 98,304 bytes**, leaving 136 bytes.
- Protected diff for `migrations/0001_init.sql`, `tests/run_invariants.py`,
  `docker-compose.yml` and `bun.lock` is empty. Candidate worktree was clean before
  governance evidence.

## Browser status

A direct transient Bun harness—not a second Docker app stack—ran healthy on loopback
`:3188` against the disposable `:5442` database. The approved sole app on `:3000`
remained listening and untouched. The in-app browser connected and verified the
signed-out candidate DOM, including the five appearances and three detail choices.

The authenticated P7 matrix did not execute because action-time confirmation to enter
the local review credential was not supplied. No password, token or other credential
was typed, transmitted or inspected. No authenticated workflow, screenshot,
structural-distinction, 200% reflow, forced-colour, reduced-motion, keyboard/pointer or
runtime-error claim is made. After the P8 defect was found, the browser tab was closed,
viewport reset, and the transient `:3188` process stopped; `:3000` remained bound.

## Re-review gate

Candidate `3ee48f6` is not approved and is not eligible for local replacement,
promotion, merge, push, deployment, production or Phase-wide completion. A corrected
candidate requires a fresh non-implementing Tier-3 review that reruns P1–P8, including
the fresh database-acceptance suite and the complete authenticated browser matrix.

---

## Re-review — repaired candidate `0713b7b`

**Conclusion:** STATIC/FINANCIAL-APPROVED · AUTHENTICATED-P7-BROWSER-PENDING

**Exact candidate:** `0713b7b58e37df58416b9a083f5d2d1e14fbad7f`

The only product delta after the rejection is the exact version-20 filename and
checksum tuple appended to the existing exact migration ledger fixture. The migration
file itself hashes to
`137c9aea660aea953b86b8bdb1233af6385ddf73daa01a25bfa3149af416d9f1`, matching the
new tuple. No migration, schema, runtime, domain, HTTP, UI, seed, dependency or
protected file changed.

The reviewer personally rebuilt `yellow_test` from zero and reran the rejected gate:
schema drift matched, database acceptance passed **6/6 with 13 assertions**, and a
second migration invocation was an exact no-op. Fresh P1–P6 proof passed **30/30 with
353 assertions**, including every Order188 financial, authority, concurrency, hostile
and rollback case. A separately rebuilt fixture database contained exactly 85 public
tables and the protected referee passed **11/11**.

The reviewer also reran the standing suite (**258 passed, 501 database-gated skipped,
0 failed, 3,335 assertions**), typecheck, 68-file import boundaries, 23-package licence
policy and dependency audit. The operator assets are byte-unchanged at combined gzip
**98,168 / 98,304 bytes**. The repaired range passes `git diff --check`; exact diff
from the rejected governance head contains only
`tests/database-acceptance.integration.test.ts`.

Authenticated P7 remains unexecuted because action-time confirmation to type the local
review credential is still absent. No credential was entered or inspected, no
transient browser harness was started, port `:3188` is unbound, and the approved sole
`:3000` app remains listening and untouched. Consequently this verdict approves the
schema, financial behavior, authority, concurrency, static contracts and all
non-credential gates, but does not approve local replacement, promotion, merge, push,
deployment, production, Phase-wide completion or the required authenticated browser
matrix. Full Order188 approval still requires P7 on this exact candidate.

---

## Authenticated P7 retry — browser unavailable

**Conclusion:** P7-PENDING · NO PRODUCT FINDING · NO PROMOTION APPROVAL

After the founder explicitly authorized action-time entry of the existing local-only
review credential, the reviewer started one direct transient Bun harness on loopback
`:3188` against the disposable review database. Health returned the exact
`{"status":"ok"}` response, while the independently approved app remained the sole
listener on `:3000` and was not restarted, replaced or inspected.

Before any credential entry, the previously selected in-app browser binding became
unavailable. The reviewer followed the browser and bootstrap troubleshooting
instructions; fresh target selection reported no browser available, and the one
permitted browser inventory returned an empty list. Browser policy forbids substituting
an unrelated browser-control surface or source-code workaround. Therefore no password,
token or other credential was read, typed or transmitted, and no authenticated DOM,
workflow, screenshot, transition, viewport, zoom, forced-colour, reduced-motion,
keyboard/pointer, target-size, overflow, console or request-error claim is made.

The transient process was then stopped cleanly. Port `:3188` is unbound and `:3000`
remains bound by its original process. The STATIC/FINANCIAL approval at `0713b7b`
stands; full Order188 approval and every promotion/integration action remain blocked
on a browser-capable independent execution of authenticated P7 on that exact product.

A coordinator subsequently released its own supported in-app-browser binding, then
created and handed off a fresh candidate tab (`Yellow · Hotel Operations`, tab `8`).
This reviewer's required direct `getForUrl("http://127.0.0.1:3188/")` selection still
reported no browser, and the prior documented binding reported disconnected when asked
for the handed-off tab. The skill forbids resetting the persistent browser runtime or
substituting another surface after this condition. A second isolated `:3188` harness
was therefore stopped with the same no-credential/no-browser-proof verdict; `:3000`
again remained untouched.

---

## Fresh authenticated P7 — browser changes required

**Conclusion:** CHANGES-REQUIRED · STATIC/FINANCIAL EVIDENCE RETAINED · NO PROMOTION APPROVAL

**Exact product candidate:** `0713b7b58e37df58416b9a083f5d2d1e14fbad7f`

**Reviewer:** fresh independent non-implementing OpenAI Codex agent

The reviewer recreated one transient direct-Bun harness on loopback `:3188` against
the disposable review database on `:5442`. Direct
`getForUrl("http://127.0.0.1:3188/")` selected the Codex in-app browser. The complete
browser documentation was emitted and read, the founder-authorized protected local
credential was entered without printing, logging or persisting it, and authentication
succeeded as Yellow Review Operator. The sole approved app on `:3000` remained owned
by its original container and was not restarted, replaced or inspected.

### Blocking P7 findings

1. **Additional-window creation is not wired to a usable reservation identity.** On
   authenticated `HAR-FOL-1`, entering `Business` and submitting the visible New folio
   window form sent
   `/api/v1/properties/976f0f64-1102-5af8-ba5b-47678f8a5436/reservations/undefined/folios`.
   The server correctly returned HTTP 400 `request/invalid`, and the UI rendered
   `Additional folio input is invalid. Retry keeps the same idempotency key.` Two
   pointer retries emitted the identical body and identical retained key, proving the
   retry contract itself works, but both used the same invalid `undefined` route.
   Create therefore cannot complete; move, reroute and successful retry cannot be
   exercised through the product. This is a direct failure of Order188 P7 and the
   order outcome.
2. **The Android 375px target-size gate is red in every detail mode.** After a full
   450 ms settle, enabled visible navigation controls measured `Today` 40x48 and
   `Folios` 41x48 in Simple, plus `Rates` 37x48 in Advanced and Expert. Order188
   requires every target to be at least 44px and the Android system calls for 48dp.
3. **Property isolation leaves stale prior-property truth visible.** After correcting
   `HAR-FOL-1`, switching from Harbourlight to Riverstone and searching the forbidden
   Harbourlight reference correctly returned not found, but the Riverstone route still
   displayed the prior `HAR-FOL-1` heading plus CAD, window count and prior totals
   beneath the error. No posting rows or account/Party data crossed, but stale
   property-scoped financial state painted under the new property route, contrary to
   the property-exit/stale-paint contract.
4. **Required keyboard activation did not execute.** With the native enabled buttons
   focused, Enter/Space through both the semantic locator and the browser keyboard did
   not open New folio window or Correct a wrong charge; pointer clicks opened both
   flows. Because the same supported browser activated the pointer handlers and the
   buttons remained enabled with `tabindex=0`, the mandated keyboard create/correct
   proof is red even apart from the invalid create route.

### Reviewer-executed browser evidence

- Pointer correction succeeded in the disposable database: the immutable ROOM charge
  remained, a new `adjustment` row of `-18000` appeared with typed reversal lineage,
  the active/stay balance became zero and the line count became two.
- Dirty Back produced a confirmation prompt. Dismissing it retained the `Business`
  draft. Reload preserved the authenticated deep link, Neo/Expert appearance/detail,
  the draft, error and logical input focus. Appearance/detail changes likewise retained
  the deep link, draft and focus.
- The fully settled five-appearance x three-detail x four-width matrix executed all
  **60/60** combinations at 375/768/1024/1440. Theme/detail values were exact and all
  60 had zero root overflow. Apart from the Android 375px finding above, no enabled
  visible control measured below 44px.
- Settled authenticated 1440px screenshots were captured and personally inspected for
  all five appearances. Their structure remains materially distinct: Apple uses the
  white low-depth content plane; Android uses asymmetric 28px/28px/12px expressive
  surfaces; Win95 uses a 274px rail, square system-grey bevels, navy title plane and
  pixel shadow; Glass uses a 278px rail, transparent financial plane,
  `blur(22px) saturate(1.55)` and specular inset depth; Neo uses a 250px rail and
  coherent paired `-9px/+9px` tactile shadows. All five screenshots had zero root
  overflow.
- At 200% page scale the visual viewport was 712.4px wide with scale 2 and zero root
  overflow. Reduced-motion removed animations and collapsed transitions to the
  immediate 0.00001s fallback with zero overflow. Forced colours removed shadows and
  backdrop filters, restored solid borders and retained zero overflow.
- Final browser console warning/error collection was empty. The two intentional failed
  creation requests are the only observed request errors.

The transient tab was closed, viewport/emulated media/page scale were reset, and the
`:3188` listener was stopped. `:3000` and `:5442` remained bound to their original
process. Candidate `0713b7b` is not eligible for local replacement, promotion,
integration, merge, push, deployment, production or Phase-wide completion. Repair
must restore the reservation identity used by the additional-window browser command,
meet the Android target-size minimum, clear stale prior-property financial state and
make the visible button workflows keyboard-operable, then obtain a fresh independent
authenticated P7 on the corrected exact product.

---

## Re-review — repaired candidate browser unavailable

**Conclusion:** STATIC/DB-GREEN · AUTHENTICATED-P7-PENDING · NO PROMOTION APPROVAL

**Exact candidate:** `0096ac4eff2944af68b033700cf5ef227f6ce971`

The same independent non-implementing reviewer inspected the exact repair from
`db281418616bf6703983ba8aeeb4b63361efeaad`. Its eight-file product/test delta adds the
nullable safe top-level reservation identity to the folio statement, clears all prior
folio presentation before a property-scoped read, disables additional-window creation
without an exact reservation UUID, adds bounded non-repeating Enter/Space activation,
and enforces 48px Android mobile domain targets. No migration, transfer capability,
posting mutation, dependency, credential or approved `:3000` local changed.

Reviewer-executed proof on the disposable `:5442` database passed **39/39 with 391
assertions** across migration-0020 authority, fresh statement projection, 20-way
additional-window and transfer concurrency, immutable balanced routing, hostile and
rollback cases, exact HTTP/UI contracts and theme target regressions. TypeScript
typecheck passed; import boundaries passed over 68 TypeScript files. Related folio,
theme and motion tests passed **23/23 with 349 assertions** plus five intentionally
database-gated skips. The full standing suite passed **263**, skipped 502 database-
gated cases and failed zero with 3,373 assertions. Licence policy passed for 23
packages and `bun audit` found no vulnerabilities. Exact operator gzip is HTML 19,799
+ CSS 17,853 + JavaScript 60,645 = **98,297 / 98,304 bytes**.

The reviewer then started one transient direct-Bun harness on loopback `:3188`
against `:5442`; health returned exact HTTP 200 while the approved app on `:3000`
remained bound by its original process. Required direct
`getForUrl("http://127.0.0.1:3188/")` returned `No browser is available`. After reading
the mandated bootstrap troubleshooting documentation, the one permitted inventory
returned `[]`. The coordinator explicitly reset and released its own browser binding;
a retry through the same existing runtime still returned `No browser is available`.
Policy forbids resetting again or substituting another browser-control surface.

Consequently no credential was read or entered and none of the four repaired browser
journeys is claimed: successful non-undefined creation/move, exact Android 375px target
geometry, stale-property visual clearing, or non-repeating Enter/Space activation.
The earlier rejection of `0713b7b` remains valid, while `0096ac4` is a repaired
static/database-green candidate awaiting a browser-capable independent authenticated
P7. The transient `:3188` process was stopped and is unbound; `:3000` and `:5442`
remain on their original listeners. No local replacement, promotion, integration,
merge, push, deployment, production or Phase-wide completion is approved.

### Final bounded browser-panel recovery

The reviewer made the authorized final recovery attempt without changing the candidate
or prior proof. A fresh direct-Bun `0096ac4` harness again returned exact health 200 on
loopback `:3188`, with `:3000` untouched. The coordinator explicitly opened
`http://127.0.0.1:3188/` in the Codex right browser panel; the app reported that open as
queued for this exact task. Direct `getForUrl` still returned `No browser is available`
and the supported inventory remained `[]`. The coordinator then explicitly navigated
the app to this exact task to materialize the queued panel. The reviewer restarted the
same transient harness, reconfirmed health 200 and retried direct `getForUrl`; it again
returned `No browser is available`.

No credential was read or entered and no repaired browser journey is claimed. Both
transient listener processes were stopped after their bounded attempts; `:3188` is
unbound and original `:3000`/`:5442` listeners remain. The verdict stays
STATIC/DB-GREEN · AUTHENTICATED-P7-PENDING, with no approval or promotion claim.

### Founder-authorized available-browser retry

After the coordinator independently proved the Codex in-app browser available against
`:3000`, read its complete documentation and explicitly reset/released that binding,
the founder repeated authorization for protected credential entry and the repaired
browser proof. The reviewer started exact candidate `0096ac4` on a fresh direct-Bun
loopback `:3188` harness; health was exact HTTP 200 and `:3000` remained untouched.
Direct `getForUrl("http://127.0.0.1:3188/")` in this reviewer's required existing
runtime nevertheless returned `No browser is available` before credential entry.

The coordinator then explicitly opened the `:3188` right-panel target, received a
queued result and navigated the Codex app to this exact task with `navigated:true` to
materialize it. The one authorized same-runtime retry again returned
`No browser is available`. Browser policy forbids resetting the reviewer's runtime or
substituting another control surface after discovery failure. No credential was read
or entered and no browser result is claimed. The harness was stopped; `:3188` is
unbound and the original `:3000`/`:5442` listeners remain. Static/database evidence
for `0096ac4` remains green, but authenticated P7 and approval remain pending.

## Fresh authenticated P7 approval — repaired candidate

**Conclusion:** APPROVED

**Exact product candidate:** `0096ac4eff2944af68b033700cf5ef227f6ce971`

A fresh independent non-implementing OpenAI Codex Tier-3 reviewer used the founder's
action-time authorization to enter the existing protected review credential only into
the loopback `127.0.0.1:3188` login. The credential was never printed, persisted,
copied to governance evidence or sent off-host. The candidate ran as one transient
direct-Bun harness against the disposable/current isolated database on `:5442`; exact
health was HTTP 200, the approved app on `:3000` remained HTTP 200 and untouched, and
`:3188` was stopped and unbound after review. Canonical review identities/grants were
refreshed only in the disposable database after its prior seed rejected login.

The reviewer personally executed the four repaired browser journeys. Enter opened
the inline New folio window task exactly once; server-backed creation of `Business
Review` succeeded, selected the new `HAR-FOL-13` sibling, reported two exact windows
and did not issue or surface an `undefined` reservation route. At Android 375px,
expanded `Today`, `Folios` and `Rates` measured respectively 48x48,
49.68x49.68 and 48x48 CSS pixels. Switching Harbourlight to Riverstone cleared the
entire prior presentation before a forbidden `HAR-FOL-1` read; the result was the
generic not-found response with `Folio workspace`, em-dash totals/currency, zero
windows and no Harbourlight reference, CAD value or previous lines. On eligible
`RIV-FOL-1`, Enter and Space each exposed exactly one `Correct a wrong charge` form;
the existing original remained untouched because no correction was submitted.

The settled five-appearance x three-detail x four-width browser matrix passed 60/60
at 375/768/1024/1440 with zero document/root overflow. Android 375 stayed at a 48px
minimum width and at least the 44px cross-platform minimum height in all three detail
modes. Page scale 200% produced visual scale 2 and zero overflow. Reduced motion had
zero active animations and zero transitions longer than the immediate fallback.
Forced colours had zero box shadows, zero backdrop filters and zero overflow. A dirty
new-window draft retained its exact value, deep route and focused name control while
switching Apple to Glass and Simple to Advanced. The final warning/error console was
empty. Two browser-control session resets occurred during optional continuation; a
fresh authenticated tab resumed from server truth and completed the remaining
correction and console proof without cached evidence.

Reviewer-executed repository proof passed the focused routing/theme/workbench set
32/32 with 474 assertions plus five intentionally database-gated skips, and the
correctly role-separated PostgreSQL set passed 34/34 with 198 assertions across
migration 0020, statements, additional-window concurrency, immutable balanced
routing, hostile boundaries and rollback. The standing suite passed 263/263 with
3,373 assertions plus 502 intentional database skips; TypeScript, 68 import
boundaries, 23-package licence policy, audit and diff checks were green. An initial
reviewer harness invocation incorrectly supplied the deployment URL to the transfer
runtime and reproduced the capability's expected `42501`; rerunning with the exact
runtime principal passed 34/34. The final `setup.ps1 -DbOnly` wrapper hit the inherited
Windows readiness false-negative at line 158 even while Docker reported the exact
`:5442` container healthy and `pg_isready` reported accepting connections; it changed
no product result and the earlier reviewer-executed exact-candidate referee remains
11/11.

No product file was edited by this reviewer. Exact candidate `0096ac4` is approved for
the bounded Order188 local-promotion/integration decision. This does not itself
replace `:3000`, merge, push, deploy production, issue invoices, or claim Phase-wide
completion.
