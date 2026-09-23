# Question 172 — Order193 operator asset ceiling and lazy workbench asset

**Order:** 193  
**Status:** RESOLVED — D-512  
**Blocking:** immutable candidate only; backend, accounting, guest/provider and focused UI behavior are green

## Evidence

Before Order193, the three operator assets gzip to **98,297 bytes** against the
standing **98,304-byte (96 KiB)** ceiling: seven bytes of headroom. The required
deposit tab, semantic form/status markup, responsive rules and retry-safe/server-truth
behavior increase the bounded, reviewable diff by 41 HTML lines, 9 CSS lines and 150
JavaScript lines, producing **100,949 bytes**. All 44 non-budget UI/security assertions
pass; the three identical inherited budget assertions fail only on the byte count.

Whole-file minification/reformatting can force the number below the ceiling but creates
an unreviewable multi-thousand-line diff and breaks inherited source-contract proofs;
it has been discarded. Weakening or silently raising the ceiling would also evade the
performance invariant.

## Proposed resolution

Admit a same-origin, dependency-free lazy deposit-workbench asset (for example
`src/http/operator/operator-deposits.js`) plus the exact asset/security tests needed
to prove it loads only when the Deposits tab is selected. Keep the initial three-asset
shell at or below 96 KiB gzip and give the lazy workbench its own small executable
ceiling. The asset must preserve CSP, no third-party/network dependency, no browser
storage, stale identity guards, keyboard behavior and retry-safe server truth.

Alternative: explicitly replace the 96 KiB ceiling with a measured new initial-shell
ceiling. This is simpler but ships every operator the deposit code on first load and is
not recommended.

May Order193 scope be expanded to the lazy same-origin asset and its exact tests?

## Resolution

Yes. Admit dependency-free same-origin `operator-deposits.js` and
`operator-deposits.css`, exercised through the already-admitted operator workbench and
asset-security tests. They must load only on deposit-workbench demand, retain a small
separate executable gzip ceiling, and keep the original three-asset shell at or below
96 KiB. No ceiling increase, dependency, external asset or broad reformat is admitted.
