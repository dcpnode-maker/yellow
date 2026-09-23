import { expect, test } from "bun:test";
import {
  arrivalCleaningAttendantIntent,
  cashierChargeIntent,
  cashierChargeConfirmationIntent,
  housekeepingTaskActionIntent,
  folioBillWindowTransferIntent,
  hasFolioBillWindowPartialSplitIntent,
  resolveArrivalCleaningAttendant,
  guidedNavigationPath,
  guestProfileVoiceAction,
  guestProfileVoiceCandidates,
  isAssistantWakeWord,
  defaultVoiceLanguage,
  preferredSpeechVoice,
  languageFromBrowserLocales,
  languagePreferenceFromText,
  mergeVoiceTranscript,
  operationalLanePath,
  requestedMetric,
  requestedOperationalState,
  requestedOperationalLane,
  requestedWorkspace,
  requestVoiceMicrophone,
  resolveLocalReadIntent,
  reservationVoiceAction,
  reservationGuestAllocationIntent,
  resolveCashierChargeOption,
  voicePauseMs,
  voiceRestartLimit,
} from "../frontend/yellow/src/voice";

test("prepares only explicit currency-bound named cashier charges", () => {
  expect(cashierChargeIntent("post a SAR 120 laundry charge to Omar Siddiqui")).toEqual({
    currency: "SAR", amountMinor: "12000", amountMajor: "120.00", chargeQuery: "laundry", guestQuery: "Omar Siddiqui",
  });
  expect(cashierChargeIntent("add a guest transfer charge of SAR 75.50 to Omar Siddiqui's folio")).toEqual({
    currency: "SAR", amountMinor: "7550", amountMajor: "75.50", chargeQuery: "guest transfer", guestQuery: "Omar Siddiqui",
  });
  expect(cashierChargeIntent("charge Omar Siddiqui SAR 25 for dessert")).toEqual({
    currency: "SAR", amountMinor: "2500", amountMajor: "25.00", chargeQuery: "dessert", guestQuery: "Omar Siddiqui",
  });
  for (const unsafe of [
    "post laundry to Omar Siddiqui",
    "post SAR 0 laundry charge to Omar Siddiqui",
    "post SAR -1 laundry charge to Omar Siddiqui",
    "post SAR 1.234 laundry charge to Omar Siddiqui",
    "post JPY 1 laundry charge to Omar Siddiqui",
    "post KWD 1.23 laundry charge to Omar Siddiqui",
    "post SAR 20 charge to Omar Siddiqui",
    "yes",
  ]) expect(cashierChargeIntent(unsafe)).toBeNull();
  expect(app).toContain('reservationVoiceAction(`open cashier for ${cashierInstruction.guestQuery}`, all)');
  expect(app).toContain("error instanceof FolioChargeRequestError");
  expect(app).toContain("!error.uncertain");
  expect(app).toContain("postingAttempted: true");
  expect(app).toContain("I cannot say that nothing was posted because a posting attempt already crossed the server boundary.");
  expect(app).toContain("The prior attempt remains unresolved; Yellow will never replace its idempotency key or describe it as cancelled.");
  expect(app).toContain('detail.reservation.status !== "in_house" && detail.reservation.status !== "due_out"');
  expect(app).toContain('freshReservation.reservation.status !== "in_house" && freshReservation.reservation.status !== "due_out"');
  expect(app).toContain("freshOpenFolios.length !== 1");
  expect(app).toContain("encounteredUncertainResponse = true");
  expect(app).toContain("!proposal.postingAttempted && !encounteredUncertainResponse");
  expect(app).toContain('refreshed.folio.currency === proposal.currency');
  expect(app).toContain('row.quantity === receipt.quantity && row.businessDate === receipt.businessDate');
  expect(app).toContain('{ primary: `Folio ${folioReference}`, secondary: "Exact open folio window" }');
});

test("confirms a cashier charge only with a finite pending-proposal answer", () => {
  for (const accepted of ["yes", "yes please", "go ahead", "confirm", "post it", "haan", "हाँ"])
    expect(cashierChargeConfirmationIntent(accepted)).toBe("confirm");
  for (const cancelled of ["no", "cancel", "stop", "not now", "nahi", "नहीं"])
    expect(cashierChargeConfirmationIntent(cancelled)).toBe("cancel");
  for (const unrelated of ["post laundry", "yes to checkout", "do everything", "charge it twice"])
    expect(cashierChargeConfirmationIntent(unrelated)).toBeNull();
});

