import { expect, test } from "bun:test";

import { LAUNCH_EXTENSIONS } from "../scripts/seed";
import { uuidV5 } from "../scripts/lib/uuid-v5";

const fixture = new URL("./seed_fixture.sql", import.meta.url);

const KEY = "in-gst-lodging";
const PREDECESSOR_FROM = "2022-07-17T18:30:00.000000Z";
const CUTOVER = "2025-09-21T18:30:00.000000Z";
const PREDECESSOR_ID = "a806f516-fed6-5768-b310-94aa03286adb";
const SUCCESSOR_ID = "0b21daf2-ea6e-5568-9c21-69e4d4424574";

const predecessorRoomSlabs = [
  { upto_minor: 750000, rate: 0.12, itc_eligible: true },
  { upto_minor: null, rate: 0.18, itc_eligible: true },
] as const;
const successorRoomSlabs = [
  { upto_minor: 750000, rate: 0.05, itc_eligible: false },
  { upto_minor: null, rate: 0.18, itc_eligible: true },
] as const;

const content = (slabs: readonly unknown[]) => ({
  country: "IN",
  price_display: "tax_exclusive",
  rounding: "document",
  taxes: [
    {
      code: "GST_ROOM",
      name: "GST on accommodation",
      mode: "slab_percent",
      slab_basis: "transaction_value",
      applies_to: ["room_revenue"],
      slabs,
    },
    {
      code: "GST_FNB",
      name: "GST on F&B (restaurant in hotel)",
      mode: "percent",
      rate: 0.05,
      applies_to: ["fnb_revenue"],
    },
  ],
});

const expected = [
  {
    id: PREDECESSOR_ID,
    type: "tax_jurisdiction",
    key: KEY,
    version: 1,
    effectiveFromInstant: PREDECESSOR_FROM,
    effectiveToInstant: CUTOVER,
    status: "retired",
    content: content(predecessorRoomSlabs),
  },
  {
    id: SUCCESSOR_ID,
    type: "tax_jurisdiction",
    key: KEY,
    version: 2,
    effectiveFromInstant: CUTOVER,
    effectiveToInstant: null,
    status: "active",
    content: content(successorRoomSlabs),
  },
] as const;

type LaunchHistoryEntry = {
  readonly id?: unknown;
  readonly type: unknown;
  readonly key: unknown;
  readonly version?: unknown;
  readonly effectiveFromInstant?: unknown;
  readonly effectiveToInstant?: unknown;
  readonly status?: unknown;
  readonly content: unknown;
};

function launchRow(entry: LaunchHistoryEntry): Record<string, unknown> {
  return {
    type: entry.type,
    key: entry.key,
    version: entry.version,
    effectiveFromInstant: entry.effectiveFromInstant,
    effectiveToInstant: entry.effectiveToInstant,
    status: entry.status,
    content: entry.content,
  };
}

type FixtureRow = Record<string, unknown>;

/*
 * Read the actual SQL rows instead of checking a handful of independent
 * substrings. This keeps the fixture and the launch catalogue tied to the same
 * complete, independently-authored contract.
 */
function fixtureRows(source: string): FixtureRow[] {
  const rowPattern = /\(\s*'(?<id>[0-9a-f-]{36})'\s*,\s*NULL\s*,\s*'tax_jurisdiction'\s*,\s*'in-gst-lodging'\s*,\s*(?<version>[12])\s*,\s*tstzrange\(\s*'(?<from>[^']+)'\s*,\s*(?<to>NULL|'[^']+')\s*,\s*'\[\)'\s*\)\s*,\s*'(?<content>\{[\s\S]*?\})'\s*(?:::jsonb)?\s*,\s*'(?<status>active|retired)'\s*\)/g;
  const rows: FixtureRow[] = [];

  for (const match of source.matchAll(rowPattern)) {
    const groups = match.groups;
    if (!groups) throw new Error("India GST fixture row has no capture groups");
    rows.push({
      id: groups.id!,
      type: "tax_jurisdiction",
      key: KEY,
      version: Number(groups.version),
      effectiveFromInstant: groups.from!,
      effectiveToInstant: groups.to === "NULL" ? null : groups.to!.slice(1, -1),
      status: groups.status!,
      content: JSON.parse(groups.content!),
    } as FixtureRow);
  }
  return rows;
}

