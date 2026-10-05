import { expect, test } from "bun:test";
import {
  createTodayBusinessDayLoader, filterPastDueMovement,
  type TodayMovementStage,
} from "../frontend/yellow/src/today-business-day";

const property = "6081b544-22a1-534f-a86d-bb1ae0519e14";
const ids = [
  "00000000-0000-0000-0000-000000000001",
  "00000000-0000-0000-0000-000000000002",
  "00000000-0000-0000-0000-000000000003",
  "00000000-0000-0000-0000-000000000004",
];
type FixtureStay = Readonly<{ reservationId: string; confirmationNo: string; status: string; stayFrom?: string; stayTo?: string; operationalState?: string }>;
const row = (id: string, status: string, stayFrom: string, stayTo: string) => ({
  reservationId: id, confirmationNo: `Y-${id.slice(-2)}`, status, stayFrom, stayTo,
});
const todayArrival = row(ids[0]!, "reserved", "2026-09-24T18:30:00Z", "2026-09-26T05:30:00Z");
const alreadyCheckedIn = { ...row(ids[1]!, "in_house", "2026-09-23T18:30:00Z", "2026-09-25T05:30:00Z"), operationalState: "checked_in_today" };
const todayDeparture = row(ids[2]!, "due_out", "2026-09-22T18:30:00Z", "2026-09-24T18:30:00Z");
const overdue = row(ids[3]!, "due_in", "2026-09-22T18:29:59Z", "2026-09-25T05:30:00Z");
const response = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const page = (reservations: readonly unknown[], businessDate = "2026-09-24", nextCursor: string | null = null) => ({ reservations, businessDate, nextCursor });

test("loads the three canonical journey stages and preserves checked-in-today membership", async () => {
  const calls: Array<{ url: URL; init?: RequestInit }> = [];
  const data: Record<TodayMovementStage, readonly unknown[]> = {
    arrival: [todayArrival, alreadyCheckedIn], departure: [todayDeparture], in_house: [alreadyCheckedIn],
  };
  const loader = createTodayBusinessDayLoader<FixtureStay>({ propertyId: property, getToken: async () => "fixture-token", fetcher: async (input, init) => {
    const url = new URL(String(input), "https://yellow.test"); calls.push({ url, init });
    const stage = url.searchParams.get("stage") as TodayMovementStage;
    return response(200, page(data[stage] ?? []));
  } });
  const result = await loader.loadToday();
  expect(result.businessDate).toBe("2026-09-24");
  expect(result.arrival.reservations.map(({ reservationId }) => reservationId)).toEqual([ids[0]!, ids[1]!]);
  expect(result.arrival.reservations[1]?.operationalState).toBe("checked_in_today");
  expect(result.departure.reservations.map(({ reservationId }) => reservationId)).toEqual([ids[2]!]);
  expect(result.in_house.reservations).toHaveLength(1);
  expect(calls.map(({ url }) => url.searchParams.get("stage")).sort()).toEqual(["arrival", "departure", "in_house"]);
  expect(calls.every(({ url }) => url.searchParams.get("status") === null && url.searchParams.get("limit") === "100")).toBe(true);
  expect(calls.every(({ init }) => (init?.headers as Record<string, string>).authorization === "Bearer fixture-token")).toBe(true);
});

test("checks all three stage dates agree and fails visibly if a day changes between stage reads", async () => {
  let index = 0;
  const loader = createTodayBusinessDayLoader({ propertyId: property, getToken: async () => "token", fetcher: async () => {
    index += 1;
    return response(200, page([], index === 3 ? "2026-09-25" : "2026-09-24"));
  } });
  await expect(loader.loadToday()).rejects.toThrow("business date changed");
});

