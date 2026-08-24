# UI-SPEC.md — the seven surfaces, one PWA

OPERA loses users at the interface: nested modal stacks, mouse-dependent flows,
state lost on navigation. This spec is the displacement weapon. Phase 10 implements
it; every earlier phase's API must make these surfaces possible (deep links, diffs,
idempotency).

## 1. The three-tier surface model (replaces modal stacks)

- **PEEK** — hover/focus card. Read-only glance: reservation summary, folio balance,
  room state. Appears in 150 ms, dismisses on blur, never traps focus.
- **DRAWER** — right-side panel over the current screen. One entity, common edits
  (dates, guests, notes, quick charge). The screen behind stays live and scrollable.
  Esc closes; unsaved changes prompt.
- **WORKBENCH** — full screen for deep work: folio operations, group management,
  rate calendars, day-close readiness. Tabs within a workbench, never windows.

Rule: an action is reachable at the shallowest tier that can hold it. Nothing opens
a modal over a modal. Ever.

## 2. Deep links & state

Every entity and every workbench tab has a URL: `/p/{property}/res/{id}`,
`/p/{property}/folio/{id}?tab=postings`, `/p/{property}/grid?date=2026-09-20`.
Refresh restores exactly. Links are shareable between staff. Browser back = surface
back (workbench → drawer → screen), never data loss.

## 3. Keyboard grammar (front desk lives here)

- Global: `Cmd/Ctrl+K` command palette · `g a` arrivals · `g d` departures ·
  `g g` grid/tape chart · `g h` housekeeping · `/` search · `?` shortcut overlay.
- List navigation: `j/k` rows, `Enter` open drawer, `Shift+Enter` open workbench,
  `Esc` up one tier.
- Actions in drawer: single-letter with visible underlines (c check-in, o folio,
  m move, x cancel — always confirmed).
- Full check-in without touching the mouse is a Phase-10 DoD test, scripted.

## 4. Command palette + voice (same pipeline)

Palette parses intents: "move 204 to 310", "post minibar 45 to Sharma",
"seal yesterday". Voice (Whisper.cpp) feeds the SAME intent parser; Piper reads
back confirmations. One grammar, two inputs. Every palette action maps to a
CONTRACTS.md endpoint — no palette-only capabilities.

## 5. Screen inventory (v1, in build order)

1. **Arrivals / Departures / In-House boards** — the three home tabs. Columns
   configurable, statutory-fields-missing badge (blocks check-in per country).
2. **Grid (tape chart)** — spaces × 14/28 days. Drag to move (= new segment via
   API), color by state, dorm rows expand to bed positions.
3. **Reservation drawer** — summary, stay dates, guests, rate, policies, alerts;
   actions per state machine (buttons render from the transition table, disabled
   with reason if guard fails).
4. **Folio workbench** — postings ledger (immutable rows), windows/tabs per folio,
   transfer by drag, adjustment = guided reversal flow (reason → approval if over
   threshold), settle → payment state machine.
5. **Availability & rates workbench** — calendar per unit_type: price, restrictions,
   overbooking limit; bulk edit by drag-select; bitemporal "as of" viewer.
6. **Day-close readiness dashboard** — the checklist as live tiles (open cashier
   sessions, unresolved discrepancies, outbox lag); seal button enables when green;
   carry-forward flow for discrepancies with approval.
7. **Housekeeping mobile view** — task list by floor, tap to advance state, photo
   attach for discrepancy, works offline, syncs.
8. **Kiosk mode** — locked-down check-in flow: find reservation → verify identity
   (statutory fields per country) → sign registration card → issue key placeholder.
9. **Owner portal (read)** — statements from postings, occupancy of owned units.
10. **Group workbench** — block grid, pickup vs allotment, rooming list import.
11. **Reports** — picker + date + Run / Download PDF. v1 set: Arrivals, Departures,
    In-house, Special requests, **Security / Vehicles**, Cashier, Trial balance,
    USALI revenue. Every report is a saved query with a stable URL; PDF is the same
    data rendered server-side, never a screenshot of the screen.