function roomTax(value: unknown): { slabs: readonly unknown[] } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("expected tax-jurisdiction content object");
  }
  const taxes = (value as { taxes?: unknown }).taxes;
  if (!Array.isArray(taxes)) throw new Error("expected tax-jurisdiction taxes array");
  const room = taxes.find((tax) =>
    tax && typeof tax === "object" && !Array.isArray(tax) && (tax as { code?: unknown }).code === "GST_ROOM");
  if (!room || typeof room !== "object" || Array.isArray(room) || !Array.isArray((room as { slabs?: unknown }).slabs)) {
    throw new Error("expected exactly one GST_ROOM slab definition");
  }
  return room as { slabs: readonly unknown[] };
}

test("Order 305 permanently binds exact launch history and invariant SQL fixture", async () => {
  const launchEntries = (LAUNCH_EXTENSIONS as readonly LaunchHistoryEntry[])
    .filter((entry) => entry.type === "tax_jurisdiction" && entry.key === KEY)
  for (const entry of launchEntries) {
    if (entry.id !== undefined) {
      expect(entry.id).toBe(entry.version === 1 ? PREDECESSOR_ID : SUCCESSOR_ID);
    }
  }
  const launchHistory = launchEntries.map(launchRow);
  expect(launchHistory).toHaveLength(2);
  const expectedLaunchHistory = expected.map(({ id: _id, ...row }) => row);
  expect(launchHistory as unknown).toEqual(expectedLaunchHistory);

  const fixtureHistory = fixtureRows(await Bun.file(fixture).text());
  expect(fixtureHistory).toHaveLength(2);
  expect(fixtureHistory as unknown).toEqual(expected);
  expect(fixtureHistory.map((row) => row.id)).toEqual([PREDECESSOR_ID, SUCCESSOR_ID]);
  expect(await uuidV5("6ba7b811-9dad-11d1-80b4-00c04fd430c8", `https://yellow.local/extension/tax_jurisdiction/${KEY}/1`)).toBe(PREDECESSOR_ID);
  expect(await uuidV5("6ba7b811-9dad-11d1-80b4-00c04fd430c8", `https://yellow.local/extension/tax_jurisdiction/${KEY}/2`)).toBe(SUCCESSOR_ID);

  expect(launchHistory.filter((row) => row.status === "active" && row.version === 2)).toHaveLength(1);
  expect(launchHistory.filter((row) => row.status === "retired" && row.version === 1)).toHaveLength(1);
  expect(launchHistory[0]!.effectiveToInstant).toBe(launchHistory[1]!.effectiveFromInstant);
  expect(launchHistory[0]!.effectiveFromInstant).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
  expect(launchHistory[0]!.effectiveToInstant).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
  expect(launchHistory[1]!.effectiveFromInstant).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);

  for (const [row, slabs] of [[launchHistory[0]!, predecessorRoomSlabs], [launchHistory[1]!, successorRoomSlabs] ] as [Record<string, unknown>, readonly unknown[]][]) {
    expect(roomTax(row.content).slabs).toEqual(slabs);
    expect(roomTax(row.content).slabs.some((slab) =>
      slab && typeof slab === "object" && !Array.isArray(slab) && (slab as { upto_minor?: unknown }).upto_minor === 100000,
    )).toBe(false);
  }

  for (const row of launchHistory) {
    const value = row.content as { taxes: Array<{ code: string; name: string; mode: string; rate?: number; applies_to?: string[] }> };
    expect(value.taxes.filter((tax) => tax.code === "GST_FNB")).toEqual([{
      code: "GST_FNB",
      name: "GST on F&B (restaurant in hotel)",
      mode: "percent",
      rate: 0.05,
      applies_to: ["fnb_revenue"],
    }]);
  }
});
