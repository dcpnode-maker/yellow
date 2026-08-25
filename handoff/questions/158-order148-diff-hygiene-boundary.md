# Question 158 — Order-148 diff-hygiene boundary

**Status:** RESOLVED BY D-410 — CORRECTION READY
**Order:** 148 · post-127 approved integration
**Stopped candidate:** `adbccdc336742656b588004aad22492a18bf5427`
**Related decisions:** D-88, D-409, D-410

## RESOLVED

The first exact candidate failed Base-to-candidate `git diff --check` only because the
new Order-148 file ended with one extra blank line. A separate target-to-Base audit
also reports 53 inherited Markdown trailing-space findings across 11 already reviewed
governance paths. Those 53 findings are part of the approved 111-commit line and are
not candidate-created; Order 148 forbids rewriting them.

D-410 removes only the new Order-148 EOF blank line. Binding candidate hygiene is
`git diff --check f26e395..HEAD`, which must be empty. Target-to-Base hygiene remains
an explicit immutable manifest: exactly the recorded 53 findings in 11 governance
paths, with no product/migration/test path and no additional candidate finding. P0/P1
must also prove exact path/blob ownership so this boundary cannot hide new whitespace
or any unrelated change.

No inherited file, executable text, product, migration, schema, test, assertion,
review evidence or ancestry may be rewritten. All stopped-candidate proof is
diagnostic only; P0–P3 restart on the corrected immutable SHA.