test("keeps spoken bill-window transfers deterministic and refuses partial allocation language", () => {
  expect(folioBillWindowTransferIntent("Move Laundry for Omar Siddiqui to window 2")).toEqual({
    chargeQuery: "Laundry", guestQuery: "Omar Siddiqui", destination: { kind: "existing", windowNo: 2 },
  });
  expect(folioBillWindowTransferIntent("Move Laundry for Omar Siddiqui to a new bill called Personal")).toEqual({
    chargeQuery: "Laundry", guestQuery: "Omar Siddiqui", destination: { kind: "new", name: "Personal" },
  });
  expect(hasFolioBillWindowPartialSplitIntent("Move 50 percent Laundry for Omar Siddiqui to window 2")).toBeTrue();
  expect(folioBillWindowTransferIntent("Move 50 percent Laundry for Omar Siddiqui to window 2")).toBeNull();
  expect(hasFolioBillWindowPartialSplitIntent("Move 50% Laundry for Omar Siddiqui to window 2")).toBeTrue();
  expect(folioBillWindowTransferIntent("Move Laundry for Omar Siddiqui to a new bill called Personal 50%")).toBeNull();
  expect(folioBillWindowTransferIntent("Move Laundry for Omar Siddiqui to a new bill called Personal 50%.")).toBeNull();
  expect(folioBillWindowTransferIntent("Move Laundry for Omar Siddiqui to a new bill called Personal 50%!")).toBeNull();
});

test("resolves one exact server-returned charge option without inventing a code", () => {
  const options = [
    { code: "L3R_LAUNDRY", name: "Laundry", usaliLine: "Other operated departments" },
    { code: "L3R_TRANSFER", name: "Guest transfer", usaliLine: "Other operated departments" },
    { code: "ROOM", name: "Room charge", usaliLine: "Rooms" },
  ] as const;
  expect(resolveCashierChargeOption("laundry", options)).toEqual({ kind: "resolved", option: options[0] });
  expect(resolveCashierChargeOption("L3R_TRANSFER", options)).toEqual({ kind: "resolved", option: options[1] });
  expect(resolveCashierChargeOption("operated departments", options)).toEqual({ kind: "ambiguous" });
  expect(resolveCashierChargeOption("minibar", options)).toEqual({ kind: "not_found" });
});

test("parses only bounded housekeeping lifecycle declarations", () => {
  expect(housekeepingTaskActionIntent("start cleaning")).toBe("start");
  expect(housekeepingTaskActionIntent("begin housekeeping")).toBe("start");
  expect(housekeepingTaskActionIntent("mark room clean")).toBe("complete");
  expect(housekeepingTaskActionIntent("cleaning is complete")).toBe("complete");
  expect(housekeepingTaskActionIntent("inspect room")).toBe("verify");
  expect(housekeepingTaskActionIntent("mark room inspected")).toBe("verify");
  for (const unsafe of ["clean", "ready", "do it", "finish everything", "inspect hotel", "mark room dirty"])
    expect(housekeepingTaskActionIntent(unsafe)).toBeNull();
});

test("parses only a bounded arrival-cleaning attendant instruction", () => {
  expect(arrivalCleaningAttendantIntent("assign cleaning to Rahul Sharma")).toBe("Rahul Sharma");
  expect(arrivalCleaningAttendantIntent("send room cleaning task to 03474874-f554-5047-b334-6907bf824b05")).toBe("03474874-f554-5047-b334-6907bf824b05");
  expect(arrivalCleaningAttendantIntent("assign cleaning")).toBeNull();
  expect(arrivalCleaningAttendantIntent("mark room clean for Rahul Sharma")).toBeNull();
});

test("resolves only one exact active staff Party for arrival cleaning", () => {
  const active = { partyId: "staff-1", displayName: "Rahul Sharma", status: "active", roles: ["staff"] } as const;
  expect(resolveArrivalCleaningAttendant("Rahul Sharma", [active])).toEqual({
    kind: "resolved",
    partyId: "staff-1",
    displayName: "Rahul Sharma",
  });
  expect(resolveArrivalCleaningAttendant("staff-1", [active])).toEqual({
    kind: "resolved",
    partyId: "staff-1",
    displayName: "Rahul Sharma",
  });
  expect(resolveArrivalCleaningAttendant("Rahul", [active])).toEqual({ kind: "ineligible" });
  expect(resolveArrivalCleaningAttendant("Rahul Sharma", [{ ...active, status: "inactive" }])).toEqual({ kind: "ineligible" });
  expect(resolveArrivalCleaningAttendant("Rahul Sharma", [{ ...active, roles: ["guest"] }])).toEqual({ kind: "ineligible" });
  expect(resolveArrivalCleaningAttendant("Rahul Sharma", [active, { ...active, partyId: "staff-2" }])).toEqual({ kind: "ambiguous" });
});

