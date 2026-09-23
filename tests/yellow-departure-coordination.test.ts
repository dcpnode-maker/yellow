import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { departureServiceConfirmationIntent, departureServiceVoiceIntent, reservationVoiceAction } from "../frontend/yellow/src/voice";

const api = readFileSync(new URL("../frontend/yellow/src/yellow-api.tsx", import.meta.url), "utf8");
const journey = readFileSync(new URL("../frontend/yellow/src/workspaces/ReservationWorkspace.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../frontend/yellow/src/App.tsx", import.meta.url), "utf8");
const operations = readFileSync(new URL("../frontend/yellow/src/workspaces/OperationalHub.tsx", import.meta.url), "utf8");

describe("Order 593 governed departure coordination", () => {
  test("voice prepares a bounded service intent but only confirmation is actionable", () => {
    expect(departureServiceVoiceIntent("request luggage pickup in 15 minutes")).toEqual({ serviceKind: "luggage_pickup", timing: 15 });
    expect(departureServiceVoiceIntent("please check the minibar")).toEqual({ serviceKind: "minibar_check", timing: "immediate" });
    expect(departureServiceConfirmationIntent("yes")).toBe("confirm");
    expect(departureServiceConfirmationIntent("do it for everyone")).toBeNull();
  });

  test("departure voice resolves only active stays and opens the confirmation surface", () => {
    const reservations = [{ reservationId: "r1", confirmationNo: "ABC1", primaryGuestDisplayName: "Asha Rao", status: "in_house", operationalState: "in_house" }, { reservationId: "r2", confirmationNo: "ABC2", primaryGuestDisplayName: "Asha Rao", status: "checked_out", operationalState: "checked_out" }] as const;
    expect(reservationVoiceAction("request minibar check for ABC1", reservations)?.workbench).toBe("check-out");
    expect(reservationVoiceAction("request minibar check for Asha Rao", reservations)?.reservation.reservationId).toBe("r1");
    for (const text of [
      "const [departureConversation, setDepartureConversation]",
      "const [departureConversationPending, setDepartureConversationPending]",
      "departureServiceConfirmationIntent(message)",
      "conversationCommand={departureConversation}",
      "onConversationPendingChange={setDepartureConversationPending}",
      "Voice alone created no proposal or task.",
    ]) expect(app).toContain(text);
    expect(journey).toContain('kind: "prepare"');
    expect(journey).toContain('setServiceKind(conversationCommand.serviceKind)');
    expect(journey).toContain('setServiceTiming(conversationCommand.timing)');
    expect(journey).toContain('pending.length !== 1');
    expect(journey).toContain('void actOnDepartureService(request, "confirm")');
  });

  test("typed client and journey retain proposal, role, timing and queue boundaries", () => {
    for (const text of ["DepartureServiceRequest", "createDepartureServiceProposal", "transitionDepartureService", "idempotency-key", "/departure-services/proposals", "expectedVersion"]) expect(api).toContain(text);
    for (const text of ["Immediate", "In 10 minutes", "In 15 minutes", "In 30 minutes", "In 45 minutes", "Custom", "Confirm this separate", "Not recorded", "targetRoleName", "serviceProposalAttempt", "propertyLocalDateTimeToIso", "Choose outcome", "Withdraw proposal", "assigneePartyId"]) expect(journey).toContain(text);
    expect(journey).toContain("!serviceRoleId");
    expect(journey).toContain("!serviceOutcome");
    expect(journey).toContain("request.serviceKind === \"luggage_pickup\" || request.serviceKind === \"escalation\" ? null");
    expect(journey).toContain("serviceProposalAttempt.current?.fingerprint !== fingerprint");
    expect(app).toContain("const speechOutputPermit = useRef<number | null>(null);");
    expect(app).toContain("speechOutputPermit.current === assistantOperationGeneration.current");
  });

  test("operations service view exposes the role-visible property queue", () => {
    for (const text of ["loadDepartureServiceQueue", "DepartureServiceQueue", "ROLE-VISIBLE QUEUE", "targetRoleName", "dueLocal", "assigneePartyId", "eligibleActions.includes(\"assign\")", "eligibleActions.includes(\"start\")", "eligibleActions.includes(\"complete\")", "eligibleActions.includes(\"withdraw\")", "Choose outcome", "No open departure service requests"]) expect(operations).toContain(text);
    expect(operations).toContain("outcomeSelection[request.requestId]");
    expect(operations).toContain("<DepartureServiceQueue />");
  });
});
