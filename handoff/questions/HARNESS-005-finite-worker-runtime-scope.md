# HARNESS-005 — finite worker integration

Resolved before implementation under D-91, 2026-09-28. This is inside the
existing adapter, universalHarness, server and ProviderCommandReactor seams.
No new scheduler, production table/event, provider credential, or external
worker activation is authorized.

An operator-reviewed worker registration pins one Ed25519 public key, backend
and model. A signed, expiring capacity report can admit only a self-hosted
model covered by the existing exact zero-cost policy. Reports are worker
attestations, not a Hugging Face benchmark or proof of coding quality.

One transient transport slot is created only for a durable Paperclip-owned T3
turn. T3 persists the proposal and its session state before acknowledging it.
Cancellation before claim prevents execution. Cancellation after claim remains
pending until the exact worker finishes and acknowledges; disconnect, expiry
and HTTP abort are never positive model-stop evidence. Proposals are untrusted
and are not automatically applied, accepted, committed, or used to close jobs.

The host signing key is ephemeral per server boot; clients must pin its public
key out of band. Restart cannot resume or reissue a claimed assignment. The
fixed exchange route accepts only bounded signed messages and grants no shell,
browser, native action, or general T3 command authority to a worker.
