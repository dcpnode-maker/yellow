import { expect, test } from "bun:test";

import { LAUNCH_EXTENSIONS } from "../scripts/seed";

type LaunchHistoryEntry = {
  readonly type: string;
  readonly key: string;
  readonly version?: unknown;
  readonly effectiveFromInstant?: unknown;
  readonly effectiveToInstant?: unknown;
  readonly status?: unknown;
  readonly content: unknown;
};

test("Order 305 intentional red: fresh launch truth carries exact retired-v1/active-v2 lodging history", () => {
  const history = (LAUNCH_EXTENSIONS as readonly LaunchHistoryEntry[])
    .filter((entry) => entry.type === "tax_jurisdiction" && entry.key === "in-gst-lodging")
    .map(({ version, effectiveFromInstant, effectiveToInstant, status }) => ({
      version,
      effectiveFromInstant,
      effectiveToInstant,
      status,
    }));

  expect(history).toEqual([
    {
      version: 1,
      effectiveFromInstant: "2022-07-17T18:30:00.000000Z",
      effectiveToInstant: "2025-09-21T18:30:00.000000Z",
      status: "retired",
    },
    {
      version: 2,
      effectiveFromInstant: "2025-09-21T18:30:00.000000Z",
      effectiveToInstant: null,
      status: "active",
    },
  ]);
});
