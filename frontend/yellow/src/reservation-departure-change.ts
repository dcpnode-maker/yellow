type ReservationSegmentLookup = Readonly<{
  reservationId: string;
  confirmationNo: string;
  segments: readonly Readonly<{
    segmentId: string;
    period: Readonly<{ from: string; to: string }>;
    actions: Readonly<{ canChangeDeparture: boolean; canMoveRoom?: boolean }>;
  }>[];
}>;

export type DepartureAttempt = Readonly<{
  reservationId: string;
  confirmationNo: string;
  segmentId: string;
  expectedPeriod: Readonly<{ from: string; to: string }>;
  newDeparture: string;
  key: string;
}>;

export function propertyLocalMinute(instant: string, timezone: string): string {
  const date = new Date(instant);
  if (!Number.isFinite(date.getTime())) throw new Error("The recorded departure time is invalid.");
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}`;
}

export function departureInstantFromLocal(value: string, timezone: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error("Choose a valid property-local departure date and time.");
  const [year, month, day, hour, minute] = [value.slice(0, 4), value.slice(5, 7), value.slice(8, 10), value.slice(11, 13), value.slice(14, 16)].map(Number);
  let instant = Date.UTC(year!, month! - 1, day!, hour!, minute!);
  const desired = instant;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const observed = propertyLocalMinute(new Date(instant).toISOString(), timezone);
    const [seenYear, seenMonth, seenDay, seenHour, seenMinute] = [observed.slice(0, 4), observed.slice(5, 7), observed.slice(8, 10), observed.slice(11, 13), observed.slice(14, 16)].map(Number);
    instant = desired - (Date.UTC(seenYear!, seenMonth! - 1, seenDay!, seenHour!, seenMinute!) - instant);
  }
  const iso = new Date(instant).toISOString();
  if (propertyLocalMinute(iso, timezone) !== value) throw new Error("This property-local time does not exist. Choose another departure time.");
  const chosen = Date.parse(iso);
  for (let offsetMinutes = -180; offsetMinutes <= 180; offsetMinutes += 15) {
    if (offsetMinutes !== 0 && propertyLocalMinute(new Date(chosen + offsetMinutes * 60_000).toISOString(), timezone) === value) {
      throw new Error("This property-local time occurs twice. Choose an unambiguous departure time.");
    }
  }
  return iso;
}

export function sameRecordedInstant(left: string, right: string): boolean {
  const parse = (value: string): bigint | null => {
    const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
    if (!match) return null;
    const milliseconds = Date.parse(value);
    if (!Number.isFinite(milliseconds)) return null;
    const fractionalMicroseconds = (match[2] ?? "").padEnd(6, "0");
    return BigInt(milliseconds) * 1000n + BigInt(fractionalMicroseconds.slice(3));
  };
  const a = parse(left);
  const b = parse(right);
  return a !== null && b !== null && a === b;
}

export function prepareDepartureAttempt(
  lookup: ReservationSegmentLookup,
  reservationId: string,
  confirmationNo: string,
  localValue: string,
  timezone: string,
  key: string,
): DepartureAttempt {
  if (lookup.reservationId !== reservationId || lookup.confirmationNo !== confirmationNo) {
    throw new Error("Stay segment history no longer matches this reservation. Refresh the stay.");
  }
  const latest = lookup.segments.at(-1);
  if (!latest?.actions.canChangeDeparture) throw new Error("Departure changes are not available for this stay.");
  const newDeparture = departureInstantFromLocal(localValue, timezone);
  if (sameRecordedInstant(newDeparture, latest.period.to)) throw new Error("Choose a different departure time.");
  if (Date.parse(newDeparture) <= Date.parse(latest.period.from)) throw new Error("Departure must follow the current arrival.");
  return Object.freeze({
    reservationId, confirmationNo, segmentId: latest.segmentId,
    expectedPeriod: Object.freeze({ from: latest.period.from, to: latest.period.to }),
    newDeparture, key,
  });
}

export function departureMatchesAttempt(
  lookup: ReservationSegmentLookup,
  attempt: DepartureAttempt,
): boolean {
  const latest = lookup.segments.at(-1);
  return lookup.reservationId === attempt.reservationId &&
    lookup.confirmationNo === attempt.confirmationNo &&
    latest?.segmentId === attempt.segmentId &&
    sameRecordedInstant(latest.period.from, attempt.expectedPeriod.from) &&
    sameRecordedInstant(latest.period.to, attempt.newDeparture);
}
