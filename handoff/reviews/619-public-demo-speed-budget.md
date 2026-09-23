# Review 619 — Public demo speed budget

Timestamp: 2026-09-23T10:26:32.3866099+05:30

## Scope reviewed

Order 619 adds a read-only speed probe for the current public demo. It checks:

- local health latency
- public tunnel health latency
- public app shell latency
- total built JavaScript size
- largest JavaScript chunk size

## Commands executed

`powershell
bun test tests/order619-public-demo-speed-budget.test.ts
bun tools/probe-public-demo-performance.ts
`

## Results

Focused test:

- 3 pass
- 0 fail
- 12 expectations

Probe result:

| Check | Observed | Budget | Result |
|---|---:|---:|---|
| local health | 16 ms | 350 ms | pass |
| public health | 925 ms | 2500 ms | pass |
| public app shell | 384 ms | 3500 ms | pass |
| total built JavaScript | 857,722 bytes | 1,650,000 bytes | pass |
| largest JavaScript chunk | 218,840 bytes | 430,000 bytes | pass |

## Conclusion

The current public demo satisfies the initial public-demo speed budget. This does not
prove every PMS workflow is complete, but it converts the founder's speed requirement
into a repeatable gate that can be run before each shareable demo release.
