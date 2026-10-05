# Question 053 — Order 048 rollback and browser probe

**Raised by:** OpenAI Codex (builder)
**Order:** 048 — Operator inventory management
**Status:** ANSWERED — see `053-ARCHITECT-RESPONSE.md`

## Evidence and questions

The first P1-P7 run returned 4 pass / 2 fail.

1. P5 received the expected generic 503 after the injected publisher failure, but the
   new space remained. `OperatorHttpApi.#create` caught the exception and returned a
   Response inside tenant middleware's transaction, so middleware correctly committed
   the fulfilled handler. Must unexpected mutation errors escape to the existing outer
   operator wrapper so the transaction rolls back before that wrapper emits 503?
2. P6's `/postgres|SELECT |INSERT |UPDATE |DELETE /i` rejected `propertySelect` and the
   visible phrase “PostgreSQL truth”; neither is a database shortcut. May the probe be
   narrowed to SQL keywords followed by whitespace and PostgreSQL connection URI syntax?
