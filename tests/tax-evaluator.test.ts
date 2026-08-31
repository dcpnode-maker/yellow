import { describe, expect, test } from "bun:test";

import {
  evaluateTaxJurisdiction,
  type TaxEvaluationInput,
  type TaxEvaluationResult,
} from "../src/contexts/tax-fiscal";

const MAX_SIGNED_BIGINT = 9_223_372_036_854_775_807n;

type TaxContent = TaxEvaluationInput["content"];
type TaxLine = TaxEvaluationInput["lines"][number];

function content(
  taxes: readonly Record<string, unknown>[],
  overrides: Readonly<Record<string, unknown>> = {},
): TaxContent {
  return {
    country: "US",
    price_display: "tax_exclusive",
    rounding: "line",
    taxes,
    ...overrides,
  };
}

function line(overrides: Partial<TaxLine> = {}): TaxLine {
  return {
    lineId: "line-1",
    revenueGroup: "room_revenue",
    amountMinor: 10_000n,
    nights: 1,
    personNights: 1,
    roomNightAmountsMinor: [10_000n],
    ...overrides,
  };
}

function evaluate(
  taxContent: TaxContent,
  lines: readonly TaxLine[],
  jurisdictionKey = "test-tax",
): TaxEvaluationResult {
  return evaluateTaxJurisdiction({ jurisdictionKey, content: taxContent, lines });
}

function isDeeplyFrozen(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== "object") {
    return true;
  }
  if (seen.has(value)) {
    return true;
  }
  seen.add(value);
  if (!Object.isFrozen(value)) {
    return false;
  }
  return Object.values(value).every((child) => isDeeplyFrozen(child, seen));
}

const INDIA_GST = content(
  [
    {
      code: "GST_ROOM",
      name: "GST on accommodation",
      mode: "slab_percent",
      slab_basis: "transaction_value",
      applies_to: ["room_revenue"],
      slabs: [
        { upto_minor: 750_000, rate: 0.05, itc_eligible: false },
        { upto_minor: null, rate: 0.18, itc_eligible: true },
      ],
    },
  ],
  { country: "IN", price_display: "tax_exclusive", rounding: "document" },
);

