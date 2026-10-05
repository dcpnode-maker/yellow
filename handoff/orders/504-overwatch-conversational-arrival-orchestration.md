# Order 504 — Overwatch conversational arrival orchestration

## Objective

Let Yellow complete the normal arrival preparation sequence through a natural staff
conversation rather than handing over a manual checklist: inspect the reservation and
readiness, identify the next governed prerequisite, show live progress in the PMS,
ask one scoped question when judgement/authority is needed, and execute the selected
existing canonical action after the staff clearly confirms.

## Scope

- Existing Overwatch session/turn state and the existing reviewed check-in, primary
  folio, room-candidate/assignment components
- Existing typed local intent parsing and focused frontend tests only

## Required behaviour

1. “Show/prepare/check in <unique name or confirmation>” opens the in-context arrival
   workflow and narrates current authoritative blockers. It does not send the user to
   another screen or ask them to discover dependencies themselves.
2. Yellow can automatically sequence deterministic, currently legal preparation
   actions only after an explicit contextual staff confirmation captured from a visible
   typed or finalized voice transcript, for example “Yes, assign Room 405 and prepare
   the folio.” A bare ambiguous “yes” outside an active pending proposal is not an
   action.
3. Each action preserves its exact server preflight, stable idempotency, confirmation,
   progress/result view and authoritative refetch. A failed/stale result stops the
   chain, explains the next fact needed and never guesses a replacement room or marks
   Housekeeping/identity complete.
4. Policy-dependent alternatives are asked conversationally: no free upgrade or room
   category change is assumed; the staff chooses wait, an approved upgrade, or another
   valid server candidate. Physical cleaning, documents and payment/identity evidence
   cannot be fabricated by AI.

## Exclusions

- No backend schema/API/domain change, new automatic room-allocation algorithm,
  housekeeping condition transition, price/upgrade policy, finance posting, provider
  live-audio implementation, external message send or public release.

## Review protocol

Because the sequence contains occupancy/financial-adjacent commands, independently
prove that recognition/transcript state cannot bypass confirmation, stale evidence
halts the chain, and each command retains existing canonical preservation semantics.
