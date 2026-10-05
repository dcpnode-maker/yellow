import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const proxy = readFileSync(
  new URL("../tools/public-demo-css-proxy.ts", import.meta.url),
  "utf8",
);
const operator = readFileSync(
  new URL("../src/http/operator.ts", import.meta.url),
  "utf8",
);
const yellowApp = readFileSync(
  new URL("../frontend/yellow/src/App.tsx", import.meta.url),
  "utf8",
);
const reservationWorkspace = readFileSync(
  new URL("../frontend/yellow/src/workspaces/ReservationWorkspace.tsx", import.meta.url),
  "utf8",
);
const yellowApi = readFileSync(
  new URL("../frontend/yellow/src/yellow-api.tsx", import.meta.url),
  "utf8",
);

test("public demo entry hides credential fields before automatic local-demo entry", () => {
  expect(proxy).toContain('data-yellow-automatic-demo-login="1"');
  expect(proxy).toContain(
    "#login-form>:not(#login-message){display:none!important}",
  );
  expect(proxy).toContain(
    '"<html", \'<html data-yellow-automatic-demo-login="1"\'',
  );
  expect(proxy).toContain('src="/assets/operator-public-demo.js" defer');
  expect(proxy).toContain(
    'url.pathname === "/api/v1/auth/demo:enter" && request.method === "POST"',
  );
  expect(operator).toContain("publicDemoJs(): Response");
  expect(operator).toContain(
    'for(const child of form.children)if(child.id!=="login-message")child.hidden=true',
  );
  expect(operator).toContain(
    'message.textContent="Opening the shared Yellow demo…"',
  );
});

test("the bare public tunnel URL enters the reviewed default property dashboard", () => {
  expect(proxy).toContain('if (url.pathname === "/")');
  expect(proxy).toContain(
    'const publicDemoPropertyId = "4518a22f-b455-54c6-a50a-4584383749b9"',
  );
  expect(proxy).toContain("location: `/p/${publicDemoPropertyId}/today`");
});

test("a public arrival detail stays in the Yellow surface and keeps the server check-in confirmation gate", () => {
  expect(proxy).toContain(
    "res\\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
  );
  expect(proxy).toContain('return new Response("Not found", { status: 404');
  expect(reservationWorkspace).toContain("function ReservationWorkspace");
  expect(yellowApi).toContain("/check-in/readiness");
  expect(reservationWorkspace).toMatch(
    /I confirm this named arrival and the current server-owned\s+readiness result\./,
  );
  expect(reservationWorkspace).toContain("disabled={!ready || !checkInConfirmed || checkInPosting || lifecyclePosting || operationalPosting || guestAllocationPosting}");
  expect(yellowApi).toContain("idempotency-key");
});

test("the modern stay detail keeps checkout behind governed readiness and visible confirmation", () => {
  expect(reservationWorkspace).toContain("loadCheckoutReadiness");
  expect(yellowApi).toContain("/checkout-readiness");
  expect(yellowApi).toContain("async function commitCheckout");
  expect(reservationWorkspace).toContain("if (!departureReady || !checkoutConfirmed || checkoutPosting || lifecyclePosting || operationalPosting || guestAllocationPosting) return;");
  expect(reservationWorkspace).toContain("I confirm this named departure and the current server-owned");
  expect(reservationWorkspace).toContain("await commitCheckout(reservationId, checkoutAttempt.current)");
});

test("the public reservation board remains in the React PMS surface", () => {
  expect(proxy).toContain("today|reservations|guests|housekeeping|res\\/");
  expect(reservationWorkspace).toContain("function ReservationBoardWorkspace");
  expect(reservationWorkspace).toContain("queryFn: loadReservationBoard");
  expect(reservationWorkspace).toContain("<MovementGrid");
  expect(reservationWorkspace).toContain("New reservation");
  expect(yellowApp).toContain("const billingDesk");
  expect(yellowApp).toContain("`/p/${propertyId}/today?workspace=finance`");
  expect(yellowApp).toContain("onClick={billingDesk}>Finance</button>");
});

test("a selected synthetic guest profile exposes its Party-bound stay history", () => {
  expect(reservationWorkspace).toContain("loadPartyStayHistory");
  expect(yellowApi).toContain('partyId, limit: "100"');
  expect(reservationWorkspace).toContain("GUEST PROFILE");
  expect(reservationWorkspace).toContain("Stay history");
  expect(reservationWorkspace).toContain(
    "guests?guest=${encodeURIComponent(guest.partyId)}",
  );
  expect(reservationWorkspace).toContain("const initialGuestSearch");
  expect(reservationWorkspace).toContain("matchingProfile");
});

test("voice recognition treats a brief browser silence as a continuation, not a permission failure", () => {
  expect(yellowApp).toContain("let restartCount = 0");
  expect(yellowApp).toContain("restartCount < voiceRestartLimit");
  expect(yellowApp).toContain('event.error === "no-speech"');
  expect(yellowApp).toContain("Voice recognition paused");
  expect(yellowApp).toContain('{listening ? "Listening…" : "⌁"}');
});
