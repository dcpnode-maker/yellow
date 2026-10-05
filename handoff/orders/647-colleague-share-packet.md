# Order 647 — Colleague share/audit packet

## Scope

- Add a read-only colleague share/audit packet for the current demo state.
- Include:
  - local app entrypoint;
  - reviewer walkthrough order;
  - proof/readiness/config/workflow/AI routes;
  - remaining gates;
  - explicit notification policy.
- Keep it truthful: not ready to share publicly, no founder notification yet.

## Out of scope

- Creating a public tunnel.
- Sending email/WhatsApp/notification.
- Marking readiness complete.
- Enabling real PMS execution.

## Acceptance

- `/api/v1/demo/share-packet` returns a deterministic JSON packet.
- `/share` renders a CSP-safe HTML packet for human review.
- Packet includes `notifyFounder:false` and `readyToShare:false`.
- Tests prove the JSON and HTML surfaces include proof routes and remaining gates.
