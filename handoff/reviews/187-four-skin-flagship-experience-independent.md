# Order 187 — four-skin flagship experience independent review

**Conclusion:** CHANGES-REQUIRED

**Reviewed candidate:** `90a8eb04ffd2546b1ea22e9995ae703a4bf5a382`

**Reviewer:** independent non-implementing OpenAI Codex agent

## Scope and product inspection

The exact diff from Order187 admission `85a8023` to candidate `90a8eb0` changes only
the three allowed operator assets and the new focused motion test. It changes no API,
route, context, kernel, database, schema, migration, seed, permission, dependency,
container, credential or network binding. The selector remains exactly Apple,
Android, Windows95/98 and Glass, with Apple fail-closed. The semantic domain controls
keep their accessible names while the new inline SVG icons are `aria-hidden`; no
external asset, font, vendor artwork or dependency was added.

Source inspection confirms meaningful non-colour composition differences: Apple's
restrained horizontal command shelf and solid data planes; Android's tonal pill and
12-column bento treatment; Windows95/98's navy title chrome, square bevels and tactile
focus; and Glass's anchored rail, layered folio tabs, luminous depth and opaque dense
financial planes. The dependency-free coordinator is interruptible, caps its duration
at 400 ms, scopes view transitions to the workbench, uses only opacity/transform in
its explicit fallback, and avoids persistent storage or permanent `will-change`.

## Blocking finding

Order187 motion contract section 5 and D-486 require immediate fallbacks for coarse
pointer, forced colours and missing backdrop support. The candidate's Glass rule
still applies `animation: glass-stage-in 280ms ...` to every newly visible workbench
section. The reduced-motion block disables that animation, but the coarse-pointer,
forced-colours and `@supports not (backdrop-filter)` blocks do not. Consequently the
JavaScript coordinator correctly refuses motion in those three modes while the CSS
stage animation continues independently. This is a contract failure and prevents
approval.

Required repair: disable the exact Glass workbench-section animation in each of the
three fallback blocks, and extend the focused test so all three fallbacks are
executable/static requirements rather than an untested convention. Do not weaken the
fallback contract, remove the flagship transition for supported fine-pointer users,
or raise the payload ceiling.

## Reviewer-executed proof

- `git diff --check 85a8023..90a8eb0` — green.
- Focused theme/adaptive/motion tests — **14 passed, 0 failed, 277 assertions**.
- Standing `bun test` — **246 passed, 491 database-gated skipped, 0 failed, 3,104
  assertions**.
- `bun run typecheck` — green.
- `bun run boundaries` — **67 TypeScript files**, green.
- `bun run license-check` — **23 installed packages**, green.
- `bun audit` — no vulnerabilities.
- Exact combined gzip: HTML 20,154 + CSS 17,230 + JS 59,766 = **97,150 / 98,304
  bytes**, leaving 1,154 bytes.
- Exact SHA-256: HTML `8e0b754cb4d0e4e96f9bad11cf3fc7d6d2920955bb0cc8ac528f09c21168bdac`;
  CSS `2165b4d3b79d8659bb0c2e942834190b4c7c9c4aa050925dc7eef581ededdd2a`;
  JS `90ccb52a5c5fb3e8c38419aa2655680e2154481468c566cb60bdf6dfc27e0be9`.
- Protected product/database/runtime scope diff — none.

The reviewer attempted an offline browser document containing the exact committed
HTML/CSS/JS plus a non-production visibility harness. Browser URL policy rejected the
local data document. Per that policy, no alternate browser surface or indirect
workaround was attempted. Therefore no independent settled desktop/phone screenshot,
computed-style, focus, overflow, request-console or transition-runtime claim is made.
The approved sole local on loopback port 3000 and its database/runtime/credentials
were not inspected, restarted, replaced or mutated. The database referee was not
rerun because this review was explicitly non-mutating and the candidate has no
protected/database diff; D-485 remains the exact sole-local authority.

## Re-review gate

After the fallback repair is committed, a non-implementing reviewer must rerun the
focused/static/full/type/boundary/licence/audit/gzip proof and complete the mandatory
authenticated settled-screenshot and recorded-transition review before any local
promotion. This review does not approve replacement, promotion, restart, deployment,
merge, push, Phase-wide completion or any database/runtime change.

---

## Re-review — corrected candidate `dc5d1a1`

**Conclusion:** STATIC-APPROVED / BROWSER-PENDING

The exact repair adds `animation: none` for the Glass workbench stage inside
no-backdrop, forced-colours and coarse-pointer fallbacks, while retaining the existing
reduced-motion fallback. The focused test now requires all four exact declarations.
The original blocking finding is resolved without weakening supported fine-pointer
motion or expanding scope.

The reviewer personally reran the focused suite (**14 passed, 0 failed, 278
assertions**), standing suite (**246 passed, 491 database-gated skipped, 0 failed,
3,105 assertions**), typecheck, 67-file boundaries, 23-package licence policy, audit
and diff check. Corrected gzip is **97,158 / 98,304 bytes**, leaving 1,146 bytes.

This is not full Order187 approval. D-486 and the order require independent
authenticated settled screenshots and recorded-transition evidence for the exact
candidate. The browser policy limitation recorded above remains, so desktop/phone,
computed-style, focus, overflow, request-console and runtime-transition acceptance is
still unclaimed. The corrected product is eligible for a browser-capable independent
review, not local promotion. The sole local remains untouched.

---

## Guarded same-port browser UAT — D-489

**Conclusion:** NOT-APPROVED / ROLLED-BACK

Two concurrent append-only governance writers assigned D-488 to the static re-review
and to the guarded-UAT admission. History remains unchanged; D-489 is the unambiguous
browser verdict for both records.

The coordinator built exact candidate image
`sha256:d59143d630326817672f8d4a3e3824dd77db8ce78d8347303aaaa367e83c537b`
from product `dc5d1a1`, retained approved rollback image
`sha256:d778b9b1515c5b56484197032487c1da23a57573a4aba1c2d11e9aff79af4ab2`,
and briefly selected the candidate as the sole loopback app under the guarded order.
This independent browser session had no claimable user tab, and a fresh navigation to
`http://127.0.0.1:3000/` failed with `ERR_BLOCKED_BY_CLIENT`. The later handed-off tab
could not establish exact current candidate delivery and was not used as cached
evidence. No credential was requested, read, typed or transmitted.

Because the mandatory exact-candidate authenticated settled-screenshot and
recorded-transition matrix did not execute, the candidate is not approved. The
coordinator restored the rollback image. Independent read-only post-rollback proof
now confirms exactly three healthy containers; one app on loopback port 3000; port
3002 unbound; `YELLOW_OPERATOR_WORKBENCH=1`; and HTTP 200 for health, the operator
document, CSS and JavaScript. The served hashes exactly reproduce D-485:

- HTML `9329466d69ad8ec7126004552c2181eeecffb1dabfce56bd18c0fc936b62234a`;
- CSS `01679a617bd8bf3a1437249c878444d6532453890ee35c5ad8ad98d62cfc979b`;
- JavaScript `e191001f69c4e7c1a48b0cbd59095c3663c1219b0f69b2b55ea544d36a76e838`.

PostgreSQL and Valkey remained their original healthy containers. The review did not
mutate data, schema, credentials, runtime configuration or product files. Order187
remains static-approved/browser-pending and requires a browser-capable independent
exact-candidate run before any future retention or promotion.