describe("Order 237 pure rules-driven tax evaluator", () => {
  test("evaluates an attributable exclusive percent tax without taxing other groups", () => {
    const result = evaluate(
      content([
        {
          code: "ROOM_TAX",
          name: "Room tax",
          mode: "percent",
          rate: 0.05,
          applies_to: ["room_revenue"],
        },
      ]),
      [
        line(),
        line({
          lineId: "fnb-1",
          revenueGroup: "fnb_revenue",
          amountMinor: 5_000n,
          roomNightAmountsMinor: [],
        }),
      ],
    );

    expect(result).toMatchObject({
      schemaVersion: 1,
      jurisdictionKey: "test-tax",
      country: "US",
      priceDisplay: "tax_exclusive",
      rounding: "line",
      inputTotalMinor: 15_000n,
      baseTotalMinor: 15_000n,
      taxTotalMinor: 500n,
      grandTotalMinor: 15_500n,
    });
    expect(result.taxes.map(({ code, name, taxMinor }) => ({ code, name, taxMinor }))).toEqual([
      { code: "ROOM_TAX", name: "Room tax", taxMinor: 500n },
    ]);
  });

  test("evaluates fixed-per-night and fixed-per-person-night quantities exactly", () => {
    const result = evaluate(
      content([
        {
          code: "NIGHT_FEE",
          name: "Night fee",
          mode: "fixed_per_night",
          amount_minor: 250,
          applies_to: ["room_revenue"],
        },
        {
          code: "PERSON_FEE",
          name: "Person-night fee",
          mode: "fixed_per_person_night",
          amount_minor: 175,
          applies_to: ["room_revenue"],
        },
      ]),
      [
        line({
          amountMinor: 10_000n,
          nights: 3,
          personNights: 6,
          roomNightAmountsMinor: [3_000n, 3_000n, 4_000n],
        }),
      ],
    );

    expect(result.taxes.map(({ code, taxMinor }) => ({ code, taxMinor }))).toEqual([
      { code: "NIGHT_FEE", taxMinor: 750n },
      { code: "PERSON_FEE", taxMinor: 1_050n },
    ]);
    expect(result).toMatchObject({
      inputTotalMinor: 10_000n,
      baseTotalMinor: 10_000n,
      taxTotalMinor: 1_800n,
      grandTotalMinor: 11_800n,
    });
  });

  test("selects exact India GST value bands at ₹0/1,000/1,001/7,500/7,501", () => {
    // Zero is not a valid charge line; use the smallest positive minor unit to
    // exercise the lower edge and prove the zero boundary is rejected.
    expect(() =>
      evaluate(
        INDIA_GST,
        [line({ lineId: "india-zero", amountMinor: 0n, roomNightAmountsMinor: [0n] })],
        "in-gst-lodging",
      ),
    ).toThrow("positive signed-range bigint minor-unit value");

    const amounts = [1n, 100_000n, 100_100n, 750_000n, 750_100n] as const;
    const result = evaluate(
      INDIA_GST,
      amounts.map((amountMinor, index) =>
        line({
          lineId: `india-boundary-${index + 1}`,
          amountMinor,
          roomNightAmountsMinor: [amountMinor],
        }),
      ),
      "in-gst-lodging",
    );

    expect(result).toMatchObject({
      jurisdictionKey: "in-gst-lodging",
      country: "IN",
      priceDisplay: "tax_exclusive",
      rounding: "document",
      inputTotalMinor: 1_700_201n,
      baseTotalMinor: 1_700_201n,
      taxTotalMinor: 182_523n,
      grandTotalMinor: 1_882_724n,
    });
    expect(result.taxes.map(({ code, taxMinor }) => ({ code, taxMinor }))).toEqual([
      { code: "GST_ROOM", taxMinor: 182_523n },
    ]);
  });

  test("selects India GST per room-night and never from a stay average", () => {
    const result = evaluate(
      INDIA_GST,
      [
        line({
          lineId: "mixed-stay",
          amountMinor: 850_100n,
          nights: 2,
          personNights: 2,
          roomNightAmountsMinor: [100_000n, 750_100n],
        }),
      ],
      "in-gst-lodging",
    );

    expect(result.taxes[0]?.taxMinor).toBe(140_018n);
    expect(result.taxTotalMinor).toBe(140_018n);
    expect(result.grandTotalMinor).toBe(990_118n);
    expect(result.taxTotalMinor).not.toBe(42_505n);
    expect(result.taxes[0]?.components).toEqual([
      {
        lineId: "mixed-stay",
        revenueGroup: "room_revenue",
        baseMinor: 100_000n,
        taxMinor: null,
        rateBasisPoints: 500,
      },
      {
        lineId: "mixed-stay",
        revenueGroup: "room_revenue",
        baseMinor: 750_100n,
        taxMinor: null,
        rateBasisPoints: 1_800,
      },
    ]);
  });

  test.each([
    ["AE", "ae-vat", 0.05, 10_500n, 10_000n, 500n],
    ["SA", "sa-vat", 0.15, 11_500n, 10_000n, 1_500n],
  ] as const)(
    "extracts %s inclusive VAT without increasing gross",
    (country, jurisdictionKey, rate, grossMinor, baseMinor, taxMinor) => {
      const result = evaluate(
        content(
          [
            {
              code: "VAT",
              name: "Value Added Tax",
              mode: "percent",
              rate,
              applies_to: ["room_revenue"],
            },
          ],
          { country, price_display: "tax_inclusive", rounding: "line" },
        ),
        [line({ amountMinor: grossMinor, roomNightAmountsMinor: [grossMinor] })],
        jurisdictionKey,
      );

      expect(result).toMatchObject({
        jurisdictionKey,
        country,
        priceDisplay: "tax_inclusive",
        inputTotalMinor: grossMinor,
        baseTotalMinor: baseMinor,
        taxTotalMinor: taxMinor,
        grandTotalMinor: grossMinor,
      });
      expect(result.taxes[0]?.taxMinor).toBe(taxMinor);
    },
  );

  test("keeps inclusive arithmetic exact at the largest safe basis-point rate", () => {
    const result = evaluate(
      content(
        [
          {
            code: "MAX_RATE",
            name: "Maximum exact basis-point rate",
            mode: "percent",
            rate: 900_719_925_474.0991,
            applies_to: ["room_revenue"],
          },
        ],
        { price_display: "tax_inclusive" },
      ),
      [
        line({
          amountMinor: MAX_SIGNED_BIGINT,
          roomNightAmountsMinor: [MAX_SIGNED_BIGINT],
        }),
      ],
    );

    expect(result).toMatchObject({
      inputTotalMinor: MAX_SIGNED_BIGINT,
      baseTotalMinor: 10_240_000n,
      taxTotalMinor: 9_223_372_036_844_535_807n,
      grandTotalMinor: MAX_SIGNED_BIGINT,
    });
    expect(result.taxes[0]?.taxMinor).toBe(9_223_372_036_844_535_807n);
  });

  test("makes exact half-up line and document rounding diverge only at the selected scope", () => {
    const taxes = [
      {
        code: "TIE_TAX",
        name: "Tie tax",
        mode: "percent",
        rate: 0.1,
        applies_to: ["room_revenue"],
      },
    ];
    const lines = [
      line({ lineId: "tie-1", amountMinor: 105n, roomNightAmountsMinor: [105n] }),
      line({ lineId: "tie-2", amountMinor: 105n, roomNightAmountsMinor: [105n] }),
    ];

    const lineResult = evaluate(content(taxes, { rounding: "line" }), lines);
    const documentResult = evaluate(content(taxes, { rounding: "document" }), lines);

    expect(lineResult).toMatchObject({ taxTotalMinor: 22n, grandTotalMinor: 232n });
    expect(documentResult).toMatchObject({ taxTotalMinor: 21n, grandTotalMinor: 231n });
    expect(lineResult.taxes[0]?.taxMinor).toBe(22n);
    expect(documentResult.taxes[0]?.taxMinor).toBe(21n);
  });

  test("compounds only on earlier named tax codes and preserves configured order", () => {
    const result = evaluate(
      content([
        {
          code: "A",
          name: "Primary tax",
          mode: "percent",
          rate: 0.1,
          applies_to: ["room_revenue"],
        },
        {
          code: "B",
          name: "Compound tax",
          mode: "percent",
          rate: 0.05,
          applies_to: ["room_revenue"],
          compound_on: ["A"],
        },
      ]),
      [line()],
    );

    expect(result.taxes.map(({ code, taxMinor }) => ({ code, taxMinor }))).toEqual([
      { code: "A", taxMinor: 1_000n },
      { code: "B", taxMinor: 550n },
    ]);
    expect(result).toMatchObject({ taxTotalMinor: 1_550n, grandTotalMinor: 11_550n });
  });

  test("does not let an earlier line-rounded zero cross a compounded slab boundary", () => {
    const result = evaluate(
      content([
        {
          code: "FRACTIONAL",
          name: "Rounds to zero",
          mode: "percent",
          rate: 0.0001,
          applies_to: ["room_revenue"],
        },
        {
          code: "BOUNDARY",
          name: "Compounded boundary tax",
          mode: "slab_percent",
          slab_basis: "transaction_value",
          applies_to: ["room_revenue"],
          compound_on: ["FRACTIONAL"],
          slabs: [
            { upto_minor: 1, rate: 0 },
            { upto_minor: null, rate: 1 },
          ],
        },
      ]),
      [line({ amountMinor: 1n, roomNightAmountsMinor: [1n] })],
    );

    expect(result.taxes.map(({ code, taxMinor }) => ({ code, taxMinor }))).toEqual([
      { code: "FRACTIONAL", taxMinor: 0n },
      { code: "BOUNDARY", taxMinor: 0n },
    ]);
    expect(result.taxes[1]?.components[0]).toMatchObject({
      baseMinor: 1n,
      taxMinor: 0n,
      rateBasisPoints: 0,
    });
    expect(result).toMatchObject({ taxTotalMinor: 0n, grandTotalMinor: 1n });
  });

  test("rejects missing, duplicate, forward, self and cyclic compound references atomically", () => {
    const percent = (code: string, compound_on: readonly string[] = []) => ({
      code,
      name: code,
      mode: "percent",
      rate: 0.1,
      applies_to: ["room_revenue"],
      compound_on,
    });
    const hostileTaxes = [
      [percent("A", ["MISSING"])],
      [percent("A"), percent("A")],
      [percent("B", ["A"]), percent("A")],
      [percent("A", ["A"])],
      [percent("A", ["B"]), percent("B", ["A"])],
    ];

    for (const taxes of hostileTaxes) {
      expect(() => evaluate(content(taxes), [line()])).toThrow();
    }
    const { compound_on: _unused, ...uncompounded } = percent("A");
    expect(() =>
      evaluate(content([uncompounded, percent("B", ["A"])], { rounding: "document" }), [line()]),
    ).toThrow("document rounding with compounding requires an explicit allocation policy");
  });

  test("fails closed on malformed rules, imprecise rates and hostile input shape", () => {
    const validTax = {
      code: "VAT",
      name: "VAT",
      mode: "percent",
      rate: 0.05,
      applies_to: ["room_revenue"],
    };
    const hostileContents: readonly TaxContent[] = [
      content([validTax], { unexpected: true }),
      content([{ ...validTax, mode: "mystery" }]),
      content([{ ...validTax, rate: 0.000_01 }]),
      content([
        {
          code: "SLAB",
          name: "Slab",
          mode: "slab_percent",
          slab_basis: "transaction_value",
          applies_to: ["room_revenue"],
          slabs: [{ upto_minor: 100_000, rate: 0.05 }],
        },
      ]),
      content([
        {
          code: "SLAB",
          name: "Slab",
          mode: "slab_percent",
          slab_basis: "transaction_value",
          applies_to: ["room_revenue"],
          slabs: [
            { upto_minor: 200_000, rate: 0.05 },
            { upto_minor: 100_000, rate: 0.1 },
            { upto_minor: null, rate: 0.2 },
          ],
        },
      ]),
    ];

    for (const taxContent of hostileContents) {
      expect(() => evaluate(taxContent, [line()])).toThrow();
    }

    expect(() =>
      evaluateTaxJurisdiction({
        jurisdictionKey: "hostile-line",
        content: content([validTax]),
        lines: [
          {
            ...line(),
            nights: 1.5,
          },
        ],
      } as TaxEvaluationInput),
    ).toThrow();
    expect(() =>
      evaluateTaxJurisdiction({
        jurisdictionKey: "hostile-line",
        content: content([validTax]),
        lines: [
          {
            ...line(),
            unexpected: true,
          },
        ],
      } as TaxEvaluationInput),
    ).toThrow();
  });

  test("fails closed on oversized configured arrays and compounding chains", () => {
    const oversizedGroups = [
      "room_revenue",
      ...Array.from({ length: 256 }, (_, index) => `revenue_group_${index}`),
    ];
    expect(() =>
      evaluate(
        content([
          {
            code: "TOO_MANY_GROUPS",
            name: "Too many groups",
            mode: "percent",
            rate: 0,
            applies_to: oversizedGroups,
          },
        ]),
        [line()],
      ),
    ).toThrow();

    const oversizedChain = Array.from({ length: 257 }, (_, index) => ({
      code: `CHAIN_${index}`,
      name: `Chain ${index}`,
      mode: "percent",
      rate: 0,
      applies_to: ["room_revenue"],
      compound_on: index === 0 ? [] : [`CHAIN_${index - 1}`],
    }));
    expect(() => evaluate(content(oversizedChain), [line()])).toThrow();
  });

  test("rejects unsafe input and exact arithmetic overflow", () => {
    const taxContent = content([
      {
        code: "FULL_TAX",
        name: "Full tax",
        mode: "percent",
        rate: 1,
        applies_to: ["room_revenue"],
      },
    ]);

    expect(() =>
      evaluate(taxContent, [
        line({
          amountMinor: MAX_SIGNED_BIGINT + 1n,
          roomNightAmountsMinor: [MAX_SIGNED_BIGINT + 1n],
        }),
      ]),
    ).toThrow();
    expect(() =>
      evaluate(taxContent, [
        line({
          amountMinor: MAX_SIGNED_BIGINT,
          roomNightAmountsMinor: [MAX_SIGNED_BIGINT],
        }),
      ]),
    ).toThrow();
  });

  test("deeply freezes the complete attributable result", () => {
    const result = evaluate(
      content([
        {
          code: "VAT",
          name: "VAT",
          mode: "percent",
          rate: 0.05,
          applies_to: ["room_revenue"],
        },
      ]),
      [line()],
    );

    expect(result.taxes[0]?.components.length).toBeGreaterThan(0);
    expect(isDeeplyFrozen(result)).toBe(true);
  });
});
