# Order709 — create a guest in the active reservation workflow

Founder continuation directive, 25 September: finish pending workflows in the
single live app; a bounded UI release is not ecosystem completion. Phase7.
Serving source is D:/Yellow/git-live-order611-source-v2. Preserve inherited edits.

Reuse D-311–D-318 / Orders101–102 canonical Party search/create contracts. The
legacy operator UI is not proof that the active React workflow is complete.
No schema, domain, scope, authentication, reservation commit or finance changes.

Acceptance: booking Guest step provides existing-profile search and explicit new
person/guest creation (display name, optional legal name/email/E.164 phone). Show
server-masked possible duplicates; allow explicit use of an existing profile or
explicit acknowledgment of the exact current candidate set before creating a
distinct profile. Retain one idempotency key through duplicate-review retries and
uncertain writes. Freeze an uncertain payload; reconcile the same request and
authoritatively search the returned Party ID before selection. Never auto-book,
auto-merge or persist PII/drafts in browser storage. Server permissions remain
authoritative. Captured property/generation guards discard stale callbacks.
Existing guest allocations may reuse the component, but adding a profile only
changes the allocation draft until its separate existing Save command.

Scope and ownership:
- Guest builder: new frontend/yellow/src/ui/GuestProfileCreate.tsx,
  guest-profile-create.ts, guest-profile-create.css;
  tests/order709-guest-profile-create.test.tsx. Reusable component accepts
  propertyId, getToken, onCreated(PartyProfile), onBusyChange and optional disabled.
  Pure controller/transport owns exact property capture, receipt validation,
  duplicate state, same-key retry and stale/unmount guards. Use existing VoiceInput
  for ordinary name fields; native typed email/tel controls remain available.
- Root: frontend/yellow/src/workspaces/ReservationWorkspace.tsx for integration
  and busy/navigation guards; tests/order709-reservation-integration.test.ts.
  No yellow-api/session contract changes; pass existing session as getToken.
- Governance: this order, handoff/questions/709.md if needed,
  handoff/reviews/709-guest-profile-creation.md,
  handoff/receipts/709-guest-profile-creation.md,
  docs/PROJECT-STATUS.md, handoff/LEDGER.md.
- Generated public/yellow-next/**; external temporary proof/build artifacts only
  D:/Yellow/temp/order709-*.

Proof: pure transport/controller failure/retry/duplicate/permission/stale tests,
focused reservation integration regressions, full frontend/backend typechecks and
import boundaries, production frontend build. Independent non-implementer executes
proof and inspects command safety. Existing PostgreSQL integration suites seed
fixtures: never point their setup at the live database. If reexecuted, use an
explicit isolated disposable proof database. Existing domain semantics unchanged.
Actual browser at mobile/desktop: both guest choices, input validation, duplicate
review, saved profile readback/selection, then current offers without committing a
booking. Synthetic QA profiles only in the existing synthetic review property;
no real guest edits, reservation commits or payment writes for UI verification.

Release app-only into existing yellow-public-demo after proof, retain708 rollback,
verify health/asset identity and the same workflow through the current app. Record
what remains unverified. Then continue the next evidenced active-React workflow
gap; do not classify legacy code or a healthy page as ecosystem completion.