test("guest allocation confirmations stay narrow and require an active proposal", () => {
  expect(reservationGuestAllocationIntent("confirm")).toEqual({ kind: "confirm" });
  expect(reservationGuestAllocationIntent("cancel")).toEqual({ kind: "cancel" });
  expect(reservationGuestAllocationIntent("confirm reservation ARR-CLEAN")).toBeNull();
});

const app = await Bun.file("frontend/yellow/src/App.tsx").text();

test("uses browser locale only as a local language hint and accepts an explicit spoken choice", () => {
  expect(defaultVoiceLanguage).toBe("English (India)");
  expect(languageFromBrowserLocales(["mr-IN", "en-IN"])).toBe("Marathi");
  expect(languageFromBrowserLocales(["en-IN"])).toBe("English (India)");
  expect(languagePreferenceFromText("Please speak Marathi")).toBe("Marathi");
  expect(languagePreferenceFromText("Do not speak Hindi")).toBeNull();
  expect(languagePreferenceFromText("No Marathi please")).toBeNull();
  expect(languagePreferenceFromText("I do not prefer Hindi")).toBeNull();
  expect(languagePreferenceFromText("Show English breakfast charges")).toBeNull();
  expect(languagePreferenceFromText("switch to Kannada")).toBe("Kannada");
  expect(languagePreferenceFromText("Telugu please")).toBe("Telugu");
  expect(languagePreferenceFromText("show arrivals")).toBeNull();
  expect(preferredSpeechVoice([
    { lang: "en-US", name: "English US" },
    { lang: "en-IN", name: "Microsoft Heera" },
  ], "en-IN")?.name).toBe("Microsoft Heera");
  expect(preferredSpeechVoice([
    { lang: "en-IN", name: "Microsoft Heera" },
    { lang: "en-IN", name: "Microsoft Ravi" },
  ], "en-IN")?.name).toBe("Microsoft Ravi");
});

const arrivals = [
  {
    reservationId: "r-clean",
    confirmationNo: "ARR-CLEAN",
    primaryPartyName: "Arrival Clean Example",
    operationalState: "due_in",
  },
  {
    reservationId: "r-dirty",
    confirmationNo: "ARR-DIRTY",
    primaryPartyName: "Arrival Dirty Example",
    operationalState: "due_in",
  },
] as const;

const departures = [
  {
    reservationId: "r-out",
    confirmationNo: "DEP-READY",
    primaryPartyName: "Ella Clarke",
    status: "due_out",
  },
  {
    reservationId: "r-old",
    confirmationNo: "DEP-HISTORY",
    primaryPartyName: "Ella Clarke",
    status: "checked_out",
  },
] as const;

test("routes arrivals in English and Indian-language prompts", () => {
  expect(requestedOperationalLane("Show today's arrivals")).toBe("due_in");
  expect(requestedOperationalLane("आज के आगमन दिखाओ")).toBe("due_in");
  expect(requestedOperationalLane("నేటి రాకలు చూపండి")).toBe("due_in");
  expect(
    operationalLanePath("property id", "due_in"),
  ).toBe("/p/property%20id/today?lane=due_in");
});

test("separates completed-today and stayover reads from planned movement lanes", () => {
  expect(requestedOperationalState("Show guests checked in today")).toBe("checked_in_today");
  expect(requestedOperationalState("Show today's stayovers")).toBe("stayover");
  expect(requestedOperationalState("Show guests checked out today")).toBe("checked_out_today");
  expect(resolveLocalReadIntent("Show guests checked in today")).toEqual({
    kind: "state",
    state: "checked_in_today",
  });
  expect(resolveLocalReadIntent("Show today's departures")).toEqual({ kind: "lane", lane: "due_out" });
});

test("accepts only finite server guidance as a safe workspace deep link", () => {
  expect(guidedNavigationPath("property id", "today", "due_in")).toBe(
    "/p/property%20id/today?lane=due_in",
  );
  expect(guidedNavigationPath("property id", "guests", null)).toBe(
    "/p/property%20id/guests",
  );
  expect(guidedNavigationPath("property id", "folios", null)).toBe(
    "/p/property%20id/today?workspace=finance",
  );
  expect(guidedNavigationPath("property id", "rates", null)).toBe(
    "/p/property%20id/today?workspace=rates",
  );
  expect(guidedNavigationPath("property id", "/untrusted", "due_in")).toBeNull();
  expect(guidedNavigationPath("property id", "today", "untrusted")).toBe(
    "/p/property%20id/today",
  );
});

