import { createHash } from "node:crypto";
import { describe, expect, test } from "bun:test";

const migration44 = new URL(
  "../migrations/0044_governed_positive_tax_posting.sql",
  import.meta.url,
);
const migration46 = new URL(
  "../migrations/0046_positive_tax_posting_ordinal_repair.sql",
  import.meta.url,
);

describe("Order 270 intentional red: historical migration0044 lineage", () => {
  test("repository0044 is the exact historically applied byte stream", async () => {
    const bytes = new Uint8Array(await Bun.file(migration44).arrayBuffer());
    const text = new TextDecoder().decode(bytes);
    expect(bytes.byteLength).toBe(34_363);
    expect(text.split("\n").length - 1).toBe(878);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      "5ea338b18aabb3cb2c5a4613c00ebf57806be881b956b13df1e2c95262cce55c",
    );
  });

  test("the later posting-ordinal repair exists only as forward migration0046", async () => {
    expect(await Bun.file(migration46).exists()).toBe(true);
    const source = await Bun.file(migration46).text();
    expect(source.match(
      /ON requested\.ordinality = canonical_taxes\.posting_ordinal/g,
    )).toHaveLength(2);
    expect(source).toMatch(/CREATE OR REPLACE FUNCTION public\.record_positive_tax_journal_binding/);
  });
});
