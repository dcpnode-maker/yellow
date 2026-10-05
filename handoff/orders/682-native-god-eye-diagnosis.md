# Order 682 — Native God's Eye diagnosis

ACTIVE — 2026-09-24. Founder asks to try the original God's Eye natively and
diagnose why its full view did not work. Reservation implementation proceeds
separately. Vendor registration is explicitly deferred by the founder.

## Scope

- Inspect the original upstream bilawalsidhu/gods-eye-view at archived commit
  759652207fd1279ece97f0f19af566feb9a82146 and its dependency/startup configuration.
- Restore/install its locked dependencies in the isolated directory
  `D:/Yellow/temp/order682-gods-eye-native`, with disposable dependency cache in
  `D:/Yellow/temp/order682-npm-cache`. No bulk world dataset or old runtime restore.
- Start its native development server on loopback only; test actual browser
  rendering and available keyless feeds. Preserve the one public Yellow app.
- Diagnose startup, asset, network, authentication and feed errors. Any temporary
  upstream edits are confined to that directory, logged, and not copied into Yellow.
- Write this order, `handoff/receipts/682-native-god-eye-diagnosis.md`, a bounded
  independent review if fixes are made, and append ledger/current-status notes.

## Restrictions and acceptance

No production data writes, migrations, Yellow code changes, paid API activation,
credential copying, firewall opening, public tunnel, or vendor registration.
Keep bundled dataset licenses distinct from upstream MIT code. Report base imagery,
live feeds, interpolation/simulation and provider-dependent features accurately.
Acceptance is an observed native render/feed result or a reproduced error with a
specific cause; an archived source, successful install or HTTP 200 is not proof.
