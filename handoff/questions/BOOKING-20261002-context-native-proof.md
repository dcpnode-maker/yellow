# Context native proof scope closure

The existing native guest fixture is the smallest executable way to verify the new
read against actual tenant/RLS/authority SQL. Add one context-read assertion case
to tests/guest-booking.integration.test.ts, preserving its existing assertions and
fixture lifecycle. It checks authoritative property/plan metadata, unchanged owned
fixture counts before/after the read, and revoked issuer rejection. This is a test-only
scope closure, authorized by the existing requirement for independent actual PostgreSQL
proof. No app/server or migration edits. The laptop still owns mounted route integration.