test("routes common front-desk workspaces locally before any model request", () => {
  expect(requestedWorkspace("Show housekeeping rooms")).toBe("housekeeping");
  expect(requestedWorkspace("Open guest profiles")).toBe("guests");
  expect(requestedWorkspace("Open the billing desk")).toBe("cashiers");
  expect(requestedWorkspace("फोलियो दिखाओ")).toBe("cashiers");
  expect(requestedWorkspace("Show current rates")).toBe("rates");
  expect(requestedWorkspace("రేట్లు చూపించు")).toBe("rates");
  expect(requestedWorkspace("बुकिंग दिखाओ")).toBe("reservations");
});

test("resolves named guest history to one canonical Party across repeat stays", () => {
  const repeat = [
    { reservationId: "a1", confirmationNo: "A1", primaryPartyId: "party-aarav", primaryGuestDisplayName: "Aarav Mehta" },
    { reservationId: "a2", confirmationNo: "A2", primaryPartyId: "party-aarav", primaryGuestDisplayName: "Aarav Mehta" },
    { reservationId: "b1", confirmationNo: "B1", primaryPartyId: "party-aisha", primaryGuestDisplayName: "Aisha Kareem" },
  ] as const;
  expect(guestProfileVoiceAction("Show Aarav Mehta's guest history", repeat)).toEqual({ partyId: "party-aarav", displayName: "Aarav Mehta" });
  expect(guestProfileVoiceAction("Show guest history for A2", repeat)).toEqual({ partyId: "party-aarav", displayName: "Aarav Mehta" });
  expect(guestProfileVoiceAction("Show guest profiles", repeat)).toBeNull();
});

test("keeps same-name different-Party ambiguity local", () => {
  const collision = [
    { reservationId: "a1", confirmationNo: "A1", primaryPartyId: "party-one", primaryGuestDisplayName: "Aarav Mehta" },
    { reservationId: "a2", confirmationNo: "A2", primaryPartyId: "party-two", primaryGuestDisplayName: "Aarav Mehta" },
  ] as const;
  expect(guestProfileVoiceAction("Show Aarav Mehta's guest history", collision)).toBeNull();
  expect(guestProfileVoiceCandidates("Show Aarav Mehta's guest history", collision).map((candidate) => candidate.confirmations[0])).toEqual(["A1", "A2"]);
  expect(app).toContain("I found multiple separate guest profiles with that name");
});

test("renders a resolved Party profile inside Yellow", () => {
  expect(app).toContain("guestPartyId?: string");
  expect(app).toContain("<InlineGuestProfile");
  expect(app).toContain("guestPartyId: namedGuest.partyId");
  expect(app).toContain("loadPartyStayHistory(partyId)");
});

test("routes hotel KPIs locally before generic rate-workspace language", () => {
  expect(requestedMetric("Show occupancy")).toBe("occupancy");
  expect(requestedMetric("Show rooms sold and room nights")).toBe("rooms_sold");
  expect(requestedMetric("Show today's ADR")).toBe("adr");
  expect(requestedMetric("Show RevPAR")).toBe("revpar");
  expect(requestedMetric("How many rooms are available in inventory?")).toBe("inventory");
  expect(requestedMetric("Show actuals, pace and plan")).toBe("performance");
  expect(resolveLocalReadIntent("Show average daily rate")).toEqual({ kind: "metric", metric: "adr" });
  expect(resolveLocalReadIntent("Show revenue per available room")).toEqual({ kind: "metric", metric: "revpar" });
});

test("renders deterministic KPI comparisons inside Yellow without a model call", () => {
  expect(app).toContain('performance: { intent: requestedMetricIntent, data: metricData }');
  expect(app).toContain('className="yellow-inline-performance"');
  expect(app).toContain("<InlinePerformanceResult");
  expect(app).toContain("Today, MTD, QTD and YTD against last year, forecast and budget");
  expect(app).toContain("Swipe the table sideways to compare every plan column.");
  expect(app).toContain('void ask(request);');
  expect(app).toContain('onOpenPerformance={() => setPerformanceDetailRequestKey((key) => key + 1)}');
});

test("renders deterministic PMS workspace reads inside Yellow without navigation", () => {
  expect(app).toContain('workspace: targetWorkspace');
  expect(app).toContain('className="yellow-inline-workspace"');
  expect(app).toContain('<ReservationBoardWorkspace timezone={selected?.timezone ?? "UTC"} />');
  expect(app).toContain('<GuestsWorkspace />');
  expect(app).toContain('<HousekeepingWorkspace onLifecycleBusyChange={setReservationLifecycleFlight} />');
  expect(app).toContain('<FinanceWorkspace onLifecycleBusyChange={setReservationLifecycleFlight} />');
  expect(app).toContain('<CommercialWorkspace />');
  expect(app).not.toContain('workflow(targetWorkspace);');
});

