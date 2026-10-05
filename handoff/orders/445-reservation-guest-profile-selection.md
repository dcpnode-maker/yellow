# Order445 — Select and create reservation guests without internal IDs

**Status:** PAUSED — the founder resumed only the non-UI remaining build on
2026-09-07. Existing working-source implementation and proof are preserved, not
integrated or released. No further guest-picker/UI work until separately resumed.
**Owner:** Codex coordinator; bounded UI builder; root integration proof.
**Phase:** Existing reservation/CRM operator integration under the founder's
completed-feature usability directive, alongside Phase7. No phase gate is closed.
**Base:** Current worktree on phase-7/operator-invoice-workflow, published567a66a1.
Existing uncommitted source belongs to earlier orders and must be preserved.

## Complete outcome

In the existing Guests & shares editor, staff search by name or exact canonical
contact, deliberately select an existing profile, or create a canonical person
using the already-governed Party API. No staff member must obtain or type a Party
UUID. Show the selected guest's name and masked contact hints, with Change guest.
Selecting/creating a profile only changes the local allocation draft. Only the
existing explicit Save command changes reservation membership/shares.

Reuse Party search/create and reservation guest replacement; do not add endpoints,
permissions, database fields or domain rules. Existing server denial and current
duplicate acknowledgement remain authoritative. This is not profile amendment,
ID capture, reservation-primary amendment or a new visual design.

## User interaction and state

- Each non-primary row owns isolated search/create/duplicate/request state.
- Search is explicitly submitted, bounded to20 existing API results; empty,
  loading, permission-denied, validation and retryable errors are understandable.
- New person fields follow existing create vocabulary: display/legal name and
  email/phone/WhatsApp. Reuse server normalization; never mark a contact verified.
  Create uses guest role; it is not a profile merge or contact amendment.
- Duplicate candidates remain masked. Staff may choose an existing candidate,
  or explicitly acknowledge the exact sorted current candidate set to create a
  distinct Party. Preserve the same create key across duplicate/uncertain retry.
  Changed create payload begins a distinct key; never auto-submit on a timer.
- Never choose a first result automatically. Exclude the primary Party and
  already-selected row Parties from successful client selection; server remains
  authoritative for every submitted UUID/share/status.
- Preserve primary identity, exact decimal-share validation and100.00 total,
  original allocation draft and pending membership-command key.
- On row removal, subject/property/session change or editor replacement: destroy
  picker state and discard late responses. No local/session storage of contacts,
  candidates or profile drafts; no URL/request logs containing contact data.
- Use visible labels, native buttons, near-field live error/status text and
  keyboard-operable results. No nested forms. Change/cancel restores useful focus.
  Existing responsive tokens/44px targets; no theme or animation redesign.

## Exact scope and ownership

Bounded UI builder:

- src/http/operator/party-profile-picker.js (new, reusable controller/view)
- tests/party-profile-picker.browser.test.ts (new, bounded real-browser proof)

Coordinator integration:

- src/http/operator/operator.js (guest row composition and lifecycle only;
  leave the existing booking profile workflow working)
- src/http/operator/operator.css (picker containment using existing tokens only)
- src/http/operator.ts (same-origin static asset registration only)
- src/app.ts (same-origin static asset route only)
- tests/operator-reservation-guest-picker.test.ts (new)
- tests/operator-reservation-guest-picker.browser.test.ts (new)
- tests/operator-assets-security.test.ts (new asset/semantic contract only)
- tests/operator-reservation-detail-guest-allocation-ui.integration.test.ts
- tests/operator-reservation-detail-guest-allocation.integration.test.ts
- tests/operator-reservation-workspace.integration.test.ts
- handoff/orders/445-reservation-guest-profile-selection.md
- handoff/orders/444-partner-review-and-astra-ui-integration.md
- handoff/reviews/445-reservation-guest-profile-selection.md (new)
- docs/design/BUILT-CAPABILITY-MANIFEST.md
- docs/CONTRACTS.md (existing endpoint composition, no new authority)
- docs/PROJECT-STATUS.md
- DECISIONS.log; handoff/LEDGER.md
- .yellow/evidence/order445/ (bounded screenshots/logs, excluded from Git)

Any additional path requires recorded scope extension before editing. No migration,
server/domain/payment/fiscal changes, live database mutation, production launch,
new dependency, worktree or Docker/WSL. The ten3D prototypes remain approval-pending.

## Executable completion criteria

1. Intentional red: raw-UUID-only editor and absent picker cannot pass the new
   real-browser guest-selection journey.
2. Keyboard search/explicit select populates the correct row; one explicit Save
   sends the existing exact guest command. Primary/duplicate rows are rejected;
   role/share changes and deliberate removal remain operable.
3. New person creation and duplicate409 flow preserve exact candidate review,
   same-key retry and selected canonical UUID. No membership request occurs
   from search, creation, selection, cancellation or presentation changes.
4. Delayed search/create responses cannot modify another row/property/reservation
   or signed-out session. Retry after uncertainty does not silently duplicate.
   In-memory cancellation clears the UI; successful server creation is not
   falsely claimed rolled back just because the user closes the picker.
5. Existing booking search/create and detail-allocation protections remain green;
   actual375px/desktop keyboard, error, long-name and reduced-motion states work.
   Inspect rendered evidence. Do not call this native-app or backend enrichment.
6. Typecheck, import boundaries, scoped static/adjacent/browser tests and exact
   source checks pass. Publish/integrate separately from the frozen fiscal CI
   checkpoint; no new design or local app promotion before its own authority.
