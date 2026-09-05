# Order 435 — Reconcile original project documentation and GitHub publication truth

**Status:** COMPLETE — 20 current documents independently merged into GitHub main through PR81 — D1334
**Date:** 2026-09-05
**Phase:** Cross-phase documentation supporting the existing 18-phase plan
**Owner:** Codex primary coordinator with bounded documentation workers
**Risk:** Documentation only; no product, database or runtime change
**Requirements:** YF-001–024, especially YF-021–023

## Outcome

The founder's GitHub page and supplied PDF show the historical main README, a
13-phase build package and outdated original files. Correct the living project
guides and specifications in place, incorporating the current feature register and
approved direction without equating a requirement with executable functionality.
Publish the development documentation and prepare an honest, documentation-only
main landing-page correction through normal independent integration.

## Scope

- This order, DECISIONS.log and handoff/LEDGER.md (append-only evidence).
- README.md, START-HERE.md, START-HERE-WINDOWS.md and USAGE.md.
- BUILD-PLAN.md and handoff/ROADMAP.md: current status/ownership headings and
  explicitly historical milestones only; preserve phase definitions/dependencies.
- docs/DOMAIN-MODEL-V1.md, docs/CONTRACTS.md and docs/EXTENSIONS.md: correct
  stale global implementation claims and connect current scoped requirements.
- docs/UI-SPEC.md, docs/AI-ARCHITECTURE.md and docs/DESIGN.md: reconcile current
  founder direction with historical executable contracts; no runtime change.
- docs/PROJECT-MAP.md and docs/FEATURE-REGISTER.md: current source-of-truth links
  and Order430 rejection / active Order434 status, without completing Phase7.
- handoff/reviews/435-documentation-reconciliation.md: documentation validation
  and publication evidence, not a product or independent fiscal approval.
- A docs-only branch/PR rooted at origin/main may contain README.md only, with
  self-contained current-development links and an explicit main-code-lag notice.
  Reuse a verified clean existing checkout or a separate Git index; do not create
  another clone/worktree, touch dirty main, replace the default branch, self-merge,
  force push or imply a draft PR has passed the required referee.

## Acceptance

1. Root README and onboarding describe the existing project, not a zip/Phase0-only
   package or a mandatory Claude-era model workflow.
2. Preserve 13 bounded contexts and the immutable 80-table baseline; distinguish
   them from 18 phases and the current additive migration catalogue.
3. Preserve historical orders/reviews/decisions and applied migrations. Correct
   stale living prose, not timestamps; use links rather than copying all history
   into every file.
4. Original UI/domain/AI/config specifications link and summarize the relevant
   staff/STR journeys, six dedicated appearances, contextual disclosure, voice,
   RMS/OTA visibility, regional packs and traceable requirements. Planned work
   stays planned. No exact-native, performance or provider-access claim without
   appropriate evidence.
5. Current phase vector remains 0–3/5/6 reviewed;4 built pending final integration
   and review;7 active;8–17 planned. Order430 was rejected D1323;Order434 is the
   active complete repair, not an approved/native-issuance result.
6. Document main/development/CI/local as separate states and the observed state
   script parsing limitation. Do not publish a fabricated updated local receipt.
7. Validate changed Markdown links, missing source targets, contradictory active
   claims, diff whitespace and allowlisted commit scope before publication.
8. Any main-only candidate must be README-only against origin/main, use links that
   resolve on its target ref, and remain draft until required proof and independent
   integration. Do not move unapproved fiscal changes to main to refresh the page.

## Worker ownership

- Domain/config worker: DOMAIN-MODEL-V1, CONTRACTS and EXTENSIONS only.
- UI/AI worker: UI-SPEC, AI-ARCHITECTURE and DESIGN only.
- Status worker: BUILD-PLAN, ROADMAP, PROJECT-MAP and FEATURE-REGISTER only.
- Root: onboarding, README, order/evidence, integration and publication.

No worker edits shared decision/ledger files, commits, pushes or starts processes.
Native Windows tooling only while WSL Bun crash-dump recurrence is unresolved.

## Verification checkpoint

Fourteen living project documents were reconciled in place, not replaced by a
standalone addendum. Root read all four pages of the founder's PDF, verified the
default-branch gap, reviewed the scoped worker diffs and checked 200 local Markdown
path targets across the 14 documents plus this order: zero missing. The 24 YF IDs,
18 phase definitions, 13-context boundary and declared dependencies are preserved.
See [validation record](../reviews/435-documentation-reconciliation.md).

The existing clean Order432 checkout is reused for a separate README-only branch
rooted at origin/main. No clone/worktree or database is added; the former branch
remains preserved. Publication is not integration. The main correction must remain
draft until the required gate and independent integration have actually occurred.

## Explicit scope expansion after founder's default-page clarification

The founder reiterated that a development-branch push does not update the default
GitHub project. PR81 now admits a documentation snapshot of the original guides and
specifications above, plus their five supporting current-direction documents
(STAFF-JOURNEYS, REGIONAL-PACKS, VOICE-RMS-PLAN, OTA-CONNECTIVITY and the dated
STAFF-STR-ECOSYSTEM research) and docs/research/README.md. This is 20 Markdown files
including README, not the initially proposed README-only change.

Every imported document must visibly state the exact development source commit and
that main's executable code has not yet caught up. Rewrite relative code/order/
evidence links to that pinned development ref when they describe that lineage; keep
links among imported current documents local. Validate all remaining local links
against the main candidate, and all pinned targets against the source commit.
Applied migrations, production source and historical evidence remain untouched.

Order436 separately admits the single expired quote-test fixture repair needed by
main CI. The combined candidate is documentation plus a test fixture, never described
as README-only or as current product-code integration. No default-branch swap,
unapproved fiscal merge or independent-proof waiver is permitted.

## Completed publication — 2026-09-05

PR81 was independently merged at 01:33:30 UTC. Remote main is
`2e55b88488300b1d4efb551f8ec79698dbb52dad`; its exact reviewed candidate was
`307ab0cfaf2e8f1685b8bd5f8b42f7283adb312d`. All 20 original/current Markdown
documents are now on the default branch, sourced from development `61dbeea` with
visible source notices. The only non-document change is Order436's test fixture.
All four CI jobs passed, including the canonical referee's 11 passed, 0 failed.
The non-implementing integration agent personally executed focused checks and
verified the full CI transcript before a normal, non-admin merge. Root then
verified the remote main SHA, README contents and exact changed-file list.

Application-code integration remains separate. Dirty local main and the local app
were not modified. Earlier README-only and pending-publication statements above
are historical checkpoints, superseded by this completed receipt.
