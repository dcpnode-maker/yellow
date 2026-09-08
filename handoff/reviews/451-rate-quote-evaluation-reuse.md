# Order451 — Independent pricing correctness and performance proof

Reviewer: root Codex, not the production/test implementer. 2026-09-08.
Status: implementation, independent focused/differential/mutation proofs passed;
combined standing and source publication pending. No UI, database or live change.

Root inspected both production diffs, normalization/context constructors and their
nested evidence reconstruction, all new hostile/parity tests, and the unchanged
quote fixture/measurement driver. Only private weak identities of successful
outputs made from inert data gain reuse. Caller copies, accessors and proxies
continue through canonical validation. Every retained nested field is rebuilt and
frozen; no caller-controlled frozen flag substitutes for provenance. No nightly
evaluation, current evidence lookup, tax guard or logical workUnits was removed.

Root personally executed six focused files: 40 passed, 17 explicitly database-gated
skips, zero failed, 354 assertions (2.34s). These are not live database results.
The existing P4 test passed in330ms; D1288's combined366/367 quotes passed in1129ms
at their original deadlines. New and inherited assertions were not weakened.

## Retained old/new comparison

Before implementation, root captured unchanged treef2ada4bb baseline outputs for
nine workloads, one discarded warmup and five measured samples each. Receipt:
`.yellow/evidence/order451/run-49d6adf4-b079-4076-b93d-d05b61316b00/completed.json`,
SHA256 `5cf475ff7b91f7506e885cd353b39ebec6ed942cf1ed22fbdb29166b98717aca`.

After inspection, root reviewed fresh admissionc8a9f7da and personally executed
CompareAfterRootHandoff, alternating old/new build order by workload on the same
Ryzen5500U/Windows/Bun1.3.14 runtime. Every full quote, monetary bigint, quoteHash,
tax evidence, ordering and resolver/query/evaluation census matches the separately
retained old outputs exactly across all samples. No database authority, production
latency SLO, GC causality or global complexity claim follows from this pure fixture.

| Workload | Old median ms | New median ms | Reduction |
| --- | ---: | ---: | ---: |
| Calendar1 | 8.63 | 3.65 | 57.75% |
| Calendar30 | 94.40 | 27.92 | 70.43% |
| Calendar60 | 193.86 | 44.78 | 76.90% |
| Calendar183 | 1418.23 | 109.15 | 92.30% |
| Calendar366 | 3272.52 | 264.49 | 91.92% |
| Calendar367 | 3716.17 | 381.52 | 89.73% |
| Fixed30 | 73.22 | 47.17 | 35.57% |
| Spring DST2 | 12.64 | 4.22 | 66.57% |
| Fall DST2 | 7.59 | 3.62 | 52.38% |

Both long stays exceed the agreed30% median reduction target; no measured short or
fixed regression. All samples/ranges/setup/CPU/memory observations are retained in
`.yellow/evidence/order451/run-ab82fbfa-3bfb-41a3-9454-f05e9d88ebc9/completed.json`,
SHA256 `e5f687d777d1de1541580703aaa94370d8975e50465343c348fe64423d90af4b`.
The367-night rate quote remains complete; only its tax preview is unavailable.

## Independent mutation proof

Root built three owned private diagnostic bundles from the pinned source/test:
genuine, evaluator provenance replaced by Object.isFrozen, and complete-stay
provenance replaced by Object.isFrozen. The original worktree was never mutated.
Root personally ran the D244 hostile-copy test: genuine1/0; both unsafe mutations
0/1 with the precise failed assertion that a forged frozen input no longer throws.
All four implementation/test hashes remain unchanged. Completed receipt:
`.yellow/evidence/order451/mutation-1e2dda9f-4c79-4148-951c-053c7a33265a/completed.json`,
SHA256 `c87f80461f4302010c7cac1aea4a0dab44df1a9966aa098d9eb3e21ce5976cc6`.

The first diagnostic wrapper expected different Bun assertion wording and rejected
the correct unsafe-evaluator RED result. Its original logs/bundles remain in
`mutation-7ef0c967-419a-4c1b-85bb-13d33d7afca6`; only the wrapper's exact text match
was corrected to the observed "Received function did not throw". No product/test
assertion, timeout or prior evidence changed.

