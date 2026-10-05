# Order 320 fresh independent presentation review

**Disposition: APPROVE**

**Reviewer:** Codex, fresh non-implementing Tier 2 presentation reviewer

**Exact candidate:** `94e76a8b2788e59298a0e16cdcb9267df30bb23a`

**Product commit:** `6e33cc8`

**Approved base:** `b69ed0a`

I did not implement Order 320. I read `PROJECT.md`, ran `./state.sh`, read the
order and D-888/D-889, personally inspected the exact candidate diff, re-executed
focused proof, and rendered the two changed surfaces in fresh isolated Chromium.
I did not access or alter port 3000.

## Findings

No finding.

The production delta from the intentional-red commit to the product commit contains
only `docs/UI-SPEC.md`, `src/http/operator/index.html`, and one existing exact-copy
test. The application markup delta is exactly two paragraph replacements. There is
no JavaScript or CSS delta. `git diff --exit-code b69ed0a..94e76a8 --
src/http/operator/operator.js src/http/operator/operator.css` passed, and
`git diff --check b69ed0a..94e76a8` passed.

The Folios paragraph uses the conditional phrases **eligible loaded folio**, **may
expose**, and **server-authorized**. It names only already-built deposits, immutable
corrections, whole-group charge organization, direct billing, and zero-balance
settlement. The adjacent Today paragraph says only that an eligible loaded Folio has
available financial tools and keeps Cashiers separate.

I independently traced the named capabilities to their existing bounded surfaces:

- hosted deposits use token-only hosted-deposit routes with distinct payment read,
  write and deposit-apply scopes and exact property grants;
- correction requires `financials.adjustments:write`, exact property grant, server
  statement eligibility and separate post-seal authority;
- charge organization is the existing indivisible whole-group server preview followed
  by an acknowledged immutable balanced transfer under the transfer scope;
- direct billing uses server-owned eligible targets, current authoritative preview,
  exact property grant, transfer scope, and separate over-limit approval scope;
- settlement requires the action-specific settle/close scope, exact property grant,
  current server status and exact zero balance before the domain transition.

The copy does not name or imply generic payments or refunds. It explicitly excludes
tax calculation, invoice issuance, fiscal-document issuance, and checkout. It makes
no promise of automatic eligibility, availability, successful settlement, or command
success. The server remains authoritative for every conditional action.

## Preservation proof

The Order 320 exact-copy test personally passed all three cases and proves exactly one
each of the seven journey controls (`today`, `reservations`, `folios`, `cashiers`,
`housekeeping`, `vehicles`, `operations`) plus every existing Folio bridge, tab and
action identity. The wider navigation/routing proof also passed. The exact candidate
adds no control, route, handler, request, endpoint, API, domain service, migration,
schema, seed, data, permission, status, financial authority, local-runtime change, or
post-310 functionality.

Personally executed focused command:

`bun test tests/operator-folio-capability-copy-finetune.intentional-red.test.ts tests/operator-folio-reservation-discoverability.intentional-red.test.ts tests/operator-management-demo-navigation-finetune.intentional-red.test.ts tests/operator-folio-workbench.integration.test.ts tests/operator-folio-routing-ui.intentional-red.test.ts tests/hosted-deposit-assets.test.ts tests/hosted-deposit-workbench.intentional-red.test.ts tests/financial-folio-settlement.intentional-red.test.ts tests/financial-receivable-transfers.intentional-red.test.ts tests/order188-folio-transfer-domain.red.test.ts tests/operator-receivables-workbench.integration.test.ts tests/operator-appearance-geometry.test.ts tests/operator-ui-foundation.test.ts`

Result: **57 pass, 6 database-gated skip, 0 fail, 744 assertions**. This includes
server-authority boundaries for every named capability, all Folio bridge/tabs/actions,
seven journeys, explicit routes, six appearances, responsive geometry, and the absence
of new browser authority.

## Personally executed isolated-browser presentation matrix

I generated a disposable file-only fixture directly from the exact candidate's two
paragraph strings and production stylesheet, then drove installed Chromium through
the DevTools protocol. The temporary test and browser profiles were removed after
execution; no repository product file remains.

Result: **1 pass, 0 fail, 153 assertions** across:

- two property identities × Simple, Advanced, and Expert × Apple, Android, Win95,
  Glass, Neo, and ERP;
- 375×900 portrait, 812×375 landscape, and 640 CSS pixels at device scale factor 2;
- reduced-motion and forced-colours emulation;
- keyboard focus on the existing `Find via reservation` bridge.

In every matrix cell both paragraphs matched the exact candidate bytes, were visible,
remained within the viewport, and produced no horizontal overflow. Theme and detail
identities remained exact. The file-only fixture had no application JavaScript and no
HTTP server, so it could issue no API request or business mutation; its only external
resource was the exact local production stylesheet. The already-approved base browser
proof records zero console errors and zero business mutation, and Order 320 changes no
JavaScript or CSS that could alter that runtime result.

## Approval boundary

**APPROVE** exact candidate
`94e76a8b2788e59298a0e16cdcb9267df30bb23a` with no finding. Approval is limited to
the two static presentation-copy corrections in Order 320. It grants no local
reflection, deployment, broader payment/refund, tax, invoice, fiscal, checkout,
financial, data, status, post-310, merge, or push authority.
