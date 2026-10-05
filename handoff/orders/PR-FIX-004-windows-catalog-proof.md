# PR-FIX-004 - Make PR93's existing catalog proof portable

Authority: founder's repair-all-public-PRs directive, routine test-only repair.

## Scope

- tests/place-catalog.test.ts
- scripts/research/build-place-catalog.py: only completed-file publication/cleanup.
- tests/place-catalog-import.test.py: platform publication and refusal-to-overwrite proof.
- .yellow/pr93-publication-probe.py: ignored finite native filesystem probe.
- This order, questions/PR-FIX-004-windows-catalog-proof.md and paired review receipt.

Select the existing Windows `python` or Unix `python3` executable consistently in
both fixture builds. Do not shim/replace global executables or skip the proof.
Only chmod an actually created catalog during cleanup; preserve the original
setup failure and remove only the test-owned temporary directory.

Preserve atomic create-if-absent and readonly final output on both platforms;
Unix directory fsync stays intact and Windows never overwrites an existing path.

No catalog format/query/schema, authorization, source admission, dependency policy,
credentials, real-data extraction or live-app change. Prove the full existing
catalog suite, public-importer hostile suite and combined map boundaries. This
does not substitute for independent runtime acceptance or authorize deployment.
