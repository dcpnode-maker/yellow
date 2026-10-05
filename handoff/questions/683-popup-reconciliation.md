# 683a — Explicit scope amendment

Independent popup review found that legacy check-in/room-assignment wrappers lose
uncertain HTTP outcome classification. Primary coordinator explicitly extends683
to those two frontend HTTP wrappers and popup exact-request retry tests. No backend,
permissions or state transitions change. Preserve pending request/key and prevent
closing the popup during a write or unknown outcome. Review must execute this path.
