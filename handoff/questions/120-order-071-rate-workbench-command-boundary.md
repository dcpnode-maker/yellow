# Question 120 — Order 071 rate-workbench command boundary

## ANSWERED — TEMPORARY ARCHITECT

**Order:** 071 · Guided and expert universal rate-plan workbench  
**Raised by:** OpenAI Codex, autonomous temporary architect under D-95/D-115/D-221  
**Date:** 2026-08-22

The Phase 3 contract requires Guided and Expert editors to produce the same canonical command,
but the current operator surface only exposes base plans and append-only rate prices. Orders
065–070 already provide the model, target, evaluator, composition, publication and quote
primitives. The workbench now needs one HTTP-safe orchestration boundary without inventing a
second pricing or publication implementation.

Questions:

1. May Order 071 add a pure server-side authoring compiler that accepts strict decimal-string
   minor units, normalizes the complete model/target/evaluator/composition/RMS command, and is
   shared by Guided and Expert inputs (and later by Order 072's AI compiler)?
2. May one idempotent operator command create the immutable model draft, target draft and release
   draft in a single existing tenant transaction so browser retries cannot leave a partial trio?
3. May the operator API expose existing simulate, request-approval, publish and versioned-undo
   services under the existing `rates.configuration:read|write` scopes and property grants, with
   no browser-computed conflict or authority result trusted?
4. How should the UI handle the four-eyes boundary when the local review seed has one operator?
5. Does this order require a schema, event, state transition, permission code or external AI/RMS
   integration?