## Q239 test infrastructure, not design

Root reviewed the complete final browser lifecycle diff and required two repairs:
direct rejection of socket-open timeout and retaining a pending request until its
decoded error shape validates. One owned browser now checks all original seven
cases with unique navigation tokens, frame/loader checks and bounded cleanup.
Original CSS, fixture measurements, assertions and30s deadline remain unchanged.
Root focused geometry proof passes5/0,51 assertions in1.97s (actual browser1.859s).
No new visual work was performed. Earlier three failed449 full suites remain RED.

## Final bounded eligibility repair and re-executed proof

Before the combined source freeze, root identified that a large primitive array
could incur an unbounded eligibility prescan before the existing canonical length
rejection. The non-root implementer repaired only the two admitted pricing files
and their reuse tests: eligibility now has a100,000-visit budget including primitive
values, and arrays longer than731 are rejected before key enumeration. Existing
depth32/object20,000 guards remain. This is an optimization eligibility decision,
not a replacement input validator. No claim that key enumeration of a wide plain
object is allocation-bounded is made. Accessors/proxies never gain provenance.

Root inspected the final diff and personally re-executed all six focused files:
42 passed,17 explicit DB skips,0 failed,382 assertions in2.01s. Oversized primitive
arrays and deep/wide data preserve canonical errors; existing P4 passes305ms and
D1288's combined366/367 checks737ms with unchanged deadlines.

Root then re-executed the exact nine-workload baseline comparison on the final
code. Every complete quote/evidence/hash/census remains identical. Median results:

| Workload | Old median ms | Final median ms | Reduction |
| --- | ---: | ---: | ---: |
| Calendar1 | 4.61 | 4.30 | 6.87% |
| Calendar30 | 154.64 | 31.45 | 79.66% |
| Calendar60 | 320.70 | 68.81 | 78.54% |
| Calendar183 | 947.36 | 184.55 | 80.52% |
| Calendar366 | 3027.38 | 282.86 | 90.66% |
| Calendar367 | 3151.97 | 230.84 | 92.68% |
| Fixed30 | 55.17 | 35.38 | 35.87% |
| Spring DST2 | 8.18 | 3.58 | 56.26% |
| Fall DST2 | 6.83 | 6.72 | 1.70% |

Final comparison receipt:
`.yellow/evidence/order451/run-0354fe96-fb68-4a05-a5c6-6f09f19c0e8d/completed.json`,
SHA256 `9b417faaecd97c98d49e237183f4a6d28f74d6e254811d472233761b1091974d`.
Root re-executed the genuine/evaluator-bypass/stay-bypass mutation proof on these
final pins: genuine1/0 and each deliberate bypass0/1, unchanged source afterward.
Receipt `mutation-e12d1f38-b7f5-4636-9e43-845cb68561df/completed.json`, SHA256
`b039184d9f9243611fc941337eaef9ec8c2d0467d40e49bbdf525b1e76aae383`.
All earlier successful and failed measurements remain unchanged historical proof.

## Final implementation pins

- evaluators.ts: `14a48eb3415a8dd3cbf7ef3908c8025b20124924af5141665b88ae435507f1f8`
- composition.ts: `213b9c2a351307f08a24cc35f33d3254d75ec1f6c5a9d4495bd26fd33a371525`
- reuse tests: `2243c44ab7369eb92b7508e9b94904ad7d4d072d8afd425afb0e7ddbe2a07ab9`
- preview tests: `66be7d31eae3ee9220d23ddb7cff8c0b5b83b833fec86cd9a631390d594ddf0a`
- geometry test: `a7556af4f2e87f4d578aed11ccc1c2f0d392d83c195afae46c1cd43be3e81369`

Root admits preparation of one new functional candidate containing449/450/451 and
Q239, followed by exact-source standing checks. Publication remains separate from
these focused proofs. No main merge, provider activation, app restart, schema/data
change or Phase7-complete claim is authorized here.
