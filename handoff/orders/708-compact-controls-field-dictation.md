# Order708 — two-row table controls, unobtrusive dock, field microphones

Founder screenshot and25September clarification authorize: Search arrivals toolbar
two rows instead of three; floating icon dock see-through when covering content;
remove floating Ask Yellow and provide explicit field microphones like chat inputs.
Expanded sidebar remains fixed left; icon dock retains existing left/bottom movement.

Plan: desktop table toolbar remains compact; mobile row1 search + count, row2
Reset/Filter/Sort/Columns,44px targets. Dock fades while idle and restores on hover,
keyboard focus or pointer interaction/drag; no invisible click-through navigation.
Reserve bottom content padding so final rows can scroll above dock. No modal fade.

Field dictation is draft-only, never a command or Save/Submit. Original controlled
handlers/validation unchanged. Reusable VoiceInput/VoiceTextarea with explicit
onVoiceValue callback, final transcript review/Use text, Cancel/Stop, visible state,
browser-support/permission errors, maxLength and stale-field/context/unmount guards.
Only eligible ordinary text/search/textarea fields; exclude secret/payment/code
editors, readonly/disabled, dates, numeric amounts, selects/checkboxes. Scope of
actual integrated controls must be counted and documented; no all-fields claim
without inventory. No new AI call, key, transcription service or audio storage.
Browser speech can use browser-vendor servers: disclose before recording, request
only on explicit Start microphone. Unsupported browser retains typing fallback.

Exclusive scope/owners:
- Compact builder: frontend/yellow/src/ui/TableControls.tsx (toolbar markup only),
  frontend/yellow/src/ui/table-controls.css (toolbar only),
  frontend/yellow/src/ui/workspace-dock.css (idle transparency/bottom clearance),
  tests/order708-compact-controls.test.tsx.
- Voice builder: new frontend/yellow/src/ui/VoiceField.tsx, voice-field.css,
  frontend/yellow/src/ui/field-dictation.ts; tests/order708-field-dictation.test.tsx.
  Test extension explicitly corrected to.tsx because it renders JSX components;
  the initial.ts variant caused full typecheck TS6142 (no product scope expansion).
  No existing consumer edits; root coordinates integration.
- Root: frontend/yellow/src/App.tsx (remove yellow-launch only and eligible field
  adapter bindings), frontend/yellow/src/ui/HotelSearch.tsx,TableControls.tsx,
  TableColumnMenu.tsx,BusinessMappings.tsx,MovementTableControls.tsx,
  FolioWindowComparison.tsx (eligible field bindings only); active workspaces
  ReservationWorkspace.tsx,FinanceWorkspace.tsx,GroupReservationWorkspace.tsx,
  ReservationRoomCalendar.tsx,ArrivalPickupWorkspace.tsx,ReservationDepartureChange.tsx,
  StreetMapWorkspace.tsx (eligible field bindings only); tests/order708-field-coverage.test.ts.
  No legacy GodEye/Overture or inactive src/http UI updates.
- Explicit Q708 scope revision after mounted QA: root may correct the existing
  MovementTableControls.tsx reset handler's stale-search/sort restoration and add
  its regression to tests/order708-compact-controls.test.tsx. This is UI query
  state only, with no hotel writes. Voice panel positioning must escape ancestor
  stacking contexts so the movable dock cannot intercept its buttons.
  Q708 also admits TableColumnMenu.tsx's narrow Escape ownership guard so an open
  field panel cancels before its containing column menu; query handlers unchanged.
- Governance: this order; handoff/reviews/708-field-chrome.md;
  handoff/receipts/708-field-chrome.md; docs/PROJECT-STATUS.md; handoff/LEDGER.md.
  Generated public/yellow-next/**; temp evidence/tools D:/Yellow/temp/order708-*.

Independent non-implementer reviews and personally executes draft/stale/permission
proof, types and dock/toolbar regressions before app-only release. Root real browser
320/390/desktop layout, filter/sort/reset, dock interaction, no floating Ask Yellow,
mic support/disclosure/cancel and manual typing. Synthetic recognition results must
be labelled synthetic, not real microphone accuracy proof. No DB/API/migration,
booking/payment/state transition, provider fee, new container stack or full ecosystem
completion authority. Preserve dirty tree;707rollback available.
