# Minimum-data handoff for the two Qwen pilot workers

Order 687. Founder explicitly requested these workers for harness development.

The initial useful parallel slice sends the same short, generic JSON parser
contract to both workers. Worker 1 proposes a stdlib implementation; Worker 2
independently proposes adversarial unit tests. They receive only that public
synthetic contract and this reviewed finite inference runner. No repository,
account details, credentials, business data or private prompt history is sent.

The runner has fixed task IDs, verifies the pinned model hash, uses a
4,096-token context and 1,024-token answer cap, and kills the direct inference
process on its 300-second timeout. It saves textual receipts locally in the
notebook. It does not execute, import or apply generated code. The operator
must inspect the complete output before copying any candidate into the local
evaluation-only fixture. Any future durable authenticated harness transport
and source application remain separate gates; this is a manual pilot, not a
connected autonomous scheduler.

The first Worker 2 response exhausted the 1,024-token cap before its eighth
test and had incorrect assumed byte counts. It was rejected, not run or called
green. `worker2-parser-tests-v2` is a separately named, finite retry with compact
tests, direct imports, exact exception types and measured UTF-8 lengths. The
original notebook receipt is retained under its original task ID.
