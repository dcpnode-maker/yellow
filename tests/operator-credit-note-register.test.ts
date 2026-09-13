import { expect, test } from "bun:test";
// @ts-expect-error Browser asset deliberately ships without declarations.
import { creditNoteRegisterEnvelope, creditNoteRegisterFilters } from "../src/http/operator/invoices.js";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const row = (n: number, date = "2044-09-07") => ({ documentId: id(n), originalDocumentId: id(n + 20), docNo: `C/2044/${n}`,
  originalDocNo: `I/2044/${n}`, businessDate: date, propertyNode: id(2), currency: "INR", totalMinor: "11800", sha256: "a".repeat(64) });

test("Order469 parses an exact credit-note register page", () => {
  const allDates = creditNoteRegisterFilters({ issuedFrom: "2044-01-01", issuedBefore: "2045-01-01" });
  const parsed = creditNoteRegisterEnvelope({ items: [row(6)], nextCursor: "YWZ0ZXI" }, id(2), allDates);
  expect(parsed?.items[0]).toEqual(row(6));
  expect(Object.isFrozen(parsed)).toBe(true); expect(Object.isFrozen(parsed?.items)).toBe(true);
  for (const invalid of [
    { items: [{ ...row(6), propertyNode: id(9) }], nextCursor: null },
    { items: [{ ...row(6), documentId: row(6).originalDocumentId }], nextCursor: null },
    { items: [{ ...row(6), totalMinor: "0" }], nextCursor: null },
    { items: [{ ...row(6), totalMinor: "-1" }], nextCursor: null },
    { items: [{ ...row(6), totalMinor: "011800" }], nextCursor: null },
    { items: [{ ...row(6), currency: "USD" }], nextCursor: null },
    { items: [{ ...row(6), extra: true }], nextCursor: null },
    { items: [row(6, "2044-09-07"), row(7, "2044-09-08")], nextCursor: null },
    { items: [row(6), row(6)], nextCursor: null },
    { items: [row(6)], nextCursor: "not valid!" },
  ]) expect(creditNoteRegisterEnvelope(invalid, id(2), allDates)).toBeNull();
  let reads = 0; const hostile = { ...row(6) };
  Object.defineProperty(hostile, "docNo", { enumerable: true, get: () => { reads += 1; return "C/2044/6"; } });
  expect(creditNoteRegisterEnvelope({ items: [hostile], nextCursor: null }, id(2), allDates)).toBeNull(); expect(reads).toBe(0);
  const wrapper = { nextCursor: null };
  Object.defineProperty(wrapper, "items", { enumerable: true, get: () => { reads += 1; return [row(6)]; } });
  expect(creditNoteRegisterEnvelope(wrapper, id(2), allDates)).toBeNull(); expect(reads).toBe(0);
});

test("Order469 snapshots only exact bounded register filters", () => {
  const filters = creditNoteRegisterFilters({ issuedFrom: "2044-04-01", issuedBefore: "2045-04-01", docNo: "C/2044/6" });
  expect(filters).toEqual({ issuedFrom: "2044-04-01", issuedBefore: "2045-04-01", docNo: "C/2044/6" });
  expect(Object.isFrozen(filters)).toBe(true);
  expect(creditNoteRegisterFilters({ issuedFrom: "2044-01-01", issuedBefore: "2045-01-01" })).not.toBeNull();
  for (const invalid of [
    undefined,
    {},
    { issuedFrom: "2044-09-08", issuedBefore: "2044-09-08" },
    { issuedFrom: "2044-09-08", issuedBefore: "2044-09-07" },
    { issuedFrom: "2044-01-01", issuedBefore: "2045-01-02" },
    { issuedFrom: "2044-02-30", issuedBefore: "2044-03-02" },
    { issuedFrom: "2044-09-07", issuedBefore: "2044-09-08", docNo: "" },
    { issuedFrom: "2044-09-07", issuedBefore: "2044-09-08", docNo: "C 2044 6" },
    { issuedFrom: "2044-09-07", issuedBefore: "2044-09-08", tenantId: id(1) },
  ]) expect(creditNoteRegisterFilters(invalid)).toBeNull();
  let reads = 0;
  const accessor = { issuedFrom: "2044-09-07", issuedBefore: "2044-09-08" };
  Object.defineProperty(accessor, "docNo", { enumerable: true, get: () => { reads += 1; return "C/2044/6"; } });
  expect(creditNoteRegisterFilters(accessor)).toBeNull();
  expect(reads).toBe(0);
});

