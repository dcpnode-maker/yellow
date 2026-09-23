# Order 158 — Founder UI foundation and availability home

**Status:** READY — founder-prioritized human review surface
**Phase:** 5 · founder usability
**Branch:** `phase-5/founder-ui-foundation`
**Base:** `ffbe8d7d7a416be9dd79e4c0cc849153bf16e566`
**Risk tier:** 2 — authenticated presentation and browser workflow only
**Owner:** Codex implementation; independent non-implementing review before local replacement

## Outcome

Turn the existing authenticated engineering workbench into the first polished,
human-testable application slice. Preserve every production API and PostgreSQL
authority boundary while making login, property context, availability, holds and the
entry into Party/reservation work understandable without reading implementation notes.

This is the first continuous UI-first slice. It does not wait for later phases and it
does not present unbuilt vendor, payment, tax, fiscal, housekeeping or public-booking
behavior as available.

## Scope

- `src/http/operator/index.html`;
- `src/http/operator/operator.css`;
- `src/http/operator/operator.js`, only for navigation/presentation state, accessible
  feedback, the duplicate status-load removal and property/status refresh correction;
- `tests/operator-assets-security.test.ts`;
- `tests/operator-workbench.integration.test.ts`;
- `tests/operator-ui-foundation.test.ts`;
- `docs/LOCAL-REVIEW.md`;
- this order, additive D-425, `handoff/LEDGER.md`, and one additive independent review.

No route, service, domain, adapter, migration, seed, permission, credential, dependency,
schema, event, financial rule or protected referee path is in scope. If another path is
required, stop and write a question.

## Required behavior

1. Replace the flat tab-and-form presentation with one coherent hospitality-operations
   shell: stable product identity, desktop sidebar, compact responsive navigation,
   visible signed-in/property context, clear active location and a skip-to-content path.
   Retain all eight existing views and every API-bound element id.
2. Make Availability the useful home surface. Give search one obvious primary action;
   present returned truth, offers, active holds and offline capacity with a scannable
   hierarchy; and retain exact PostgreSQL/server-authority wording. A hold remains
   temporary and an offer remains non-promissory.
3. Make the Party/reservation entry discoverable from Availability and Reservations
   without adding a second Party store, client-derived availability, optimistic
   reservation success or fabricated data.
4. Provide consistent loading, success, empty, disabled and recoverable error states.
   Async controls cannot double-submit, generic 401/403/409/503 states remain honest,
   and feedback uses accessible live regions without stealing focus.
5. Use one token-driven professional visual system across both existing appearance
   skins: restrained teal/blue operational palette, clear surface hierarchy, tabular
   figures, high information density, one primary action per section and no decorative
   effects that obscure security, warning, occupancy or monetary meaning.
6. Meet keyboard and responsive requirements: visible focus, semantic labels and
   headings, no color-only state, reduced-motion support, no horizontal page overflow,
   and usable layouts at 375, 768, 1024 and 1440 CSS pixels. Interactive targets remain
   at least 44 CSS pixels on compact/touch layouts.
7. Remove the duplicate `loadSystemStatus()` invocation. When property selection
   changes while Status is active, refresh status once under the existing generation,
   authentication and selected-property guards. No new request or authority path.
8. Keep bearer tokens, selected Party/contact candidates, idempotency keys and theme
   state in memory only. Do not introduce localStorage, sessionStorage, cookies,
   analytics, external fonts/scripts/assets or browser persistence.

## Proof

- Base-to-candidate implementation diff is limited to the seven product/test/doc paths
  plus governance/review evidence;
- focused UI-foundation, asset-security and operator-workbench suites;
- every existing operator integration suite, standing tests, typecheck, boundaries,
  licences, audit, image/security gates and protected hashes;
- real served browser walkthrough on the deterministic review seed covering login,
  property selection, Availability search, offer presentation, hold/list/release,
  navigation into Party/reservations, Status refresh and sign-out;
- rendered checks at 375, 768, 1024 and 1440 widths, keyboard-only traversal,
  reduced-motion, focus visibility, loading/error/empty states and zero browser console
  errors; capture review screenshots without secrets or unmasked Party contact data;
- fresh app-never-started `./setup.sh --db-only` referee with exactly 11/11.

## Forbidden

- Decorative mock data, client-side domain decisions, hidden failures or success before
  the server response.
- Generic CRUD over append-only/correction-only records, direct SQL, broadened scopes,
  new routes or changes to reservation, inventory, rate, Party or financial semantics.
- A framework rewrite, new dependency, external CDN/font/icon/script, persistence,
  telemetry, public exposure or production deployment.
- Presenting later phases or vendor/payment/tax/fiscal/housekeeping/public-booking work as
  implemented.
- Merge to main, push, deployment, self-review or self-merge.

## Definition of done

- [ ] The served app looks and behaves like a coherent operator application at desktop
      and compact widths while every existing backend binding remains intact.
- [ ] The founder can complete the named Availability/hold/navigation journey locally.
- [ ] Focused, full operator, standing, static/security and fresh referee proof pass.
- [ ] An independent reviewer approves one immutable candidate.
- [ ] The local port-3000 app is replaced only from that approved candidate.
