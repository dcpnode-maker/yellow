import { expect, test } from "bun:test";

const api = Bun.file(new URL("../frontend/yellow/src/yellow-api.tsx", import.meta.url));
const workspace = Bun.file(new URL("../frontend/yellow/src/workspaces/ReservationWorkspace.tsx", import.meta.url));

function functionSource(source: string, name: string): string {
  const start = source.indexOf(`async function ${name}`);
  if (start < 0) throw new Error(`${name} is missing`);
  const next = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, next < 0 ? undefined : next);
}

test("the mobile checkout surface delegates only through the existing governed endpoint", async () => {
  const source = await api.text();
  const commit = functionSource(source, "commitCheckout");
  expect(commit).toContain("/reservations/${reservationId}/checkout");
  expect(commit).toContain('method: "POST"');
  expect(commit).toContain('authorization: `Bearer ${await session()}`');
  expect(commit).toContain('"idempotency-key": idempotencyKey');
  expect(commit).toContain('body: "{}"');
  expect(commit).toContain("fetch(");
});

test("checkout cannot submit without current server readiness and visible confirmation", async () => {
  const source = await workspace.text();
  const start = source.indexOf("const submitCheckout = async");
  const end = source.indexOf("\n  return (", start);
  const submit = source.slice(start, end);
  expect(submit).toContain("if (!departureReady || !checkoutConfirmed || checkoutPosting || lifecyclePosting || operationalPosting || guestAllocationPosting) return;");
  expect(submit).toContain("await commitCheckout(reservationId, checkoutAttempt.current);");
  expect(submit).toContain("detail.refetch()");
  expect(submit).toContain("departure.refetch()");
  expect(source).toContain("I confirm this named departure and the current server-owned");
  expect(source).toContain("disabled={!departureReady || !checkoutConfirmed || checkoutPosting || lifecyclePosting || operationalPosting || guestAllocationPosting}");
  const reservationWorkspaceStart = source.indexOf("function ReservationWorkspace");
  const reservationWorkspaceEnd = source.indexOf("function OverwatchCheckInJourney", reservationWorkspaceStart);
  const reservationWorkspace = source.slice(reservationWorkspaceStart, reservationWorkspaceEnd);
  expect(reservationWorkspace).toContain("const [checkInConfirmed, setCheckInConfirmed] = useState(false);");
  expect(reservationWorkspace).toContain("const [checkoutConfirmed, setCheckoutConfirmed] = useState(false);");
  expect(reservationWorkspace).not.toContain("const [confirmed, setConfirmed]");
});
