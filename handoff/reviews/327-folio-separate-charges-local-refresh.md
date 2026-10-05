# Order 327 fresh independent non-operating Tier 3 review

**Disposition: WITHHOLD**

**Reviewer:** Codex `/root/order327_fresh_tier3`, fresh independent non-operating Tier 3 reviewer

**Governance candidate:** `9a8aa167b9358163c45249ace80d33c0b6daa906`

**Runtime source:** `5c37533ae2feebcc59f201d0f53fca2c7671818c`

**Running image:** `sha256:ea3c6cf5d901821ecf3af6f5d74e55de3024e9ea85f6b0307b33476eca857c98`

## Disposition and finding

**WITHHOLD** Order 327. The exact live loaded Folio has document-level horizontal
overflow at the required responsive sizes. At an actual 375 CSS-pixel viewport the
document client width was 360 px and scroll width was 499 px: **139 px overflow**.
At 640 CSS pixels with device scale factor 2 the client width was 625 px and scroll
width was 689 px: **64 px overflow**. The 375 px overflow included the workspace
navigation and a 470 px-wide `folio-workspace-head`/summary surface. This contradicts
the required `overflow0`; approval is withheld even though the label and preservation
proof below are otherwise green.

I did not implement or operate the refresh. I did not start, stop, restart, rename,
replace, create or delete a container, image, network, volume, application record,
credential or recorded status.

## Exact runtime, topology and preservation

- `yellow-order327-app:5c37533` resolved to the exact image and OCI revision above.
  Container `21786bc8320b1d1f2bb79a635d0518bbb56ee0f8c97585728745b63b151a8f78`
  was the sole healthy publisher on `127.0.0.1:3000`, restart count 0, on
  `yellow_order311_local` with the inherited health command.
- Stopped Order 325 rollback `e5541d7c1779d56b068250c9505db1b89f80509f5028369380b64172940ec1d5`
  remained present, restart count 0. Current and rollback each had 24 environment
  names and identical secret-safe sorted-value SHA-256
  `08212c62fddd8175c874f54292c262629af8ccff89231009dd2f56387e3d4a95`.
- PostgreSQL, provider and Valkey were healthy with restart count 0 on the inherited
  network. Intended loopback ports 3000, 3001 and 6389 were open; 3002, 3123, 3188
  and 3318 were closed.

## Browser and route proof

A fresh real in-app browser proved protected loopback HTML contained all three
process-only defaults and the no-store lifecycle helper, and one button authenticated
`Yellow Review Operator` with exactly two properties. Browser privacy deliberately
redacted email/password values from inspection; the focused lifecycle test below
personally proved delayed restoration and preservation of manual values.

Both properties across Simple, Advanced and Expert produced **6/6 green cells** for
exact `Separate charges`, scoped old-label count 0, exact `folio-tab-organize`,
`aria-controls="folio-organize-panel"`, and preserved contextual
`Correct a wrong charge`. The live loaded panel retained `role="tabpanel"`, exact
`aria-labelledby`, `?tab=organize`, keyboard Arrow selection and focus, and the
whole-group server-preview/acknowledged balanced-transfer workflow. No business
action was activated.

All two-property workspace routes were **24/24 HTTP 200 with exact `no-store`**.
Live Project status remained exact: Order 310 built, current order 311, 91 reviewed,
Phase 7 active and 11/11 required. All six appearances kept the changed tab visible.
Landscape containment was zero; reduced-motion and forced-colour media were active,
but the responsive overflow finding above blocks approval. Browser console warnings
and errors were **0**. The exact deep link and keyboard focus proof passed. A final
Back-restoration repetition was unavailable after the browser-control call timed out;
the already-approved product proof covers it, but this limitation does not affect the
independently reproduced blocking overflow.

## Personally executed focused and database proof

Focused command:

`bun test tests/local-login-prefill.security.test.ts tests/operator-folio-separate-charges-label.intentional-red.test.ts tests/operator-folio-routing-ui.intentional-red.test.ts tests/operator-folio-workbench.integration.test.ts tests/order188-folio-transfer-domain.red.test.ts tests/operator-adaptive-experience.test.ts tests/operator-appearance-geometry.test.ts tests/operator-ui-foundation.test.ts`

Result: **47 pass, 6 expected database-gated skip, 0 fail, 514 assertions**.

Explicit read-only PostgreSQL snapshots before and after browser work were identical:
**59** migrations, **110** public base tables, **2** views, **100** policies,
**2** properties and party/contact-point/party-role/fact-log/outbox counts of
**8/0/8/75/22**. Thus business mutations were **0**. The app remained healthy on
the exact image with restart count 0 after proof. The pre-existing untracked
`.yellow/` directory remained the only worktree item and was not modified.

## Approval boundary

No approval is granted. Order 327 remains locally built and blocked on a fresh fixed
candidate that restores document-level overflow to zero at the required 375 px and
200% proofs, followed by fresh independent non-operating Tier 3 review.
