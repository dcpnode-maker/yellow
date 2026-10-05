# Review745 — working coding runner

Implementer: Gemini/Antigravity7cf2a574-da3f-416a-9b6d-436b7c972453.
Independent nonimplementing reviewer: Codex root. No live tasks dispatched yet.

Initial builder battery:8pass2fail32assertions/611ms. Failures: assertion compared
function instead of return value; valid local tagged Goose model rejected.
Root independent7-case hostile suite initially0pass7fail because required manifest
version1 is rejected before other cases run. Those are setup-blocked behavior
checks, not claimed proof of the other static findings below.

## Required changes before real invocation

1. version:1 missing. Reject noninteger/nonfinite timeout, whitespace prompt.
2. Provider JSON `{}` or statusERROR or empty response currently reaches needs_review.
   Require object/statusSUCCESS/nonempty response and sane optional metadata;
   denied_actions wrong type or nonempty rejects. Model prose never verifies code.
3. Persist check hashes AT ENQUEUE, compare before builder and before/after verifier.
   Persist output file hashes at build and reject changes before/after verify.
4. Runner never revalidates paths at run/verify (TOCTOU after enqueue). Reject
   symlink/reparse workspace ancestry/parents; resolve real roots. Reject empty/dot,
   any '..' segment, ADS colon, reserved Windows devices, trailing dot/space,
   .env variants, secrets and attachments. Check files actual *.test.ts/js/tsx/etc;
   invoke absolute paths so filenames cannot become test CLI flags.
5. Git snapshot reads unbounded bytes, compares post keys only so deleted untracked
   files disappear unnoticed; errors may persist raw stderr. Compare union of keys,
   cap files AND bytes, fail on unreadable files (missing distinct from read error).
   Audit after failed provider execution too; preserve all evidence, never rollback.
6. Buffer overflow truncates silently; terminate owned child and classify overflow.
   Signal exit with nullcode isn't success. Verifier must reject timeout even code0.
7. Entire run needs reliable finally/transaction rollback/error state on any exception.
   Verify must atomically claim same global executor lock; no concurrent verification.
   Current pid is parent's, not actual child; capture child PID on spawn. Uncertain
   recovery cannot clear a possibly live orphan's lock; refuse unknown child state.
8. Don't persist malformed JSON excerpts, denied_actions payloads or raw stderr.
   Generic bounded error codes/messages only. No logs of prompts/response/secrets.
9. No changed permitted files means needs_attention (no implementation produced),
   not 'completed successfully'. Good result says build returned, review required.
10. Tests currently omit most cases named in receipt. Add real assertions covering
   above, absent-db file not created, explicit-execute rejection, persisted reopening,
   global verification lock, outside-scope deletion, timeout/output limit and junction.

Goose planner remains disabled; accept valid tagged local names, reject cloud or
URLs/options. DSH/runtime/company UI integration remains future scope.
