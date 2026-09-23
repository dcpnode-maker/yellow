# Independent post-cutover review — Order 163

**Verdict:** APPROVED LOCALLY
**Operator evidence:** `bba2dec571d6fdcc948fae955e464ae4ac4942ce`
**Approved executable:** `a4178ce4b3bdf1fd95b097439287802a1edb7f8c`
**Runtime image:** `sha256:83a51f63ff284cab011b3405429ff3fda74bc6fc05251dbf591f271bf2433665`
**Reviewer:** OpenAI Codex, independent non-operating reviewer
**Date:** 2026-08-26

## Scope and private handoff

I did not perform the credential creation, fresh-stack setup, staging proof or
cutover. I read `PROJECT.md`, ran `./state.sh`, read Order163, D-430 and the exact
operator evidence, then independently inspected and exercised the final state.

I read the ignored `.yellow/order163-founder-login.env` without printing or
transmitting either value. It has exactly two lines and exactly the required
`YELLOW_REVIEW_PASSWORD` and `YELLOW_REVIEW_APPROVER_PASSWORD` keys. Both values
have the expected 48-byte base64url encoding shape, are distinct and are at least
64 characters. The exact path resolves through the worktree-local ignore rule and
does not appear in `git status`.

Windows ACL inheritance is disabled. The owner is the current user and the only
two access entries are explicit allow/full-control entries for that user and
SYSTEM. There are no inherited, broad or deny entries. The file remained present,
ignored and protected after review for persistent founder use.

## Runtime identity and isolation

The final port-3000 and port-3002 surfaces are two distinct, simultaneously healthy
containers. Each resolves to exact image
`sha256:83a51f63ff284cab011b3405429ff3fda74bc6fc05251dbf591f271bf2433665`
and carries both full revision labels equal to approved executable `a4178ce`. Each
publishes only its one `127.0.0.1` port, joins only
`yellow-order163-local-founder-login_default`, and uses the same
`postgres:5432/yellow_dev` runtime database as `yellow_runtime`. Neither container
has either founder-login variable in its environment. A scan of all running Docker
publishers found no wildcard or public bind.

The fresh Order163 PostgreSQL and Valkey containers are healthy and loopback-only
on ports 5643 and 6590. The two exact-image staging containers remain retained and
stopped on their recorded 3100 and 3102 bindings.

## Reviewer-executed served proof

I loaded only the operator password into one bounded child process without placing
it in a command argument or output. Against each final port I independently used a
unique synthetic Party, idempotency keys, stay and correlation identifiers. Both
served-HTTP journeys passed:

`health 200 -> login 200 -> exactly one granted property -> live status 200 with
app/database operational and tenantContext=true -> Party create/replay 201 ->
masked Party search 200 -> server-owned bookable offer 200 -> active hold/replay
201 -> reservation commit/replay 201 -> confirmation GET 200`.

Replay bodies were byte-identical and carried the replay header. Party create and
search responses did not expose the synthetic email, phone or WhatsApp values. The
harness emitted only status and cardinality results; it emitted no password, token,
identifier, contact, idempotency key or confirmation number. The process copy was
cleared immediately after execution.

My first port-3000 harness attempt incorrectly chose a 2032 stay outside the seeded
local-review horizon. It reached Party create/replay/search, then failed closed on
availability 503 before any hold or reservation. I did not delete or rewrite that
append-only evidence. I discarded the harness precondition and restarted both
proofs with new unique fixtures using the established future-30-day review oracle;
the complete results above then passed on both ports.

## Continuity, rollback and secret containment

Docker timestamps independently preserve the required cutover order: the retained
Order161 port-3002 container stopped before the new preview started, while the old
port-3000 container was still running; only later did the old port-3000 container
stop and the new port-3000 container start. Retained Docker events show repeated
successful health probes against the unaffected surface during each interval,
consistent with the operator's 14/14 and 15/15 monitor record.

The exact old Order161 endpoint container IDs remain intact and stopped. The
Order147 application, healthy PostgreSQL and Valkey, network and database volume;
the Order159 preview, healthy PostgreSQL and Valkey, network and database volume;
and the Order161 healthy PostgreSQL and Valkey, network and database volume all
remain retained. The pre-Order161 rollback tag still resolves to exact old image
`sha256:050286a826f3eea99305ef900f01181251f1e0d3c4fc1d83b887b3138ac3de53`.
The final applications join only the fresh Order163 network, so neither setup nor
review traffic can target an old database through their runtime topology.

After both journeys I compared both private values, without outputting them, against
all Order163 container inspection material and logs, current Windows command lines,
WSL process arguments and environments, tracked files and the operator commit.
Every scan was negative. Neither named value remained in process, user or machine
environment. Final health was `ok` on both ports and the Git worktree was clean
before this independent evidence was added.

## Verdict boundary

Order163 is independently approved only as the present loopback local application
and persistent founder-login handoff at operator evidence `bba2dec`, executable
`a4178ce` and exact image `sha256:83a51f63...`. This is not a merge, push, public
deployment, destructive cleanup authorization, old-data mutation approval or a
broader Phase-5 completion claim. All retained rollback resources and the protected
founder credential file must remain until the founder explicitly authorizes their
retirement.
