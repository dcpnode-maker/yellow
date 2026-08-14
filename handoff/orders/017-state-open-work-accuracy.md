# ORDER 017 — make `state.sh` report open work, not file counts

**Phase:** 0 · **Branch:** `phase-0/state-open-work-accuracy`
**Written by:** Claude (architect role, `claude-opus-5`)
**Date:** 2026-08-15 · **Tier:** 1
**Source:** found while closing Questions 007 and 008 · **Decision:** D-82

## Goal

Make `./state.sh` distinguish open handoff items from resolved ones, so the first
number every session reads is true.

## Why now

`state.sh` is the script PROJECT.md tells every agent to run first, and D-58 justifies
it as *"'on the same page' must be verifiable, not assumed."* Right now it counts files:

```sh
questions=$(find handoff/questions -maxdepth 1 -name '*.md' -type f | wc -l)
```

A question that was answered, implemented, reviewed and closed still counts as open
forever. After closing 007 and 008 today the counter reads `questions=4` with **zero**
actually open. The same applies to `orders=17` and `reviews=2` — a completed order is
indistinguishable from a pending one.

An agent that trusts this number either chases closed work or learns to ignore the
number, and the second is worse.

## Scope — files Codex may change

- `state.sh`
- `state.ps1` (must stay behaviourally identical — D-49 keeps both paths equal)
- `handoff/README.md` (document the marker convention only)

Nothing else. Do not touch orders, reviews, questions, decisions, CI, or scripts.

## Required change

1. Define one marker convention and document it in `handoff/README.md`: a handoff file
   is **closed** when it contains a line beginning `## RESOLVED` or `## RATIFIED`
   (questions), `## MERGED` (orders), or when it is a review, which is closed on
   authorship. Questions 007, 008 and both ARCHITECT-RESPONSE files already carry these
   markers — use them as the fixtures.
2. Report both numbers, open first: `questions=0 open (4 total)`. Never drop the total —
   the archive is evidence and hiding it would trade one wrong number for another.
3. When something is genuinely open, keep listing the filenames as it does today. That
   behaviour is the useful part and must not regress.
4. `state.ps1` produces the same counts and the same wording.

## Definition of done

- [ ] `./state.sh` reports `questions=0 open (4 total)` on the current tree
- [ ] Adding a file without a marker moves the open count to 1; adding the marker moves
      it back to 0. Paste both runs in the PR body — the transition is the proof
- [ ] Open items are still listed by filename
- [ ] `state.ps1` output matches `state.sh` on the same tree
- [ ] `bun test` green; referee still `11 passed, 0 failed of 11`
- [ ] No file outside Scope

## Forbidden in this order

- Adding, editing, closing or reopening any question, order, review or decision. This
  order changes how work is *counted*, never what is counted. Marking something resolved
  to make a number look better is the specific failure this forbids
- Parsing YAML front-matter, adding a dependency, or introducing a status database — one
  grep for a marker line is the whole mechanism
- Touching `migrations/`, `tests/run_invariants.py`, or CI

## Deferred review protocol

If the marker convention turns out to be ambiguous for a file type not listed above,
stop and write `handoff/questions/017.md`. Do not invent a second convention.

## Review requirement

Tier 1: one architect approval plus a green battery. The open→closed→open transition in
the PR body is the test.