test("Order469 binds strict filters, identity and descending canonical positions", () => {
  const filters = creditNoteRegisterFilters({ issuedFrom: "2044-04-01", issuedBefore: "2045-04-01" });
  expect(creditNoteRegisterEnvelope({ items: [row(7, "2044-09-08"), row(6, "2044-09-07")], nextCursor: null }, id(2), filters)).not.toBeNull();
  expect(creditNoteRegisterEnvelope({ items: [row(7), row(6)], nextCursor: null }, id(2), filters)).not.toBeNull();
  expect(creditNoteRegisterEnvelope({ items: [row(6), row(7)], nextCursor: null }, id(2), filters)).toBeNull();
  expect(creditNoteRegisterEnvelope({ items: [row(6)], nextCursor: null }, id(2), undefined)).toBeNull();
  expect(creditNoteRegisterEnvelope({ items: [row(6)], nextCursor: null }, id(2), {})).toBeNull();
  const hostileFilters = { issuedFrom: "2044-04-01", issuedBefore: "2045-04-01" };
  Object.defineProperty(hostileFilters, "docNo", { enumerable: true, get: () => "C/2044/6" });
  expect(creditNoteRegisterEnvelope({ items: [row(6)], nextCursor: null }, id(2), hostileFilters)).toBeNull();
  expect(creditNoteRegisterEnvelope({ items: [row(6)], nextCursor: null }, "00000000-0000-0000-7000-000000000002", filters)).toBeNull();
  expect(creditNoteRegisterEnvelope({ items: [{ ...row(6), documentId: "00000000-0000-0000-8000-000000000006" }], nextCursor: null }, id(2), filters)).toBeNull();
  expect(creditNoteRegisterEnvelope({ items: [{ ...row(6), originalDocumentId: "00000000-0000-4000-7000-000000000026" }], nextCursor: null }, id(2), filters)).toBeNull();
  expect(creditNoteRegisterEnvelope({ items: [{ ...row(6), sha256: "A".repeat(64) }], nextCursor: null }, id(2), filters)).toBeNull();
});

test("Order469 binds detached filters and accepts descending terminal or empty pages", () => {
  const range = creditNoteRegisterFilters({ issuedFrom: "2044-09-07", issuedBefore: "2044-09-08" });
  const allDates = creditNoteRegisterFilters({ issuedFrom: "2044-01-01", issuedBefore: "2045-01-01" });
  expect(creditNoteRegisterEnvelope({ items: [], nextCursor: null }, id(2),
    range)).toEqual({ items: [], nextCursor: null });
  expect(creditNoteRegisterEnvelope({ items: [row(6, "2044-09-06")], nextCursor: null }, id(2),
    range)).toBeNull();
  expect(creditNoteRegisterEnvelope({ items: [row(6, "2044-09-08")], nextCursor: null }, id(2), range)).toBeNull();
  expect(creditNoteRegisterEnvelope({ items: [row(6)], nextCursor: null }, id(2),
    creditNoteRegisterFilters({ issuedFrom: "2044-01-01", issuedBefore: "2045-01-01", docNo: "C/2044/7" }))).toBeNull();
  expect(creditNoteRegisterEnvelope({ items: [{ ...row(6), totalMinor: "9223372036854775807" }], nextCursor: null }, id(2), allDates)).not.toBeNull();
  expect(creditNoteRegisterEnvelope({ items: [{ ...row(6), totalMinor: "9223372036854775808" }], nextCursor: null }, id(2), allDates)).toBeNull();
  const twentyFive = Array.from({ length: 25 }, (_, index) => row(100 - index, "2044-09-07"));
  expect(creditNoteRegisterEnvelope({ items: twentyFive, nextCursor: null }, id(2), allDates)).not.toBeNull();
  expect(creditNoteRegisterEnvelope({ items: [...twentyFive, row(1)], nextCursor: null }, id(2), allDates)).toBeNull();
});
