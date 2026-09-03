# Question 183 — Order384 server runtime wiring scope

Order384 names `src/app.ts` and the operator HTTP/UI surfaces but omitted
`src/server.ts`, where the production `OperatorHttpApi` is actually constructed. Tests
can inject the workbench without it, but the real application cannot receive the new
service. Repository scope rules forbid silently editing an omitted file.

## Recommended resolution

Add only `src/server.ts` to Order384 scope for the single dependency-construction and
injection edit needed by `BusinessDayCloseWorkbenchService`. No listener, environment,
authentication, transaction, route, local or deployment behavior may otherwise change.
The existing high-risk independent Order384 proof must cover this wiring.

Founder decision requested: approve this exact one-file scope addition.