test("fails closed for missing, malformed, or changed business dates and bounded cursors", async () => {
  const missing = createTodayBusinessDayLoader({ propertyId: property, getToken: async () => "token", fetcher: async () => response(200, { reservations: [], nextCursor: null }) });
  await expect(missing.loadToday()).rejects.toThrow("business date");
  const missingCursor = createTodayBusinessDayLoader({ propertyId: property, getToken: async () => "token", fetcher: async () => response(200, { reservations: [], businessDate: "2026-09-24" }) });
  await expect(missingCursor.loadToday()).rejects.toThrow("journey page is malformed");
  const invalid = createTodayBusinessDayLoader({ propertyId: property, getToken: async () => "token", fetcher: async () => response(200, page([], "2026-02-31")) });
  await expect(invalid.loadToday()).rejects.toThrow();
  const cursorChanged = createTodayBusinessDayLoader({ propertyId: property, getToken: async () => "token", fetcher: async (input) => {
    const url = new URL(String(input), "https://yellow.test");
    return response(200, page([], url.searchParams.has("after") ? "2026-09-25" : "2026-09-24", url.searchParams.has("after") ? null : "second"));
  } });
  await expect(cursorChanged.loadToday()).rejects.toThrow("business day changed while loading");
  let reads = 0;
  const tooMany = createTodayBusinessDayLoader({ propertyId: property, getToken: async () => "token", fetcher: async () => {
    reads += 1; return response(200, page([], "2026-09-24", `cursor-${reads}`));
  } });
  await expect(tooMany.loadToday()).rejects.toThrow("safe page limit");
  expect(reads).toBe(150); // Three stages each stop at the existing 50-page limit.
  const badId = () => createTodayBusinessDayLoader({ propertyId: "not-property", getToken: async () => "token" });
  expect(badId).toThrow("canonical property identifier");
});

test("past-due reads are separate on-demand status requests and return only older property-local dates", async () => {
  const calls: URL[] = [];
  const loader = createTodayBusinessDayLoader({ propertyId: property, getToken: async () => "token", fetcher: async (input) => {
    const url = new URL(String(input), "https://yellow.test"); calls.push(url);
    const status = url.searchParams.get("status");
    const reservations = status === "due_in" ? [overdue, todayArrival] : [todayDeparture];
    return response(200, page(reservations));
  } });
  const today = await loader.loadToday();
  expect(calls).toHaveLength(3);
  expect(calls.every((url) => url.searchParams.has("stage"))).toBe(true);
  const pastArrivals = await loader.loadPastDue("arrival", "Asia/Kolkata");
  expect(pastArrivals.businessDate).toBe(today.businessDate);
  expect(pastArrivals.reservations.map(({ reservationId }) => reservationId)).toEqual([ids[3]!]);
  expect(calls[3]?.searchParams.get("status")).toBe("due_in");
  expect(calls[3]?.searchParams.get("stage")).toBeNull();
  const pastDepartures = await loader.loadPastDue("departure", "Asia/Kolkata");
  expect(pastDepartures.reservations).toEqual([]);
  expect(calls[4]?.searchParams.get("status")).toBe("due_out");
});

test("past-due filter uses property-local stay boundary and server date, not browser date or travel time", () => {
  const arrivalRows = [
    overdue,
    row(ids[0]!, "due_in", "2026-09-23T18:30:00Z", "2026-09-26T05:30:00Z"), // exactly local midnight on 24th
    { ...todayArrival, arrivalTravel: { scheduledAt: "2026-09-20T00:00:00Z" } }, // travel is not the stay boundary
  ];
  expect(filterPastDueMovement(arrivalRows, "2026-09-24", "Asia/Kolkata", "arrival").map(({ reservationId }) => reservationId)).toEqual([ids[3]!]);
  const departureRows = [
    row(ids[0]!, "due_out", "2026-09-21T18:30:00Z", "2026-09-23T18:29:59Z"),
    row(ids[1]!, "due_out", "2026-09-21T18:30:00Z", "2026-09-23T18:30:00Z"), // exactly local midnight on 24th
  ];
  expect(filterPastDueMovement(departureRows, "2026-09-24", "Asia/Kolkata", "departure").map(({ reservationId }) => reservationId)).toEqual([ids[0]!]);
  expect(() => filterPastDueMovement([row(ids[0]!, "due_in", "bad-date", "2026-09-25T00:00:00Z")], "2026-09-24", "Asia/Kolkata", "arrival")).toThrow("explicit UTC offset");
  expect(() => filterPastDueMovement([overdue], "2026-09-24", "Not/A-Timezone", "arrival")).toThrow("timezone is unavailable");
  expect(() => filterPastDueMovement([overdue], "yesterday", "Asia/Kolkata", "arrival")).toThrow("business date is missing or invalid");
});
