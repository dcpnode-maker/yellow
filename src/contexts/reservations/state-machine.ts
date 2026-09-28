export const RESERVATION_STATUSES = Object.freeze([
  "quote",
  "reserved",
  "waitlist",
  "due_in",
  "in_house",
  "due_out",
  "checked_out",
  "cancelled",
  "no_show",
] as const);

export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export interface ReservationTransition {
  readonly from: ReservationStatus;
  readonly to: ReservationStatus;
  readonly guard: string;
  readonly event: string;
}

function transition(
  from: ReservationStatus,
  to: ReservationStatus,
  guard: string,
  event: string,
): Readonly<ReservationTransition> {
  return Object.freeze({ from, to, guard, event });
}

export const RESERVATION_TRANSITIONS = Object.freeze([
  transition("quote", "reserved", "availability_and_guarantee_confirmed", "reservation.confirmed"),
  transition("reserved", "due_in", "arrival_business_date_reached", "reservation.due_in"),
  transition("reserved", "cancelled", "cancellation_policy_or_approval", "reservation.cancelled"),
  transition("due_in", "cancelled", "cancellation_policy_or_approval", "reservation.cancelled"),
  transition("due_in", "in_house", "check_in_requirements_satisfied", "reservation.checked_in"),
  transition("due_in", "no_show", "arrival_day_roll_completed", "reservation.no_show"),
  transition("in_house", "due_out", "departure_business_date_reached", "reservation.due_out"),
  transition("in_house", "checked_out", "settlement_or_ar_transfer_completed", "reservation.checked_out"),
  transition("due_out", "checked_out", "settlement_or_ar_transfer_completed", "reservation.checked_out"),
  transition("cancelled", "reserved", "availability_recheck_passed", "reservation.reinstated"),
  transition("no_show", "reserved", "availability_recheck_passed", "reservation.reinstated"),
]);

export function findReservationTransition(
  from: ReservationStatus,
  to: ReservationStatus,
): Readonly<ReservationTransition> | undefined {
  return RESERVATION_TRANSITIONS.find(
    (candidate) => candidate.from === from && candidate.to === to,
  );
}

