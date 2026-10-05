import { expect, test } from "bun:test";
import { reservationGuestAllocationIntent } from "../frontend/yellow/src/voice";

const app = await Bun.file("frontend/yellow/src/App.tsx").text();

test("parses bounded guest-allocation follow-ups for one already-open reservation", () => {
  expect(reservationGuestAllocationIntent("add Amira Khan as an accompanying guest")).toEqual({
    kind: "add",
    query: "Amira Khan",
    role: "accompanying",
    sharePct: null,
    primarySharePct: null,
  });
  expect(reservationGuestAllocationIntent("add Amira Khan as sharer with 40 percent, primary 60 percent")).toEqual({
    kind: "add",
    query: "Amira Khan",
    role: "sharer",
    sharePct: "40.00",
    primarySharePct: "60.00",
  });
  expect(reservationGuestAllocationIntent("remove Amira Khan from this reservation")).toEqual({ kind: "remove", query: "Amira Khan" });
  expect(reservationGuestAllocationIntent("yes please")).toEqual({ kind: "confirm" });
  expect(reservationGuestAllocationIntent("no thanks")).toEqual({ kind: "cancel" });
});

test("fails closed on incomplete or noncanonical sharer instructions", () => {
  expect(reservationGuestAllocationIntent("add Amira Khan as sharer")).toEqual({
    kind: "add",
    query: "Amira Khan",
    role: "sharer",
    sharePct: null,
    primarySharePct: null,
  });
  expect(reservationGuestAllocationIntent("add as accompanying")).toBeNull();
  expect(reservationGuestAllocationIntent("add Amira Khan as sharer with 100.001 percent, primary 0 percent")).toBeNull();
  expect(reservationGuestAllocationIntent("yes, add her")).toBeNull();
});

test("binds conversational writes to one visible proposal, stale recheck and governed replacement", () => {
  for (const required of [
    "guestAllocationProposal",
    "baseline",
    "reservationGuestAllocationsMatch(freshDetail, proposal.baseline)",
    "replaceReservationGuests(proposal.reservationId, proposal.replacement, proposal.key)",
    "No guest allocation is waiting for confirmation.",
    "No change has been made. Shall I save this exact guest allocation?",
    "The guest allocation changed before confirmation, so I stopped without writing.",
    "const operationGeneration = ++assistantOperationGeneration.current",
    "if (assistantOperationWasSuperseded()) return;",
    "Guests and shares were already saved. I reconciled the authoritative reservation after the earlier uncertain response.",
  ]) expect(app).toContain(required);
  const confirmation = app.indexOf('if (guestConversationIntent.kind === "confirm")');
  const applied = app.indexOf("reservationGuestAllocationsMatch(freshDetail, proposal.replacement)", confirmation);
  const stale = app.indexOf("reservationGuestAllocationsMatch(freshDetail, proposal.baseline)", confirmation);
  expect(applied).toBeGreaterThan(confirmation);
  expect(stale).toBeGreaterThan(applied);
  const newInstruction = app.indexOf("Any new add/remove instruction supersedes");
  const load = app.indexOf("const currentDetail = await loadReservation(activeReservation)", newInstruction);
  expect(app.indexOf("setGuestAllocationProposal(null);", newInstruction)).toBeLessThan(load);
});

test("does not claim Party creation or financial splitting", () => {
  const start = app.indexOf("guestAllocationProposal");
  expect(start).toBeGreaterThan(-1);
  const surface = app.slice(start, start + 16_000);
  expect(surface).not.toContain("createParty");
  expect(surface).not.toContain("splitFolio");
  expect(surface).not.toContain("invoice owner");
});

test("identity resolution sees primary and inactive exact matches before eligibility filtering", () => {
  const removeStart = app.indexOf('if (guestConversationIntent.kind === "remove")');
  const removeEnd = app.indexOf("} else {", removeStart);
  const removeSurface = app.slice(removeStart, removeEnd);
  expect(removeSurface).not.toContain('guest.role !== "primary" &&');
  expect(removeSurface).toContain('if (removed.role === "primary")');
  const addStart = removeEnd;
  const addEnd = app.indexOf("const sharers = replacement.guests", addStart);
  const addSurface = app.slice(addStart, addEnd);
  expect(addSurface).toContain('exactProfiles[0]!.status !== "active"');
  expect(addSurface).toContain('exactProfiles.length === 0 && profiles.length === 1 && profiles[0]!.status === "active"');
  expect(addSurface).not.toContain("const activeProfiles = profiles.filter");
});

test("keeps guest conversation inside the named check-in journey without sharing confirmation authority", () => {
  expect(app).toContain("const activeReservation = assistantCard?.reservationId ?? activeArrival");
  expect(app).toContain("activeArrival &&\n      !guestAllocationProposal &&");
  expect(app).toContain("const activeReservationCardContext = assistantCard?.checkInReservationId === activeReservation");
  expect(app).toContain('queryKey: ["overwatch-reservation", propertyId, proposal.reservationId]');
  expect(app).toContain('queryKey: ["overwatch-check-in", propertyId, proposal.reservationId]');
  expect(app).toContain("...activeReservationCardContext");
});
