# Question 110 — Order 068 policy, package and sellability composition boundaries

## ANSWERED — TEMPORARY ARCHITECT

**Order:** 068

May Order 068 remain a pure quote-composition boundary: combine one frozen Order 067 price result
with typed guest eligibility, package/meal elements, explicitly staged promotions, policy references,
channel eligibility and frozen availability/restriction evidence; return exact pre-tax totals and
separate evidence without database writes or re-evaluating availability/restrictions?

## Answer

Yes. The hotel-configurable spec may choose guest bounds, package contents, included-versus-extra
treatment, promotion stages, refund treatment, policy references and channel allow/deny rules. The
runtime context supplies authoritative availability/restriction/operational-block evidence and any
mandatory policy evidence; the composer retains it and cannot weaken it. Package and promotion money
is bigint only. Taxes, statutory overrides, persistence, approval/publish, RMS/API and HTTP/UI remain
later orders.

An included package allocation may not exceed the priced room amount. Promotions are discounts only,
never negative totals, and each explicit stage has one unique priority winner or a conflict. A
calendar/pricing result cannot make a blocked option quotable, and a channel rule cannot create
physical availability.
