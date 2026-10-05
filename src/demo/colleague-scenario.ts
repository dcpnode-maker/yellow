import { buildDemoFrontDeskBoard } from "./front-desk-board";
import { buildDemoHotelPerformance } from "./hotel-performance";
import { buildColleagueOperatingJourney } from "./operating-journey";

export type ColleagueScenarioStepId =
  | "open-mobile-shell"
  | "review-today-board"
  | "review-business-mix"
  | "walk-arrival"
  | "prove-cashier-safety"
  | "review-group-block"
  | "walk-checkout"
  | "ask-overwatch";

export interface ColleagueScenarioStep {
  readonly id: ColleagueScenarioStepId;
  readonly title: string;
  readonly route: string;
  readonly purpose: string;
  readonly expectedProof: readonly string[];
  readonly operationalActionsEnabled: false;
  readonly safetyGate: string;
}

export interface ColleagueDemoScenario {
  readonly status: "not_ready";
  readonly shareNotificationAllowed: false;
  readonly property: {
    readonly code: "YELLOW-DEMO";
    readonly name: "Yellow Grand Demo Hotel";
    readonly businessDate: "2026-09-23";
  };
  readonly guest: {
    readonly reservationCode: string;
    readonly guestName: string;
    readonly room: string;
  };
  readonly headline: {
    readonly dueIn: number;
    readonly inHouse: number;
    readonly dueOut: number;
    readonly occupancyPct: number | null;
    readonly adrMinor: number | null;
    readonly revparMinor: number | null;
  };
  readonly steps: readonly ColleagueScenarioStep[];
  readonly remainingGates: readonly string[];
}

export function buildColleagueDemoScenario(): ColleagueDemoScenario {
  const board = buildDemoFrontDeskBoard();
  const performance = buildDemoHotelPerformance();
  const journey = buildColleagueOperatingJourney();

  return Object.freeze({
    status: "not_ready" as const,
    shareNotificationAllowed: false as const,
    property: Object.freeze({
      code: journey.property.code,
      name: journey.property.name,
      businessDate: journey.property.businessDate,
    }),
    guest: Object.freeze({
      reservationCode: journey.guestScenario.reservationCode,
      guestName: journey.guestScenario.guestName,
      room: journey.guestScenario.room,
    }),
    headline: Object.freeze({
      dueIn: board.headline.dueIn,
      inHouse: board.headline.inHouse,
      dueOut: board.headline.dueOut,
      occupancyPct: performance.hotel.occupancyPct,
      adrMinor: performance.hotel.adrMinor,
      revparMinor: performance.hotel.revparMinor,
    }),
    steps: Object.freeze([
      step("open-mobile-shell", "Open the mobile-first shell", "/", "Confirm the first screen is compact, glassy and useful on a phone.", [
        "Shows occupancy, ADR and RevPAR from the server read model.",
        "Shows Today board and rooms summary without horizontal overflow.",
      ]),
      step("review-today-board", "Review front-desk work", "/api/v1/demo/front-desk-board", "Inspect arrivals, in-house, departures, room status and cashier permissions.", [
        "Sara Al Harbi is due in with inspected room 303.",
        "Cashier can read and prepare work; posting and settlement remain disabled.",
      ]),
      step("review-business-mix", "Review hotel math", "/api/v1/demo/performance", "Show hotel total, MSG, MS/source and room-type performance.", [
        "MSG to MS is the only parent-child demand hierarchy.",
        "ADR and RevPAR are recomputed from aggregated numerators and denominators.",
      ]),
      step("walk-arrival", "Walk guided arrival", "/api/v1/demo/operating-journey", "Show arrival context and the check-in action that will require confirmation.", [
        "Arrival, stay, cashier, housekeeping, group, checkout and Overwatch cards are present.",
        "Every action is disabled and confirmation-gated.",
      ]),
      step("prove-cashier-safety", "Prove cashier safety", "/api/v1/demo/sandbox/actions/execute", "Demonstrate sandbox-only execution with no journal, payment, document or outbox write.", [
        "Without exact phrase, sandbox state does not change.",
        "With exact phrase, only synthetic overlay changes; realPmsExecuted remains false.",
      ]),
      step("review-group-block", "Review group reservation manager", "/api/v1/demo/group-blocks/manager", "Show block pickup, rooming-list gap, cutoff risk and wash/release controls.", [
        "Definite MICE block deducts inventory by status in the read model.",
        "Pickup/import/wash/status actions require confirmation and remain disabled.",
      ]),
      step("walk-checkout", "Walk guided checkout", "/api/v1/demo/front-desk-board", "Show due-out readiness and blocked checkout when an open balance exists.", [
        "Nina Kapoor is ready with zero open balance.",
        "Omar Siddiqui is blocked by open balance and requires cashier settlement policy.",
      ]),
      step("ask-overwatch", "Ask Yellow Overwatch", "/api/v1/overwatch/message", "Ask a multilingual PMS intent and show the suggested workbench/action without execution.", [
        "Operational prompt returns suggestedWorkbench and suggestedActionId.",
        "Gemini is not called for operational actions; executed remains false.",
      ]),
    ]),
    remainingGates: Object.freeze([
      "Configured Gemini key smoke for non-operational guidance.",
      "Public URL/mobile viewport proof, not only local loopback.",
      "Governed database-backed command services and independent proof before any real mutation can be called complete.",
    ]),
  });
}

function step(
  id: ColleagueScenarioStepId,
  title: string,
  route: string,
  purpose: string,
  expectedProof: readonly string[],
): ColleagueScenarioStep {
  return Object.freeze({
    id,
    title,
    route,
    purpose,
    expectedProof: Object.freeze([...expectedProof]),
    operationalActionsEnabled: false,
    safetyGate: "Read-only or synthetic-demo-only; no real PMS state is changed.",
  });
}
