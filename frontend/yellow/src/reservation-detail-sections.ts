export const RESERVATION_DETAIL_SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "guests", label: "Guests & shares" },
  { id: "stay", label: "Stay & billing" },
  { id: "travel", label: "Alerts & travel" },
  { id: "history", label: "History" },
  { id: "actions", label: "Actions" },
] as const;

export type ReservationDetailSection = typeof RESERVATION_DETAIL_SECTIONS[number]["id"];

const returnStages = {
  pre_arrival: "Pre-arrival", arrival: "Arrival", in_house: "In house",
  departure: "Departure", post_departure: "Post departure", all: "All reservations",
} as const;

/** Only known local phase destinations; never accept an arbitrary return URL. */
export function reservationDetailReturn(propertyId: string, search: string) {
  const values = new URLSearchParams(search).getAll("returnStage");
  const stage = values.length === 1 ? values[0] : undefined;
  if (stage && Object.hasOwn(returnStages, stage)) return {
    href: `/p/${encodeURIComponent(propertyId)}/reservations?stage=${stage}`,
    label: returnStages[stage as keyof typeof returnStages],
  };
  return { href: `/p/${encodeURIComponent(propertyId)}/today`, label: "Today" };
}
