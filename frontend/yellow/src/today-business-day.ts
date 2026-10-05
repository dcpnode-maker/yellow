import {
  collectReservationJourneyPages,
  type ReservationJourneyStage,
  type ReservationBoardPage,
} from "./reservation-board";

/** Minimal stable journey fields needed here; callers may preserve their full Stay shape. */
export type TodayStay = Readonly<{
  reservationId: string;
  confirmationNo: string;
  status: string;
  stayFrom?: string;
  stayTo?: string;
}>;
export type TodayMovementStage = Extract<ReservationJourneyStage, "arrival" | "departure" | "in_house">;
export type TodayMovementLane<TStay extends TodayStay = TodayStay> = Readonly<{ reservations: readonly TStay[]; businessDate: string }>;
export type TodayMovementSnapshot<TStay extends TodayStay = TodayStay> = Readonly<{
  arrival: TodayMovementLane<TStay>;
  departure: TodayMovementLane<TStay>;
  in_house: TodayMovementLane<TStay>;
  businessDate: string;
}>;
export type PastDueKind = "arrival" | "departure";
export type PastDueLane<TStay extends TodayStay = TodayStay> = Readonly<{ reservations: readonly TStay[]; businessDate: string; kind: PastDueKind }>;

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type LoaderOptions = Readonly<{ propertyId: string; getToken: () => Promise<string>; fetcher?: Fetcher }>;
const PROPERTY_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const BUSINESS_DATE = /^\d{4}-\d{2}-\d{2}$/;
const OFFSET_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const canonicalDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !BUSINESS_DATE.test(value)) return false;
  const instant = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(instant.getTime()) && instant.toISOString().slice(0, 10) === value;
};

function assertStayPage<TStay extends TodayStay>(value: unknown): asserts value is ReservationBoardPage<TStay> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("The reservation journey page is malformed.");
  const page = value as Record<string, unknown>;
  if (!Array.isArray(page.reservations) || !canonicalDate(page.businessDate) ||
      !("nextCursor" in page && (page.nextCursor === null || typeof page.nextCursor === "string")) ||
      page.reservations.some((row) => typeof row !== "object" || row === null || Array.isArray(row) ||
        typeof (row as Record<string, unknown>).reservationId !== "string" ||
        !PROPERTY_UUID.test((row as Record<string, unknown>).reservationId as string) ||
        typeof (row as Record<string, unknown>).confirmationNo !== "string" ||
        typeof (row as Record<string, unknown>).status !== "string")) {
    throw new Error("The reservation journey page is malformed or missing its server business date.");
  }
}

function makeReader<TStay extends TodayStay>(options: LoaderOptions) {
  if (!PROPERTY_UUID.test(options.propertyId)) throw new TypeError("A canonical property identifier is required.");
  const fetcher = options.fetcher ?? fetch;
  return async (queryInput: Readonly<{ stage?: TodayMovementStage; status?: "due_in" | "due_out" }>) => {
    let token: string;
    try { token = await options.getToken(); }
    catch { throw new Error("Your session could not be verified for Today reservations."); }
    if (typeof token !== "string" || token.length === 0) throw new Error("Your session could not be verified for Today reservations.");
    return collectReservationJourneyPages<TStay>(async (after) => {
      const query = new URLSearchParams({ limit: "100" });
      if (queryInput.stage) query.set("stage", queryInput.stage);
      if (queryInput.status) query.set("status", queryInput.status);
      if (after !== null) query.set("after", after);
      let response: Response;
      try {
        response = await fetcher(`/api/v1/properties/${options.propertyId}/reservation-board?${query}`, {
          headers: { authorization: `Bearer ${token}` }, cache: "no-store",
        });
      } catch {
        throw new Error("Today reservation data could not be loaded. Retry to refresh the property business date.");
      }
      if (response.status !== 200) throw new Error("Today reservation data could not be loaded. Retry to refresh the property business date.");
      let body: unknown;
      try { body = await response.json() as unknown; }
      catch { throw new Error("The reservation journey response was incomplete. No Today count is available."); }
      assertStayPage<TStay>(body);
      return body;
    });
  };
}

/** Load all three canonical Today phases; fail closed if their server date differs. */
export function createTodayBusinessDayLoader<TStay extends TodayStay = TodayStay>(options: LoaderOptions) {
  const read = makeReader<TStay>(options);
  return Object.freeze({
    async loadToday(): Promise<TodayMovementSnapshot<TStay>> {
      const [arrival, departure, inHouse] = await Promise.all([
        read({ stage: "arrival" }), read({ stage: "departure" }), read({ stage: "in_house" }),
      ]);
      if (arrival.businessDate !== departure.businessDate || arrival.businessDate !== inHouse.businessDate) {
        throw new Error("The property business date changed while Today was loading. Refresh all movement lanes.");
      }
      return Object.freeze({
        arrival: Object.freeze({ reservations: arrival.reservations, businessDate: arrival.businessDate }),
        departure: Object.freeze({ reservations: departure.reservations, businessDate: departure.businessDate }),
        in_house: Object.freeze({ reservations: inHouse.reservations, businessDate: inHouse.businessDate }),
        businessDate: arrival.businessDate,
      });
    },
    /** Called only after the user opens the Past-due view; this is not part of loadToday(). */
    async loadPastDue(kind: PastDueKind, timezone: string): Promise<PastDueLane<TStay>> {
      const status = kind === "arrival" ? "due_in" : "due_out";
      const lane = await read({ status });
      const reservations = filterPastDueMovement(lane.reservations, lane.businessDate, timezone, kind);
      return Object.freeze({ reservations, businessDate: lane.businessDate, kind });
    },
  });
}

function localStayDate(value: string, timezone: string): string {
  if (!OFFSET_INSTANT.test(value)) throw new Error("A stay boundary must include an explicit UTC offset to determine overdue membership.");
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) throw new Error("A stay boundary is invalid; overdue membership cannot be determined.");
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(instant);
  const field = (type: "year" | "month" | "day") => parts.find((part) => part.type === type)?.value ?? "";
  return `${field("year")}-${field("month")}-${field("day")}`;
}

/** Past-due means the stay boundary is before the server's currently open business date. */
export function filterPastDueMovement<TStay extends TodayStay>(
  reservations: readonly TStay[], businessDate: string, timezone: string, kind: PastDueKind,
): readonly TStay[] {
  if (!canonicalDate(businessDate)) throw new Error("The server business date is missing or invalid.");
  try { new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date(0)); }
  catch { throw new Error("The property timezone is unavailable; past-due membership cannot be determined."); }
  const boundary = kind === "arrival" ? "stayFrom" : "stayTo";
  const expectedStatus = kind === "arrival" ? "due_in" : "due_out";
  return Object.freeze(reservations.filter((stay) => {
    if (stay.status !== expectedStatus) return false;
    const instant = stay[boundary];
    if (typeof instant !== "string") throw new Error("A stay boundary is missing; overdue membership cannot be determined.");
    return localStayDate(instant, timezone) < businessDate;
  }));
}
