import { expect, test } from "bun:test";
import { reservationViewFromSearch, reservationViewHref, reservationGroupFromSearch } from "../frontend/yellow/src/reservation-navigation";

const id = "00000000-0000-4000-8000-000000000004";
test("reservation selector destinations preserve path/hash and clear incompatible drafts and group links", () => {
  expect(reservationViewHref("/p/property/reservations", `?view=groups&group=${id}&create=crs&from=2026-10-02&to=2026-10-04&adults=1&child_ages=&channel=direct&option_ref=old`, "#board", "list")).toBe("/p/property/reservations#board");
  const href = reservationViewHref("/p/property/reservations", "", "#board", "groups");
  expect(href).toBe("/p/property/reservations?view=groups#board");
  expect(reservationViewFromSearch("")).toBe("list");
  expect(reservationViewFromSearch("?view=groups")).toBe("groups");
  expect(reservationViewFromSearch("?view=unknown")).toBe("list");
});
test("group identifiers alone never select Group and ambiguous links remain explicitly invalid", () => {
  expect(reservationViewFromSearch(`?group=${id}`)).toBe("list");
  expect(reservationGroupFromSearch(`?group=${id}`)).toBeNull();
  expect(reservationGroupFromSearch(`?view=groups&group=${id}`)).toBe(id);
  expect(reservationGroupFromSearch(`?view=groups&group=${id}&group=${id}`)).toBeNull();
  expect(reservationGroupFromSearch("?view=groups&group=bad")).toBeNull();
  expect(reservationGroupFromSearch("?view=groups")).toBeUndefined();
});
