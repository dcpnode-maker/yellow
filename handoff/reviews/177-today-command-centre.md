# Independent review — Order 177 Today command centre

**Verdict:** APPROVED — D-455
**Reviewed tip:** `55bf924d0235ebff37ce725c58622ba7eaefd27c`
**Product candidate:** `55bf924d0235ebff37ce725c58622ba7eaefd27c`
**Base:** `e13b83d` (independently approved Order 176)
**Reviewer:** independent non-implementing OpenAI Codex
**Date:** 2026-08-26

## Corrected-candidate verdict

The corrected immutable candidate is approved with no remaining finding. Its only
product delta after the rejected candidate is stable reservation return identity,
immediate visible Today-title focus, current-cycle matching-row restoration after
lane replacement, deterministic settled fallback, and a permanent executable pure
decision/source regression. APIs, queries, schema, migrations, permissions,
dependencies and server authority remain unchanged.

The reviewer restarted every gate from zero. Focused tests passed **41/41 (582
assertions)** and standing tests passed **223/223 (2,739 assertions)**; typecheck,
66-file boundaries, 23-package licences, production audit and diff-check passed.
Combined level-9 gzip was **89,748 / 92,160 bytes**. Baseline, referee and typed-parent
fixture hashes remained exact.

The sole fresh database applied migrations 0001–0018, matched the exact schema, had
85 public test tables and passed acceptance **6/6 (13)**, referee **11/11**, review
seed **12/12 (40)** and the reservation→primary-folio→governed-charge journey **1/1
(210)**. Served HTML/CSS/JavaScript hashes were byte-identical to source.

Authenticated Microsoft Edge **151.0.4129.107** issued exactly three real Today GETs
(`due_in`, `due_out`, `in_house`) with one identical UTC `[from,to)` window,
`limit=50` and no cursor. A same-origin controlled response harness then proved
truthful cursor replacement, no inferred total, independent error/retry, route-stale
suppression and newer-generation precedence. Opening a real UUID detail from a
synthetic Today row and closing it focused visible `#today-title` immediately; the
current due-in response then focused the replacement row with that exact UUID. An
absent row settled to the visible Today title rather than BODY.

All **72/72** combinations of 375/768/1024/1440 × Simple/Advanced/Expert × six
themes had zero root/body overflow, exact datasets and a 44-pixel minimum actionable
target. 200% page scale remained contained; reduced motion matched with 0.01 ms
maximum computed duration and no active animation; keyboard Tab reached the visible
outlined Today refresh. All observed resources were same-origin and runtime
exceptions were zero.

One first Edge harness attempt submitted before the deferred script attached and put
its disposable review password into its isolated URL. The reviewer immediately
destroyed that entire Edge profile, database volume, image, network and authority
file, then generated a fresh unrelated credential set and reran the complete browser
proof successfully. No production or founder-local credential was involved, and the
discarded attempt is not counted as evidence. Final Edge/profile/stack/secrets were
also removed; ports 3000 and 3002 were never bound or touched.

Approval is limited to Order177's bounded read-only Today surface and focus correction.
It grants no merge, push, promotion, deployment or Phase-wide completion authority.

## Prior finding preserved

### F1 — UUID detail return loses the Today row's keyboard focus

The authenticated Browser proof populated Due in with a real disposable
reservation row, activated its existing UUID detail flow, waited for complete server
detail, and activated **Close reservation details**. The URL correctly returned to
`/p/{property}/today`, the originating reservation button remained connected and was
visible again after the lane completed, but `document.activeElement` was `BODY`
both immediately after return and after the replacement page rendered. It was never
the originating reservation button.

The failure follows production execution order. `closeReservationDetail()` calls
`setView("today", false)`, which synchronously calls `loadToday()` and hides each
`[data-today-list]` for loading, before it calls `.focus()` on the stored row button.
Focus on that hidden descendant cannot succeed; a later `replaceChildren()` would
also invalidate the original node. This violates Required experience 6 and the
mandatory keyboard/focus proof.

Carry a stable reservation return identity and restore focus only after the current
Today lane renders the matching replacement row. If it is absent, use a deterministic
visible Today fallback such as `#today-title`; never leave focus on `BODY`. Add a
permanent executable regression, then submit a new immutable candidate for a complete
independent restart.

## Reviewer-executed evidence

- exact product scope: only the permitted route, three operator assets and focused
  test changed; API handlers, queries, schema, migrations, permissions, dependencies,
  events and protected surfaces were unchanged;
- focused **40/40 (569 assertions)** and standing **222/222 (2,726 assertions)**;
  typecheck, 66-file boundaries, 23-package licences, audit and diff-check passed;
- level-9 gzip was **89,015 / 92,160 bytes**; protected baseline, referee and typed
  fixture SHA-256 values remained exact;
- sole isolated stack applied migrations 0001–0018, had 85 tables, matched the exact
  schema, passed database acceptance **6/6 (13)**, referee **11/11**, review seed
  **12/12 (40)** and founder reservation→folio→governed-charge **1/1 (210)**;
- served HTML/CSS/JS hashes matched source; actual authenticated Refresh issued exactly
  three GET requests with `due_in`, `due_out`, `in_house`, one paired UTC `[from,to)`
  window and `limit=50`, and returned truthful independent empty states;
- the 72-case 375/768/1024/1440 × three-experience × six-theme Chromium matrix had
  zero root/body overflow, exact datasets and a 44px minimum actionable target; 200%
  page scale and reduced motion stayed contained;
- reviewer-controlled same-origin response harness proved one-lane cursor replacement,
  no false total, one-lane error/retry isolation, route-stale suppression and
  newest-generation wins. Those harness responses are not server evidence and were
  kept separate from the actual three-GET proof.

The first provision attempt raced immediately after `pg_isready`; it was discarded
and repeated only after a real SQL query. The first referee invocation hit Windows
CP1252 output encoding; the test database was recreated and the exact UTF-8 referee
rerun passed. A first target measurement included the non-actionable `h2[tabindex=-1]`;
the actionable selector reran all 72 cases. None of these harness preconditions is
counted as product evidence.

The reviewer-owned Browser tab, containers, image, network, volume and generated
secrets were removed. Ports 3000 and 3002 were never bound or touched.

No approval, merge, push, promotion, deployment or Phase-wide completion authority
is granted.
