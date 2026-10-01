# Correction to independent ngrok packet review

This append-only correction addresses the stale-state finding in [INDEPENDENT_NGROK_PACKET_REVIEW.md](INDEPENDENT_NGROK_PACKET_REVIEW.md); that initial review and its hash remain unchanged as history.

The current `SUPPORTED_NGROK_PLAN.md` now explicitly labels the no-binary/no-config values as historical pre-install observations, records official agent installation and local no-token config validation as completed, and identifies the remaining prerequisites: a supported dedicated-token binding, free-entitlement confirmation, and actual agent-session, ingress-registration, and OAuth/app-access verification. `NGROK_CAPABILITY_OBSERVATION.json` now labels its `existing_binary: null` value as historical and names the current provenance/config/capability receipts that supersede it. The documentation contradiction is resolved.

The present evidence still makes no claim that a token is bound, an agent session or public URL exists, OAuth was registered/enforced, or a paid entitlement is available. The host GET 503 remains an ordinary HTTPS result with unverified origin, not an agent-session result. The review still excludes private agent config/log/binary/token contents and includes no network execution.