12. **Property setup workbench** — the migration accelerator. Room types, then
    **bulk room create**: numeric range (101–120) with prefix and zero-padding,
    *or* an explicit pasted list ("101, 102, 205A") — whichever is filled wins.
    Rate plans with company linkage and derivation shown inline ("−10% of BAR").
    Corporate accounts assignable org-wide. A property should be enterable in
    under an hour without support.

## 5b. Adopted from field prototype (Aug 2026)

Observed in a working PMS build and folded into the spec because they solve real
operational problems our earlier draft missed:

- **Travel capture on the reservation** — arrival/departure, mode, carrier, service
  number, scheduled time, pickup requested. Arrivals board sorts by ETA and an
  automation raises the pickup task. Schema: `travel_detail` (indexed on pending
  pickups).
- **Vehicle register** — reg number, make, model, colour, driver, parking slot,
  in/out times. Gated properties in India and the Gulf keep a security register and
  it must be searchable by plate. Schema: `vehicle`. A parking slot is NOT a special
  case: it's a `space` with `profile_key='parking'`, assigned through the same
  occupancy choke point as any bedroom.
- **Human-readable references everywhere** — `RES-…` confirmation numbers already
  existed; `folio_no` (`FOL-…`) added. Staff and guests quote these aloud; UUIDs
  are for machines, never for humans.
- **Property switcher in the app bar** — org hierarchy made visible; switching
  property preserves the current screen and date.
- **Familiar labels over correct internals** — the day-close surface may be
  labelled "Night Audit" for the hotel vertical (via `vertical_profile.terminology`)
  even though the engine is continuous close. Meet OPERA-trained staff in their
  vocabulary; don't inherit OPERA's architecture.

### Not adopted (and why)
- **Modal reservation dialog.** The prototype opens reservations in a centred modal
  with a Close button — no URL, so a reservation can't be linked or restored on
  refresh, and any second action must stack another modal. Our equivalent is the
  DRAWER at `/p/{property}/res/{id}`: same content, deep-linkable, Esc-dismissable,
  never stacked.

## 6. Field-level audit & the three undo levels

Every editable field shows history on long-press/right-click: who, when, old→new
(from fact_log/audit envelope). Three distinct verbs in the UI, never conflated:
- **Undo** — pre-commit only (form state).
- **Correction** — post-commit non-financial (new fact, history preserved).
- **Reversal** — financial (guided contra-journal; original row untouched).
Buttons say which one they are.

## 7. Offline front desk (pre-leased hold pool)

On connectivity loss: banner, read-only from cache EXCEPT walk-in create against
the pre-leased hold pool (Phase 2). Queue of pending ops with per-op status on
reconnect; conflicts surface as tasks, never silent overwrite.

## 8. Performance & feel budgets

Interaction to paint < 100 ms for peek/drawer from cache; availability search
p99 < 50 ms server-side + skeleton UI; grid renders 500 spaces × 28 days at 60 fps
(virtualized); bundle < 300 KB gz initial; Lighthouse PWA pass is a DoD gate.

## 9. Anti-goals

No modal-over-modal · no mouse-only paths · no unsaved-state loss on navigation ·
no "refresh to see changes" (live via SSE/WebSocket) · no admin screens that
bypass the API (UI speaks CONTRACTS.md only — same rule as everyone else).

## 10. Rate publication approval inbox

The Rates workbench Step 5 shows a bounded plan-local approval inbox beneath the exact
server preview. Each row names the immutable release version, pending/approved/rejected
state, requester, decider and timestamps. It never asks staff to paste an approval UUID.

The requester sees a waiting state and cannot decide. A different property-authorized
operator receives explicit **Approve** and **Reject** actions. The deciding operator may
select their approved latest draft for publication, but the publish button stays disabled
until that operator runs a fresh server preview in the current session. Status and action
availability come from the server; the browser only adds the stricter fresh-preview gate.

There is no polling, background decision, automatic selection, automatic publication or
persisted browser authority. Refresh and “Load older requests” are deliberate controls;
sign-out clears all approval selection and preview evidence from memory.
