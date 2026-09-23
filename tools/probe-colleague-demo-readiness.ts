type Check = Readonly<{
  name: string;
  ok: boolean;
  evidence: string;
}>;

type RequestOptions = Readonly<{
  method?: "GET" | "POST";
  body?: unknown;
  token?: string;
}>;

const baseUrl = (process.env.YELLOW_PUBLIC_DEMO_URL ?? "https://lying-jones-terminal-church.trycloudflare.com").replace(/\/+$/u, "");
const preferredPropertyId = process.env.YELLOW_DEMO_PROPERTY_ID ?? "6081b544-22a1-534f-a86d-bb1ae0519e14";

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers();
  headers.set("accept", "application/json");
  if (options.body !== undefined) headers.set("content-type", "application/json");
  if (options.token) headers.set("authorization", `Bearer ${options.token}`);
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}: ${text.slice(0, 240)}`);
  }
  return (text.length ? JSON.parse(text) : null) as T;
}

async function demoToken(): Promise<string> {
  const body = asRecord(await requestJson("/api/v1/auth/demo:enter", { method: "POST" }));
  const token = body.accessToken;
  if (typeof token !== "string" || token.length < 20) {
    throw new Error("Synthetic demo login did not return an access token.");
  }
  return token;
}

async function lane(propertyId: string, status: "due_in" | "due_out" | "in_house", token: string): Promise<readonly Record<string, unknown>[]> {
  const body = asRecord(await requestJson(`/api/v1/properties/${encodeURIComponent(propertyId)}/reservation-board?${new URLSearchParams({ status, limit: "100" })}`, { token }));
  return asArray(body.reservations).map(asRecord);
}

function firstId(rows: readonly Record<string, unknown>[]): string {
  const id = rows.find((row) => typeof row.reservationId === "string")?.reservationId;
  if (!id) throw new Error("No reservation id was available for the readiness proof.");
  return id;
}

async function firstOpenFolioId(
  propertyId: string,
  token: string,
  rows: readonly Record<string, unknown>[],
): Promise<string | null> {
  for (const row of rows) {
    if (typeof row.reservationId !== "string") continue;
    const detail = asRecord(await requestJson(`/api/v1/properties/${encodeURIComponent(propertyId)}/reservations/${encodeURIComponent(row.reservationId)}`, { token }));
    const reservation = asRecord(detail.reservation);
    const folio = asArray(reservation.folios)
      .map(asRecord)
      .find((item) => item.status === "open" && typeof item.folioId === "string");
    if (typeof folio?.folioId === "string") return folio.folioId;
  }
  return null;
}

async function main() {
  const token = await demoToken();
  const propertiesBody = asRecord(await requestJson("/api/v1/me/properties", { token }));
  const properties = asArray(propertiesBody.properties).map(asRecord);
  const property = properties.find((item) => item.id === preferredPropertyId) ?? properties[0];
  const propertyId = typeof property?.id === "string" ? property.id : "";
  if (!propertyId) throw new Error("No demo property was returned.");

  const checks: Check[] = [];
  checks.push({
    name: "property selection",
    ok: Boolean(propertyId),
    evidence: `${property.name ?? propertyId}`,
  });

  const performance = asRecord(await requestJson(`/api/v1/properties/${encodeURIComponent(propertyId)}/operating-performance`, { token }));
  const today = asRecord(performance.today);
  checks.push({
    name: "today operating performance",
    ok: typeof today.roomNights === "number" && typeof today.roomsAvailable === "number" && typeof today.roomRevenueMinor === "string",
    evidence: `roomNights=${today.roomNights ?? "missing"}, roomsAvailable=${today.roomsAvailable ?? "missing"}, revenue=${today.roomRevenueMinor ?? "missing"}`,
  });

  const contribution = asRecord(await requestJson(`/api/v1/properties/${encodeURIComponent(propertyId)}/commercial-contribution`, { token }));
  const contributionTotal = asRecord(contribution.total);
  const contributionGroups = asArray(contribution.groups).map(asRecord);
  const contributionSegments = contributionGroups.flatMap((group) => asArray(group.segments).map(asRecord));
  const contributionSources = contributionSegments.flatMap((segment) => asArray(segment.sources).map(asRecord));
  const hasMappedMsg = contributionGroups.some((group) => asRecord(group.marketSegmentGroup).reason === null);
  const hasMappedMs = contributionSegments.some((segment) => asRecord(segment.marketSegment).reason === null);
  const hasMappedSource = contributionSources.some((source) => asRecord(source.source).reason === null);
  checks.push({
    name: "commercial contribution hierarchy",
    ok: contribution.provenance === "stats_daily_commercial_taxonomy" &&
      typeof contributionTotal.roomNights === "number" &&
      typeof contributionTotal.roomRevenueMinor === "string" &&
      contributionGroups.length > 0 &&
      contributionSegments.length > 0 &&
      contributionSources.length > 0 &&
      hasMappedMsg &&
      hasMappedMs &&
      hasMappedSource,
    evidence: `groups=${contributionGroups.length}, segments=${contributionSegments.length}, sources=${contributionSources.length}, roomNights=${contributionTotal.roomNights ?? "missing"}, revenue=${contributionTotal.roomRevenueMinor ?? "missing"}`,
  });

  const arrivals = await lane(propertyId, "due_in", token);
  const departures = await lane(propertyId, "due_out", token);
  const inHouse = await lane(propertyId, "in_house", token);
  checks.push({ name: "arrival lane", ok: arrivals.length > 0, evidence: `${arrivals.length} due-in reservation(s)` });
  checks.push({ name: "departure lane", ok: departures.length > 0, evidence: `${departures.length} due-out reservation(s)` });
  checks.push({ name: "in-house lane", ok: inHouse.length > 0, evidence: `${inHouse.length} in-house reservation(s)` });
  const commercialRows = [...arrivals, ...departures, ...inHouse];
  const channels = new Set(commercialRows.map((row) => row.channelCode).filter((value): value is string => typeof value === "string" && value.length > 0));
  const markets = new Set(commercialRows.map((row) => row.marketCode).filter((value): value is string => typeof value === "string" && value.length > 0));
  const sources = new Set(commercialRows.map((row) => row.sourceCode).filter((value): value is string => typeof value === "string" && value.length > 0));
  checks.push({
    name: "reservation commercial contribution fields",
    ok: commercialRows.length > 0 && channels.size > 0 && markets.size > 0 && sources.size > 0,
    evidence: `channels=${[...channels].sort().join("/") || "missing"}, markets=${[...markets].sort().join("/") || "missing"}, sources=${[...sources].sort().join("/") || "missing"}`,
  });

  const guestSearch = asRecord(await requestJson(`/api/v1/properties/${encodeURIComponent(propertyId)}/parties:search`, {
    method: "POST",
    token,
    body: { query: "Sara Al Harbi", limit: 10 },
  }));
  const guestProfiles = asArray(guestSearch.profiles).map(asRecord);
  let guestHistoryEvidence = "no matching profile with reservation history";
  let guestHistoryReady = false;
  for (const profile of guestProfiles) {
    if (typeof profile.partyId !== "string" || typeof profile.displayName !== "string") continue;
    const history = asRecord(await requestJson(
      `/api/v1/properties/${encodeURIComponent(propertyId)}/reservation-board?${new URLSearchParams({ partyId: profile.partyId, limit: "20" })}`,
      { token },
    ));
    const stays = asArray(history.reservations).map(asRecord);
    const linkedStay = stays.find((stay) =>
      typeof stay.reservationId === "string" &&
      typeof stay.confirmationNo === "string" &&
      stay.primaryGuestDisplayName === profile.displayName,
    );
    if (linkedStay) {
      guestHistoryReady = true;
      guestHistoryEvidence = `${profile.displayName}, stays=${stays.length}, latest=${linkedStay.confirmationNo}`;
      break;
    }
  }
  checks.push({
    name: "guest profile stay history",
    ok: guestHistoryReady,
    evidence: guestHistoryEvidence,
  });

  const groupBlocks = asRecord(await requestJson(`/api/v1/properties/${encodeURIComponent(propertyId)}/group-blocks`, { token }));
  const groups = asArray(groupBlocks.groups).map(asRecord);
  const blockedRooms = groups.reduce((sum, group) => sum + (typeof group.blockedRooms === "number" ? group.blockedRooms : 0), 0);
  const pickedUpRooms = groups.reduce((sum, group) => sum + (typeof group.pickedUpRooms === "number" ? group.pickedUpRooms : 0), 0);
  const roomingList = groups.flatMap((group) => asArray(group.roomingList).map(asRecord));
  const roomingListNights = roomingList.reduce((sum, row) => sum + (typeof row.pickedUpNights === "number" ? row.pickedUpNights : 0), 0);
  const roomingListHasReservationLinks = roomingList.some((row) =>
    typeof row.reservationId === "string" &&
    typeof row.confirmationNo === "string" &&
    typeof row.primaryGuestDisplayName === "string" &&
    typeof row.stayFrom === "string" &&
    typeof row.stayTo === "string",
  );
  checks.push({
    name: "group block workbench",
    ok: groups.length >= 2 && blockedRooms > 0 && pickedUpRooms > 0 && roomingList.length >= 2 && roomingListHasReservationLinks && roomingListNights === pickedUpRooms,
    evidence: `${groups.length} group block(s), blocked=${blockedRooms}, pickedUp=${pickedUpRooms}, roomingList=${roomingList.length}, nights=${roomingListNights}`,
  });

  const arrivalId = firstId(arrivals);
  const departureId = firstId(departures);
  const inHouseId = firstId(inHouse);
  const arrivalDetail = asRecord(await requestJson(`/api/v1/properties/${encodeURIComponent(propertyId)}/reservations/${encodeURIComponent(arrivalId)}`, { token }));
  const arrivalReservation = asRecord(arrivalDetail.reservation);
  checks.push({
    name: "reservation detail",
    ok: arrivalReservation.reservationId === arrivalId && typeof arrivalReservation.confirmationNo === "string",
    evidence: `${arrivalReservation.confirmationNo ?? arrivalId}`,
  });

  const arrivalReadiness = asRecord(await requestJson(`/api/v1/properties/${encodeURIComponent(propertyId)}/reservations/${encodeURIComponent(arrivalId)}/check-in/readiness`, { token }));
  checks.push({
    name: "arrival readiness",
    ok: typeof arrivalReadiness.canCheckIn === "boolean" && Array.isArray(arrivalReadiness.blockers),
    evidence: `canCheckIn=${arrivalReadiness.canCheckIn}, blockers=${asArray(arrivalReadiness.blockers).length}`,
  });

  let readyArrivalEvidence = "no due-in reservation is ready for check-in";
  let blockedArrivalEvidence = "no due-in reservation exposes blockers";
  let readyArrivalOk = false;
  let blockedArrivalOk = false;
  for (const row of arrivals) {
    if (typeof row.reservationId !== "string") continue;
    const readiness = asRecord(await requestJson(`/api/v1/properties/${encodeURIComponent(propertyId)}/reservations/${encodeURIComponent(row.reservationId)}/check-in/readiness`, { token }));
    const blockers = asArray(readiness.blockers);
    const confirmationNo = typeof row.confirmationNo === "string" ? row.confirmationNo : row.reservationId;
    if (readiness.canCheckIn === true && blockers.length === 0 &&
        typeof readiness.assignedSpaceId === "string" &&
        typeof readiness.segmentId === "string" &&
        typeof readiness.primaryFolioId === "string") {
      readyArrivalOk = true;
      readyArrivalEvidence = `${confirmationNo}, roomCondition=${readiness.roomCondition ?? "missing"}, folio=${readiness.primaryFolioId}`;
    }
    if (readiness.canCheckIn === false && blockers.length > 0) {
      blockedArrivalOk = true;
      blockedArrivalEvidence = `${confirmationNo}, blockers=${blockers.join("/")}`;
    }
  }
  checks.push({
    name: "ready check-in fixture",
    ok: readyArrivalOk,
    evidence: readyArrivalEvidence,
  });
  checks.push({
    name: "blocked check-in guardrail",
    ok: blockedArrivalOk,
    evidence: blockedArrivalEvidence,
  });

  const checkoutReadiness = asRecord(await requestJson(`/api/v1/properties/${encodeURIComponent(propertyId)}/reservations/${encodeURIComponent(departureId)}/checkout-readiness`, { token }));
  checks.push({
    name: "checkout readiness",
    ok: typeof checkoutReadiness.ready === "boolean" && Array.isArray(checkoutReadiness.blockers),
    evidence: `ready=${checkoutReadiness.ready}, blockers=${asArray(checkoutReadiness.blockers).length}`,
  });

  let readyCheckoutEvidence = "no due-out reservation is ready for checkout";
  let blockedCheckoutEvidence = "no due-out reservation exposes blockers";
  let readyCheckoutOk = false;
  let blockedCheckoutOk = false;
  for (const row of departures) {
    if (typeof row.reservationId !== "string") continue;
    const readiness = asRecord(await requestJson(`/api/v1/properties/${encodeURIComponent(propertyId)}/reservations/${encodeURIComponent(row.reservationId)}/checkout-readiness`, { token }));
    const blockers = asArray(readiness.blockers);
    const folios = asArray(readiness.folios).map(asRecord);
    const room = asRecord(readiness.room);
    const occupancy = asRecord(readiness.occupancy);
    const confirmationNo = typeof row.confirmationNo === "string" ? row.confirmationNo : row.reservationId;
    if (readiness.ready === true &&
        blockers.length === 0 &&
        typeof room.spaceCode === "string" &&
        typeof room.spaceId === "string" &&
        typeof occupancy.occupancyId === "string" &&
        folios.length > 0 &&
        folios.every((folio) =>
          (folio.status === "settled" || folio.status === "closed") &&
          folio.balanceMinor === "0" &&
          typeof folio.folioId === "string")) {
      readyCheckoutOk = true;
      readyCheckoutEvidence = `${confirmationNo}, room=${room.spaceCode}, folios=${folios.map((folio) => `${folio.folioNo ?? folio.folioId}:${folio.status}`).join("/")}`;
    }
    if (readiness.ready === false && blockers.length > 0) {
      blockedCheckoutOk = true;
      blockedCheckoutEvidence = `${confirmationNo}, blockers=${blockers.join("/")}`;
    }
  }
  checks.push({
    name: "ready checkout fixture",
    ok: readyCheckoutOk,
    evidence: readyCheckoutEvidence,
  });
  checks.push({
    name: "blocked checkout guardrail",
    ok: blockedCheckoutOk,
    evidence: blockedCheckoutEvidence,
  });

  const housekeepingConditions = asRecord(await requestJson(`/api/v1/properties/${encodeURIComponent(propertyId)}/housekeeping/conditions?limit=100`, { token }));
  const rooms = asArray(housekeepingConditions.rooms);
  checks.push({ name: "housekeeping conditions", ok: rooms.length > 0, evidence: `${rooms.length} room condition record(s)` });

  const cashier = asRecord(await requestJson(`/api/v1/properties/${encodeURIComponent(propertyId)}/cashier-sessions`, { token }));
  checks.push({
    name: "cashier session surface",
    ok: Object.keys(cashier).length > 0,
    evidence: Object.keys(cashier).sort().slice(0, 8).join(", "),
  });

  const businessDayEntry = asRecord(await requestJson(`/api/v1/properties/${encodeURIComponent(propertyId)}/business-days/close-workbench`, { token }));
  const businessDate = typeof businessDayEntry.businessDate === "string" ? businessDayEntry.businessDate : "";
  const businessDayWorkbench = businessDate
    ? asRecord(await requestJson(`/api/v1/properties/${encodeURIComponent(propertyId)}/business-days/${encodeURIComponent(businessDate)}/close-workbench`, { token }))
    : {};
  const readiness = asRecord(businessDayWorkbench.readiness);
  const openDays = asArray(businessDayWorkbench.openDays);
  const readinessReasons = asArray(readiness.reasons).map(asRecord);
  checks.push({
    name: "business-day close readiness",
    ok: /^\d{4}-\d{2}-\d{2}$/.test(businessDate) &&
      businessDayWorkbench.businessDate === businessDate &&
      typeof readiness.ready === "boolean" &&
      openDays.length > 0 &&
      readinessReasons.every((reason) => typeof reason.code === "string" && typeof reason.source === "string"),
    evidence: `businessDate=${businessDate || "missing"}, ready=${readiness.ready ?? "missing"}, openDays=${openDays.length}, blockers=${readinessReasons.length}`,
  });

  const folioId = await firstOpenFolioId(propertyId, token, [...departures, ...inHouse]);
  if (typeof folioId !== "string") {
    checks.push({ name: "folio statement", ok: false, evidence: "no due-out or in-house reservation exposes an open primary folio" });
  } else {
    const statement = asRecord(await requestJson(`/api/v1/properties/${encodeURIComponent(propertyId)}/folios/${encodeURIComponent(folioId)}/statement`, { token }));
    const statementRows = asArray(statement.rows);
    const chargeOptions = asArray(statement.chargeOptions);
    const chargeAvailability = asRecord(statement.chargeAvailability);
    checks.push({
      name: "folio statement",
      ok: Object.keys(asRecord(statement.folio)).length > 0 && statementRows.length > 0 && chargeOptions.length > 0 && chargeAvailability.allowed === true,
      evidence: `${statementRows.length} row(s), ${chargeOptions.length} posting option(s), postingAllowed=${chargeAvailability.allowed ?? "missing"}`,
    });
  }

  const overwatch = asRecord(await requestJson("/api/v1/jarvis:ask", {
    method: "POST",
    token,
    body: { message: "Overwatch, prepare check in for today's arrivals", history: [] },
  }));
  checks.push({
    name: "Overwatch confirmation-gated assistant",
    ok: typeof overwatch.answer === "string" && overwatch.navigation === "today" && overwatch.focus === "due_in" && overwatch.requiresConfirmation === true,
    evidence: `navigation=${overwatch.navigation ?? "missing"}, focus=${overwatch.focus ?? "missing"}, requiresConfirmation=${overwatch.requiresConfirmation ?? "missing"}`,
  });

  const geminiOverwatch = asRecord(await requestJson("/api/v1/jarvis:ask", {
    method: "POST",
    token,
    body: { message: "Hello Overwatch", history: [] },
  }));
  checks.push({
    name: "Overwatch Gemini provider evidence",
    ok: typeof geminiOverwatch.answer === "string" &&
      geminiOverwatch.provider === "gemini" &&
      geminiOverwatch.model === "gemini-flash-lite-latest",
    evidence: `provider=${geminiOverwatch.provider ?? "missing"}, model=${geminiOverwatch.model ?? "missing"}`,
  });

  const hindiOverwatch = asRecord(await requestJson("/api/v1/jarvis:ask", {
    method: "POST",
    token,
    body: { message: "आरक्षण रद्द करें", history: [] },
  }));
  checks.push({
    name: "Overwatch Hindi confirmation-gated cancellation",
    ok: typeof hindiOverwatch.answer === "string" &&
      hindiOverwatch.navigation === "reservations" &&
      hindiOverwatch.reservationOperation === "cancel" &&
      hindiOverwatch.requiresConfirmation === true,
    evidence: `navigation=${hindiOverwatch.navigation ?? "missing"}, operation=${hindiOverwatch.reservationOperation ?? "missing"}, requiresConfirmation=${hindiOverwatch.requiresConfirmation ?? "missing"}`,
  });

  console.table(checks.map((check) => ({ check: check.name, ok: check.ok, evidence: check.evidence })));
  const failed = checks.filter((check) => !check.ok);
  if (failed.length > 0) {
    throw new Error(`Colleague demo readiness failed: ${failed.map((check) => check.name).join(", ")}`);
  }
}

await main();
