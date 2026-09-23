# Order 176 — Adaptive experience shell

**Status:** APPROVED — corrected candidate `700713a`
**Phase:** 5 · founder-visible operations
**Branch:** `phase-5/adaptive-experience-shell`
**Base:** `f3bcb36` (independently approved Orders171/173/174/175)
**Risk tier:** 2 — presentation-only operator shell over unchanged governed APIs
**Owner:** Codex implementation; independent UI/accessibility review

## Outcome

Make the existing Yellow reservation and folio journey usable at three progressive
levels without creating three applications: Simple for guided front-desk work,
Advanced for supervisors, and Expert for dense ERP operation. Add original Yellow
visual token packs inspired by familiar platform qualities while preserving one DOM,
one interaction contract and one server authority.

## Scope

- `src/http/operator/index.html`, `operator.js`, and `operator.css`;
- additive focused operator-shell tests;
- this order, additive D-450, `handoff/LEDGER.md`, and one independent review.

No route, API, database query, domain command, schema, migration, event, permission,
credential, dependency, external asset, browser persistence, public bind, payment,
tax, fiscal, housekeeping, merge, push, local promotion or deployment is in scope.

## Required experience

1. An explicit **Workspace detail** control offers Simple, Advanced and Expert.
   It changes progressive disclosure and density only; it never grants authority,
   changes server flags, modifies a request, or stores business truth.
2. Simple presents the front-desk path first and keeps secondary property-control
   workspaces behind one clearly labelled, keyboard-operable disclosure. Advanced
   exposes the complete existing navigation. Expert uses the same complete navigation
   with denser spacing and visible keyboard/reference affordances.
3. Changing detail level never discards a reservation draft, folio draft, selected
   property, active route, drawer, focus target or API result. Reload/sign-out returns
   to the safe Simple default; no local/session storage becomes authority.
4. Appearance remains orthogonal to detail. Add original dependency-free Yellow Ops,
   Windows Clear, Glass and Aurora token packs alongside the existing Apple Calm and
   Pixel Expressive packs. Themes alter tokens only, not DOM order, semantics, control
   placement, visibility, permissions or motion safety.
5. All combinations preserve visible focus, non-colour status meaning, 44px targets,
   reduced motion, 200% zoom and zero document overflow at 375/768/1024/1440.
6. Combined gzipped operator HTML/CSS/JS remains at or below 96 KiB and CSP/dependency
   invariants remain unchanged.

## Proof

- exact static tests for controls, allowed values, safe defaults and token-only themes;
- DOM/browser proof that Simple disclosure, Advanced and Expert transitions preserve
  active reservation/folio state and keyboard focus;
- every detail/theme combination at responsive widths plus reduced motion and 200%;
- existing reservation/folio workspace suites, full standing tests, typecheck,
  boundaries, licences, audit, gzip and fresh referee 11/11;
- independent non-implementing reviewer executes the UI/accessibility proof.

## Definition of done

- [x] Progressive detail operates over one unchanged semantic application.
- [x] Theme packs are original token variants with no external dependency or copied UI.
- [x] Existing founder reservation-to-folio journey remains green in every detail level.
- [x] Complete repository and real-browser gates pass.
- [x] Independent review approves corrected immutable candidate `700713a`. Candidate `0aef0bb` was
  rejected for root horizontal overflow at 375px in all 18 detail/theme combinations;
  the permanent rejection and complete corrected-candidate restart are both preserved
  in `handoff/reviews/176-adaptive-experience-shell.md`.
