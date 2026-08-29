# Question 178 — Order276 setup table-count oracle is outside frozen scope

**Status:** RESOLVED-D723
**Raised by:** fresh independent Order276 Tier-3 review
**Date:** 2026-08-29

## Evidence

Exact Order276 commit `9a4a958` correctly applies migrations 1–48 and creates 100
public tables. The canonical isolated `./setup.sh --db-only` command then exits 1
because `setup.sh` still asserts `99 public tables after migrations 1-47`. Standalone
focused, acceptance, runtime-DML, schema, referee11/11, standing and static proof is
green. Review D-722 therefore records CHANGES REQUIRED with no product finding.

`setup.sh` is not in Order276's frozen Scope list, so changing it inside Order276 would
silently widen scope.

## Resolution

Admit separate bounded Order277. Change only the exact setup count/message from 99
after migrations1–47 to 100 after migrations1–48, then personally rerun the complete
canonical isolated command and every standing/static gate. Do not weaken an exact
count, touch any migration/product/test/referee/runtime/local, or claim Order276
approval until a fresh non-implementing Tier-3 reviewer executes the corrected gate.