test("prioritises a specific operational lane over a generic booking workspace", () => {
  expect(resolveLocalReadIntent("Show today's arrivals reservations")).toEqual({
    kind: "lane",
    lane: "due_in",
  });
  expect(resolveLocalReadIntent("Show guest profiles")).toEqual({
    kind: "workspace",
    workspace: "guests",
  });
});

test("renders deterministic movement reads as an inline Yellow workbench", () => {
  expect(app).toContain('movement: {');
  expect(app).toContain('status: askedLane');
  expect(app).toContain('lane: { reservations: laneReservations }');
  expect(app).toContain('className="yellow-inline-movement"');
  expect(app).toContain('headingId="yellow-inline-movement-heading"');
  expect(app).not.toContain('window.location.assign(operationalLanePath(propertyId, askedLane))');
  expect(app).toContain('const exactReservations = all.filter((reservation) => reservation.operationalState === askedState);');
  expect(app).toContain('title: operationalStateLabel(askedState)');
  expect(app).toContain('status: askedState === "checked_out_today" ? "all" : "in_house"');
});

test("applies the shared compound reservation query before broad local lane routing", () => {
  const compound = app.indexOf("const reservationQueryResolution = resolveReservationQueryIntent(");
  const broad = app.indexOf("const readIntent = resolveLocalReadIntent(message);");
  expect(compound).toBeGreaterThan(-1);
  expect(broad).toBeGreaterThan(compound);
  expect(app).toContain("The complete reservation board is unavailable right now. Yellow will not substitute a partial arrivals or departures list.");
  expect(app).toContain("reservationQuery: context");
  expect(app).toContain("query={assistantCard.movement.query}");
  expect(app).toContain("Back to filtered reservations");
  expect(app).toContain("detailReservationId: stay.reservationId");
});

test("keeps natural voice turns open across ordinary phrase breaks", () => {
  expect(voicePauseMs).toBe(2200);
  expect(voiceRestartLimit).toBe(8);
  const first = mergeVoiceTranscript("", [
    { transcript: "show me", isFinal: true },
  ]);
  expect(first).toEqual({ committed: "show me", display: "show me" });
  const pause = mergeVoiceTranscript(first.committed, [
    { transcript: "today's", isFinal: false },
  ]);
  expect(pause).toEqual({ committed: "show me", display: "show me today's" });
  const completed = mergeVoiceTranscript(first.committed, [
    { transcript: "today's arrivals", isFinal: true },
  ]);
  expect(completed).toEqual({
    committed: "show me today's arrivals",
    display: "show me today's arrivals",
  });
  expect(app).toContain("results.slice(event.resultIndex ?? 0)");
  expect(app).toContain("finishTurn(committedWords)");
});

test("handles a bare Yellow greeting or Overwatch wake phrase without a model request", () => {
  expect(isAssistantWakeWord("Yellow")).toBeTrue();
  expect(isAssistantWakeWord("Hi Yellow!")).toBeTrue();
  expect(isAssistantWakeWord("Overwatch!")).toBeTrue();
  expect(isAssistantWakeWord("yellow, show arrivals")).toBeFalse();
});

test("keeps a visible text send action alongside the microphone", () => {
  expect(app).toContain('aria-label="Send request to Yellow"');
  expect(app).toContain('disabled={thinking || prompt.trim().length === 0}');
});

test("keeps the same Yellow active-state shell across every PMS workspace", () => {
  expect(app).toContain("const shellClassName =");
  expect(app).toContain('assistant ? ` yellow-ai-active ${yellowVisualState}` : ""');
  expect(app.match(/<div className=\{shellClassName\} aria-busy=\{reservationLifecycleBusy \|\| undefined\} onClickCapture=\{guardReservationLifecycleFlight\} onSubmitCapture=\{guardReservationLifecycleFlight\}>/gu)?.length).toBe(7);
  expect(app).not.toContain('<div className="yellow-next">');
});

test("requests and immediately releases the browser microphone stream", async () => {
  let stopped = 0;
  const mediaDevices = {
    getUserMedia: async () => ({
      getTracks: () => [
        {
          stop: () => {
            stopped += 1;
          },
        },
      ],
    }),
  } as unknown as Pick<MediaDevices, "getUserMedia">;
  expect(await requestVoiceMicrophone(mediaDevices)).toBe("granted");
  expect(stopped).toBe(1);
  expect(await requestVoiceMicrophone(undefined)).toBe("unavailable");
  expect(
    await requestVoiceMicrophone({
      getUserMedia: async () => {
        throw new Error("denied");
      },
    }),
  ).toBe("denied");
});

