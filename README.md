# Yellow — hospitality operating system

Yellow is an actively developed hotel and short-term-rental ERP: PMS, bookkeeping,
stay operations and compliance, with planned distribution, booking engine/CRS,
CRM, multilingual voice, RMS and hotel interfaces. The domain core uses
TypeScript/Bun/Elysia and PostgreSQL in a modular monolith.

## Important: this default branch is not the latest development build

**Publication checkpoint: 2026-09-05.** The code and many original files on `main`
still belong to the older integrated baseline. Significant later work is published on
[the development branch](https://github.com/dcpnode-maker/yellow/tree/phase-7/persisted-india-final-component-tax-evidence)
and tracked by [PR #80](https://github.com/dcpnode-maker/yellow/pull/80).

This README correction does **not** merge that code, update your local app or claim
that every feature below exists on this branch. Its purpose is to make the real
project and publication gap visible. Built, independently reviewed, merged and
running locally are separate states.

## Latest recorded project scope: 18 phases, not 13

| Phases | Recorded development state |
|---|---|
| 0–3, 5 and 6 | Independently reviewed |
| 4 | Built; final integration/review outstanding |
| 7 | Active; native fiscal issuance incomplete |
| 8–17 | Planned |

Order430 was rejected for incomplete canonical provenance (D1323).
[Order434](https://github.com/dcpnode-maker/yellow/blob/phase-7/persisted-india-final-component-tax-evidence/handoff/orders/434-native-fiscal-source-completion.md)
is the active complete repair, not a completed or approved invoice feature.
Founder priority is **11 → 13 → 17**, subject to the existing dependencies.

Read the development
[BUILD-PLAN](https://github.com/dcpnode-maker/yellow/blob/phase-7/persisted-india-final-component-tax-evidence/BUILD-PLAN.md)
and [ROADMAP](https://github.com/dcpnode-maker/yellow/blob/phase-7/persisted-india-final-component-tax-evidence/handoff/ROADMAP.md)
for current definitions and later changes. **13 bounded contexts** remains the
architecture; it is not the phase count. The first migration's 80 tables plus migration
ledger describe the immutable baseline, not the current development schema census.

## Current source of truth for developers and AI

The following links deliberately point to the published development branch.
Relative files on this older `main` may still contain historical startup guidance.

| Need | Current development document |
|---|---|
| Constitution and ownership | [PROJECT](https://github.com/dcpnode-maker/yellow/blob/phase-7/persisted-india-final-component-tax-evidence/PROJECT.md), [AGENTS](https://github.com/dcpnode-maker/yellow/blob/phase-7/persisted-india-final-component-tax-evidence/AGENTS.md) |
| Complete project navigation | [PROJECT-MAP](https://github.com/dcpnode-maker/yellow/blob/phase-7/persisted-india-final-component-tax-evidence/docs/PROJECT-MAP.md) |
| Founder requirements mapped to phases, source and gaps | [FEATURE-REGISTER](https://github.com/dcpnode-maker/yellow/blob/phase-7/persisted-india-final-component-tax-evidence/docs/FEATURE-REGISTER.md) |
| Existing-project setup and daily development | [START-HERE](https://github.com/dcpnode-maker/yellow/blob/phase-7/persisted-india-final-component-tax-evidence/START-HERE.md), [Windows](https://github.com/dcpnode-maker/yellow/blob/phase-7/persisted-india-final-component-tax-evidence/START-HERE-WINDOWS.md), [USAGE](https://github.com/dcpnode-maker/yellow/blob/phase-7/persisted-india-final-component-tax-evidence/USAGE.md) |
| Hotel/STR journeys, distinct workspaces and design | [UI-SPEC](https://github.com/dcpnode-maker/yellow/blob/phase-7/persisted-india-final-component-tax-evidence/docs/UI-SPEC.md), [DESIGN](https://github.com/dcpnode-maker/yellow/blob/phase-7/persisted-india-final-component-tax-evidence/docs/DESIGN.md), [staff journeys](https://github.com/dcpnode-maker/yellow/blob/phase-7/persisted-india-final-component-tax-evidence/docs/design/STAFF-JOURNEYS.md) |
| Domain, finance and configuration contracts | [DOMAIN-MODEL](https://github.com/dcpnode-maker/yellow/blob/phase-7/persisted-india-final-component-tax-evidence/docs/DOMAIN-MODEL-V1.md), [CONTRACTS](https://github.com/dcpnode-maker/yellow/blob/phase-7/persisted-india-final-component-tax-evidence/docs/CONTRACTS.md), [EXTENSIONS](https://github.com/dcpnode-maker/yellow/blob/phase-7/persisted-india-final-component-tax-evidence/docs/EXTENSIONS.md) |
| Multilingual authorized voice and RMS | [AI-ARCHITECTURE](https://github.com/dcpnode-maker/yellow/blob/phase-7/persisted-india-final-component-tax-evidence/docs/AI-ARCHITECTURE.md), [voice/RMS plan](https://github.com/dcpnode-maker/yellow/blob/phase-7/persisted-india-final-component-tax-evidence/docs/architecture/VOICE-RMS-PLAN.md) |
| Regional preferences and channel integrations | [Regional packs](https://github.com/dcpnode-maker/yellow/blob/phase-7/persisted-india-final-component-tax-evidence/docs/architecture/REGIONAL-PACKS.md), [OTA plan](https://github.com/dcpnode-maker/yellow/blob/phase-7/persisted-india-final-component-tax-evidence/docs/integrations/OTA-CONNECTIVITY.md) |
| Decisions and exact work/proof history | [Decisions](https://github.com/dcpnode-maker/yellow/blob/phase-7/persisted-india-final-component-tax-evidence/DECISIONS.log), [orders](https://github.com/dcpnode-maker/yellow/tree/phase-7/persisted-india-final-component-tax-evidence/handoff/orders), [reviews](https://github.com/dcpnode-maker/yellow/tree/phase-7/persisted-india-final-component-tax-evidence/handoff/reviews), [ledger](https://github.com/dcpnode-maker/yellow/blob/phase-7/persisted-india-final-component-tax-evidence/handoff/LEDGER.md) |

Current requirements include rich progressive reservations; arrival/departure
drill-downs; room readiness, housekeeping and checkout coordination; append-only
financial corrections and split-payer folios; six dedicated Apple, Android/Pixel,
Win95/98, glass, neo and ERP appearances; distinct hotel/STR workflows; regional
preferences; authorized multilingual voice; RMS profit/value decisions and permitted
OTA visibility/market signals. Requirements are not claims of complete implementation.

## Contribution and integration

Codex coordinates implementation with bounded parallel workers and model selection
by risk, cost and capability. High-risk work needs a qualified non-implementer to
execute proof personally. Implementers do not self-review or self-merge. Required
CI and the invariant referee remain binding; a document change cannot approve
unfinished fiscal code.

Do not overwrite dirty checkouts, rewrite historical reviews, alter applied
migrations or touch files merely to make timestamps recent. Update living documents
where their content changes and retain linked evidence. Do not duplicate the app
or database to resume development.

The desired single local review URL is `http://127.0.0.1:3000`, but verify the
serving revision, health and real synthetic login before calling it current.
Credentials and runtime authority stay out of Git. No provider integration,
certification, production deployment or performance result is implied by this page.
