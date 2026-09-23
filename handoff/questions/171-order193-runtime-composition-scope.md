# Question 171 — Order193 runtime composition scope

**Status:** RESOLVED — D-511
**Order:** 193
**Raised by:** Codex implementer

Order193 requires an executable hosted-deposit operator/guest/provider workbench and a
genuinely distinct loopback provider origin. Its exact scope admits `src/app.ts` and
`docker-compose.yml`, but not `src/server.ts`. The sole production composition root is
`src/server.ts`; it constructs `PaymentService`, `OperatorHttpApi`, and the runtime app.
Without an admitted edit there, the new optional routes and services can be proven only
through injected test composition and cannot be enabled by the actual runtime or the
separate Compose provider process.

May Order193 admit `src/server.ts` solely to instantiate the approved Order192 payment
service, `HostedDepositService`, `HostedDepositProviderHttpApi`, pass them through the
existing `createApp`/`OperatorHttpApi` seams, and select guest versus synthetic-provider
route exposure from deployment-owned environment values? No new domain authority,
dependency, public bind, real provider, or second product app is proposed.

## Resolution

Yes. `src/server.ts` is admitted only for that composition-root wiring. This is the
minimum executable implementation of the already-authorized outcome and does not admit
new business authority, domain behavior, dependency, public binding or product surface.
