# Question 123 — Order 071 test-double interface

## ANSWERED — TEMPORARY ARCHITECT

**Order:** 071  
**Date:** 2026-08-22

The live operator proof's first typecheck stopped on two test-only issues: its helper inferred
concrete `RateTargetService`, so the deliberately failing middle-step double appeared to require
private registry state and an unrelated resolver; and the HTTP helper omitted its optional
property argument needed by the forbidden-property proof.

May the test helper use the operator constructor's exact injected structural interface and accept
an optional property id, while production service and authorization types remain unchanged?