test("opens a uniquely named reservation without creating a write", () => {
  expect(reservationVoiceAction("open Arrival Clean", arrivals)).toEqual({
    reservation: arrivals[0],
    workbench: null,
  });
  expect(
    reservationVoiceAction("prepare check-in ARR-CLEAN", arrivals),
  ).toEqual({ reservation: arrivals[0], workbench: "check-in" });
});

test("resolves a natural named check-in against current due-ins rather than repeat-stay history", () => {
  const repeatStays = [
    {
      reservationId: "r-current",
      confirmationNo: "ARR-CURRENT",
      primaryPartyName: "Meera Iyer",
      status: "reserved",
      operationalState: "due_in",
    },
    {
      reservationId: "r-future",
      confirmationNo: "ARR-FUTURE",
      primaryPartyName: "Meera Iyer",
      status: "reserved",
      operationalState: "reserved",
    },
    {
      reservationId: "r-history",
      confirmationNo: "ARR-HISTORY",
      primaryPartyName: "Meera Iyer",
      status: "checked_out",
      operationalState: "checked_out",
    },
  ] as const;
  expect(reservationVoiceAction("prepare check-in for Meera Iyer", repeatStays)).toEqual({
    reservation: repeatStays[0],
    workbench: "check-in",
  });
  expect(reservationVoiceAction("open Meera Iyer", repeatStays)).toBeNull();
  expect(reservationVoiceAction("prepare check-in ARR-FUTURE", repeatStays)).toBeNull();
  expect(reservationVoiceAction("prepare check-in UNKNOWN-STATE", [{
    reservationId: "r-unknown",
    confirmationNo: "UNKNOWN-STATE",
    primaryPartyName: "Meera Iyer",
  }])).toBeNull();
  expect(reservationVoiceAction("prepare check-in ARR-CURRENT-FUTURE", [
    { ...repeatStays[0], confirmationNo: "ARR-CURRENT" },
    { ...repeatStays[1], confirmationNo: "ARR-CURRENT-FUTURE" },
  ])).toBeNull();
});

test("keeps two current due-ins with the same name ambiguous", () => {
  const duplicateDueIns = [
    { reservationId: "r-one", confirmationNo: "ARR-ONE", primaryPartyName: "Meera Iyer", operationalState: "due_in" },
    { reservationId: "r-two", confirmationNo: "ARR-TWO", primaryPartyName: "Meera Iyer", operationalState: "due_in" },
  ] as const;
  expect(reservationVoiceAction("prepare check-in for Meera Iyer", duplicateDueIns)).toBeNull();
  expect(reservationVoiceAction("prepare check-in ARR-TWO", duplicateDueIns)).toEqual({
    reservation: duplicateDueIns[1],
    workbench: "check-in",
  });
  expect(reservationVoiceAction("prepare check-in ARR-ONE and ARR-TWO", duplicateDueIns)).toBeNull();
});

test("resolves named commands from the complete governed reservation index", () => {
  expect(app).toContain('queryKey: ["yellow-reservation-command-index", propertyId]');
  expect(app).toContain('queryFn: loadReservationBoard');
  expect(app).toContain('indexedReservations = (await reservationIndexQuery.refetch()).data?.reservations;');
  expect(app).toContain('const all = indexedReservations?.length');
  expect(app).toContain(': lanes.flatMap((x) => x.query.data?.reservations ?? [])');
});

