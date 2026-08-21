# ORDER 027 — Yellow constitution and repository assessment

**Phase:** Cross-phase architecture documentation (after Phase 1 implementation, before Phase 2)
**Branch:** `phase-1/constitution-assessment` · **Tier:** 2
**Written by:** OpenAI Codex, temporary architect under D-95 and direct founder instruction
**Date:** 2026-08-21

## Goal

Persist Yellow's product destination, assess the repository against it from inspected
evidence, research material hospitality edge cases, and produce a coherent domain,
journey, architecture, and implementation plan before any further product code.

## Why now

Orders 019–026 are implemented but await independent Phase 1 exit review. This work
captures the broader Hospitality Operating System destination without starting Phase 2,
rewriting the working kernel, or claiming schema presence is implemented behavior.

## Scope — files Codex may create or change

- `AGENTS.md` (additive routing guidance only; preserve `PROJECT.md` precedence and role controls)
- `DECISIONS.log` (append-only decision recording the constitution boundary)
- `docs/YELLOW-CONSTITUTION.md`
- `docs/research/REPOSITORY-ASSESSMENT.md`
- `docs/research/CAPABILITY-MATRIX.md`
- `docs/research/HOSPITALITY-EDGE-CASES.md`
- `docs/journeys/MASTER-JOURNEY-MAP.md`
- `docs/DOMAIN-MODEL-V1.md`
- `docs/ARCHITECTURE-V1.md`
- `docs/IMPLEMENTATION-PLAN.md`
- `handoff/orders/027-yellow-constitution-assessment.md`

Anything else is out of scope.

## Evidence requirements

1. Inspect tracked source, migrations, tests, runtime configuration, decisions, orders,
   and existing architecture/domain documentation; do not infer implementation from names.
2. Run the application and established checks where possible, recording exact provenance
   and distinguishing tested production behavior from schema-only foundations.
3. Use authoritative public sources for the hospitality edge-case corpus and cite them.
4. Classify capabilities only as `IMPLEMENTED`, `PARTIAL`, `FOUNDATION EXISTS`, `MISSING`,
   or `RESEARCH REQUIRED`, with repository evidence.
5. Cross-check all seven derived documents against the persisted constitution and the Ten
   Invariants, then correct contradictions before review.

## Definition of done

- [ ] Product constitution is stored verbatim in `docs/YELLOW-CONSTITUTION.md`.
- [ ] Root `AGENTS.md` remains a thin adapter but routes substantial work through the
      constitution and relevant architecture/domain/journey/ADR material.
- [ ] All seven requested assessment/design documents exist and are evidence-based.
- [ ] Documentation explicitly separates destination, schema foundation, implemented
      behavior, and independently reviewed/merged status.
- [ ] No product implementation, migration, schema snapshot, or test is changed.
- [ ] Standing self-check and `./setup.sh --db-only` remain green.
- [ ] Commit is prefixed `[codex]`, pushed for independent review, and not merged.

## Forbidden

- Product code, tests, migrations, generated schema snapshots, runtime configuration, or UI edits.
- Starting Phase 2 or representing Orders 019–026 as merged/independently approved.
- Replacing `PROJECT.md`, weakening any Ten Invariant, or changing technical decisions silently.
- Treating an existing table or empty context index as an implemented capability.
- Copying proprietary documentation or claiming legal/regulatory compliance.
- Self-approval or merge.
