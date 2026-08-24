# Architect response 120 — Order 071 rate-workbench command boundary

## ANSWERED — TEMPORARY ARCHITECT

**Decision:** YES to questions 1–3, with the constraints below. NO to question 5.

1. Add one pure canonical authoring compiler inside the rates context. HTTP money is an exact
   canonical signed decimal string and becomes `bigint` before the existing Order 067/068/069
   normalizers run. The compiler does not evaluate, price, target, approve or publish.
2. The draft command calls the existing Order 065 model service, Order 066 target service and
   Order 069 publication service in one already-authenticated tenant transaction. Idempotency
   covers the complete command. No partial draft set may survive a failed request.
3. Reuse the exact existing rate configuration read/write scopes and property grants. Every
   write requires an idempotency key and a server-built audit envelope. The server re-simulates
   before approval and publication; caller conflict summaries, hashes, actor ids and authority
   claims are never accepted.
4. The workbench may request approval and may submit a separately approved request id for
   publication. It must visibly explain that the requester cannot approve their own release. It
   must not add a local bypass, silently auto-approve, or pretend the single demo login can
   complete four-eyes publication alone. Approval inbox/user administration is a later bounded
   surface; integration proof may use two authenticated actors directly.
5. No migration, table, event, approval transition, permission seed, external provider or AI
   call is authorized. The existing facts/events/state machines remain authoritative. RMS is
   configuration-only here; Order 070's registered adapter boundary owns live recommendations.

Additional constraints:

- The ten catalogue choices must come from `RATE_MODEL_CATALOGUE`, not duplicated browser text.
- Guided and Expert modes are different editors over one command. Given the same semantic input,
  the compiler output must be byte-equivalent after canonical serialization.
- The five-step experience must expose physical and commercial targeting, calendar/matrix/bulk
  cells, DOW/booking-window/LOS/occupancy rules, package/promotion/policy/distribution choices,
  exact floors/ceilings and immutable review history.
- Statutory tax/fiscal evidence, exact money, tenant/RLS, occupancy/restriction truth, audit and
  four-eyes publication remain visibly non-disableable.