test("routes a uniquely named guest bill to the cashier workbench without a financial write", () => {
  const currentStay = { reservationId: "current", confirmationNo: "NOW", primaryPartyName: "Omar Siddiqui", status: "in_house" } as const;
  const historicalStay = { reservationId: "history", confirmationNo: "OLD", primaryPartyName: "Omar Siddiqui", status: "checked_out" } as const;
  expect(reservationVoiceAction("open Omar Siddiqui folio", [currentStay, historicalStay])).toEqual({
    reservation: currentStay,
    workbench: "cashier",
  });
  expect(reservationVoiceAction("Open cashier for Omar Siddiqui", [currentStay, historicalStay])).toEqual({
    reservation: currentStay,
    workbench: "cashier",
  });
  expect(reservationVoiceAction("Open cashier for Omar Siddiqui", [
    { ...currentStay, operationalState: "checked_in_today" },
    historicalStay,
  ])?.reservation.reservationId).toBe("current");
  for (const incoherent of [
    { reservationId: "x", confirmationNo: "X", primaryPartyName: "Conflict Guest", status: "checked_out", operationalState: "stayover" },
    { reservationId: "x", confirmationNo: "X", primaryPartyName: "Conflict Guest", status: "cancelled", operationalState: "in_house" },
    { reservationId: "x", confirmationNo: "X", primaryPartyName: "Conflict Guest", status: "reserved", operationalState: "checked_in_today" },
  ]) expect(reservationVoiceAction("Open cashier for Conflict Guest", [incoherent])).toBeNull();
  expect(reservationVoiceAction("Open cashier for Future Guest", [
    { reservationId: "future", confirmationNo: "FUTURE", primaryPartyName: "Future Guest", status: "reserved" },
  ])).toBeNull();
  expect(app).toContain('namedReservationAction?.workbench === "cashier"');
  expect(app).toContain('workspace: "cashiers"');
  expect(app).toContain("cashierReservationId: namedReservationAction.reservation.reservationId");
  expect(app).toContain('key={assistantCard.cashierReservationId ?? "cashiers"}');
  expect(app).toContain("initialReservationId={assistantCard.cashierReservationId}");
  expect(app).not.toContain("workspace=finance&reservation=${encodeURIComponent(namedReservationAction.reservation.reservationId)}");
  expect(app).toContain("I will not post, settle, or alter the folio without a separate visible confirmation.");
  expect(app).toContain("I’ll speak in Indian English.");
  expect(app).toContain('className="cashier-charge-groups"');
  expect(app).toContain('aria-pressed={chargeGroup === group}');
  expect(app).toContain('className={`cashier-status ${statusTone(stay.status)}`}');
  expect(app).not.toContain("Charge class<select");
});

test("opens a uniquely named departure readiness view without performing checkout", () => {
  expect(
    reservationVoiceAction("prepare checkout for Ella Clarke", departures),
  ).toEqual({ reservation: departures[0], workbench: "check-out" });
  expect(
    reservationVoiceAction("prepare checkout DEP-READY folio", departures),
  ).toEqual({ reservation: departures[0], workbench: "cashier" });
  expect(app).toContain('reservationAction.workbench === "check-out"');
  expect(app).toContain("Opening the governed checkout readiness");
  expect(app).toContain('eyebrow: preparingCheckOut ? "LIVE DEPARTURE FLOW" : "LIVE RESERVATION"');
  expect(app).toContain("reservationId: reservationAction.reservation.reservationId");
  expect(app).toContain('className="yellow-inline-reservation"');
  expect(app).toContain('key={assistantCard.reservationId}');
  expect(app).toContain('reservationId={assistantCard.reservationId}');
  expect(app).toContain('onLifecycleBusyChange={setReservationLifecycleFlight}');
  expect(app).toContain('disabled={!departureReady || !checkoutConfirmed || checkoutPosting || lifecyclePosting || operationalPosting || guestAllocationPosting}');
  expect(app).toContain("if (!departureReady || !checkoutConfirmed || checkoutPosting || lifecyclePosting || operationalPosting || guestAllocationPosting) return;");
});

test("renders named check-in work inside Overwatch while retaining a confirmation gate", () => {
  expect(app).toContain('checkInReservationId: reservationAction.reservation.reservationId');
  expect(app).toContain('<OverwatchCheckInJourney');
  expect(app).toContain('I confirm this named arrival and the live readiness result.');
  expect(app).toContain('disabled={!ready || !confirmed || committing}');
  expect(app).toContain('await commitCheckIn(reservationId, idempotencyKey.current)');
  expect(app).toContain('key={assistantCard.checkInReservationId}');
  expect(app).toContain('await Promise.all([detail.refetch(), readiness.refetch()]);');
  expect(app).toContain('className="yellow-inline-movement"');
  expect(app).toContain('title: workspaceTitle(targetWorkspace)');
  expect(app).not.toContain('window.location.assign(`/p/${propertyId}/res/${reservationAction.reservation.reservationId}`)');
  expect(app).toContain('key={assistantCard.reservationId}');
  expect(app).toContain('reservationId={assistantCard.reservationId}');
  expect(app).toContain('onLifecycleBusyChange={setReservationLifecycleFlight}');
  expect(app).not.toContain('label: "Open workspace"');
  expect(app).not.toContain('label: "Show on reservation board"');
  expect(app).not.toContain('window.setTimeout(() => workflow(workspace), 180)');
});

