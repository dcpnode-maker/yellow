# Recovery readiness source issue

The v5 restore’s full schema AST proof passed, but the app’s protected readiness check compares the credit-note CHECK expression as exact text. The source and restored schema express the same predicate; PostgreSQL’s restored rendering is two bytes shorter because of redundant parentheses, so the text join misses the constraint.

The untouched 9ff and b9 `src/kernel/build-info.ts` files have identical hashes for the source expression definition at lines 8–11 and the exact `pg_get_expr` join at lines 532–535. The expression expected by the code and the source-dump expression each hash to `16ed3a449ec7ff06e31e5ba3f976d0e33ace95f9026c7148dcd8032a0d10597c` (202 bytes). The actual restored v5 expression hashes to `534c90613b10c865728a5b0358b7cb8728ad2da054d60128aea8c21b93dff264` (200 bytes). Removing only parentheses makes the strings identical. Their canonical expression AST hashes are equal: `82c522e5bd0ade855a12bfe70420e2b389f34e98bb838bc66bd16cf1a38dc680`.

The full private v5 schema proof also records 2,449 statements on each side, 20 known CHECK-header line differences, equal full AST hashes, and strict schema equivalence. The exact text predicate at line 535 makes `credit_check_shape.exact` false, which feeds `nativeCreditBindingProtected` in readiness.

No source change was made. The JSON receipt contains file and dump hashes only; it excludes raw schema lines and expression text. Review receipt SHA-256: `c30775aa2caeaef180e0a87e456b2a8dfd6025354df181b30621cb8b4233aefa`.