test("accepts a visible conversational proposal and confirmation without treating a bare yes as authority", () => {
  expect(app).toContain("conversationCommand: ArrivalConversationCommand | null");
  expect(app).toContain("setConversationProposal(Object.freeze({ kind: \"assign\"");
  expect(app).toContain("I do not have a specific pending action.");
  expect(app).toContain("await loadDueInRoomCandidates(reservationId)");
  expect(app).toContain("await assignDueInRoom(reservationId, proposal.body, attempt.key)");
  expect(app).toContain("await openPrimaryFolio(reservationId, folioIdempotencyKey.current)");
  expect(app).toContain("await commitCheckIn(reservationId, idempotencyKey.current)");
  expect(app).toContain("setArrivalConversation({ id:");
  expect(app).toContain('/^(?:yes|yes please|go ahead|confirm|haan|ha|हाँ)\\s*[.!]?$/iu');
  expect(app).toContain('/^(?:no|no thanks|cancel|stop|not now|nahi|नहीं)\\s*[.!]?$/iu');
  expect(app).toContain('setConversationProposal(null);');
  expect(app).toContain('loadReservation(reservationId)');
  expect(app).toContain('loadCheckInReadiness(reservationId)');
  expect(app).toContain('Pending spoken confirmation:');
  expect(app).toContain('result.isFinal === true');
  expect(app).toContain('!namedReservationAction');
});

test("opens a primary folio only for an otherwise-ready named arrival after a separate confirmation", () => {
  expect(app).toContain('`/api/v1/properties/${propertyId}/reservations/${reservationId}/primary-folio`');
  expect(app).toContain('"idempotency-key": idempotencyKey');
  expect(app).toContain('readiness.data?.blockers.length === 1');
  expect(app).toContain('reservation.status === "due_in"');
  expect(app).toContain('readiness.data.blockers[0] === "primary_folio_not_open"');
  expect(app).toContain('I confirm opening the primary folio for this arrival.');
  expect(app).toContain('disabled={!folioConfirmed || openingFolio}');
  expect(app).toContain('await Promise.all([detail.refetch(), readiness.refetch()]);');
  expect(app).toContain('await openPrimaryFolio(reservationId, folioIdempotencyKey.current);');
});

test("assigns an unassigned due-in room only from current server candidates after separate confirmation", () => {
  expect(app).toContain('`/api/v1/properties/${propertyId}/reservations/${reservationId}/due-in-room-assignment/candidates`');
  expect(app).toContain('cache: "no-store"');
  expect(app).toContain('gcTime: 0');
  expect(app).toContain('refetchOnMount: "always"');
  expect(app).toContain('`/api/v1/properties/${propertyId}/reservations/${reservationId}/due-in-room-assignment`');
  expect(app).toContain('expectedReservationStatus: "due_in"');
  expect(app).toContain('expectedSegmentStatus: "booked"');
  expect(app).toContain('expectedSellableUnitId: null');
  expect(app).toContain('I confirm assigning Room {selectedRoom?.spaceCode ?? "…"} to this named arrival.');
  expect(app).toContain('disabled={!canAssignRoom}');
  expect(app).toContain('await assignDueInRoom(');
  expect(app).toContain('await Promise.all([detail.refetch(), readiness.refetch(), roomCandidates.refetch()]);');
  expect(app).toContain('reservation.segments[0]?.sellableUnitId === null');
  expect(app).not.toContain('selectedRoom = roomCandidates.data?.candidates[0]');
});

test("opens a dashboard arrival in the embedded Overwatch journey instead of a legacy check-in page", () => {
  const reviewStart = app.indexOf("const review = (stay: Stay)");
  const reviewEnd = app.indexOf("\n  const openMetric", reviewStart);
  const review = app.slice(reviewStart, reviewEnd);
  expect(review).toContain("setAssistant(true)");
  expect(review).toContain('eyebrow: "LIVE ARRIVAL FLOW"');
  expect(review).toContain("checkInReservationId: stay.reservationId");
  expect(review).not.toContain("workbench=check-in");
});

test("uses the reservation board's primary guest display name", () => {
  const boardReservation = {
    reservationId: "r-board",
    confirmationNo: "ARR-BOARD",
    primaryGuestDisplayName: "Board Guest Example",
  } as const;
  expect(
    reservationVoiceAction("open Board Guest", [boardReservation]),
  ).toEqual({ reservation: boardReservation, workbench: null });
});

test("refuses ambiguous or unrecognised reservation requests", () => {
  expect(reservationVoiceAction("open arrival", arrivals)).toBeNull();
  expect(reservationVoiceAction("check-in", arrivals)).toBeNull();
});
