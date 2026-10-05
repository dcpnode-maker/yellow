import { describe, expect, test } from "bun:test";
import {
  initialFolioComparisonSelection,
  MAX_FOLIO_COMPARISON_PANES,
  reconcileFolioComparisonSelection,
  toggleFolioComparisonSelection,
  validateFolioComparisonStatement,
} from "../frontend/yellow/src/folio-window-comparison";
import {
  makeOrder691Statement,
  makeOrder691WindowFamily,
  ORDER691_RESERVATION_ONE,
  ORDER691_RESERVATION_TWO,
} from "./fixtures/order691/data";

describe("Order691 folio-window comparison guards", () => {
  test("keeps all server windows available while limiting selected panes to nine", () => {
    const family = makeOrder691WindowFamily(ORDER691_RESERVATION_ONE, 20);
    const selected = family.slice(0, MAX_FOLIO_COMPARISON_PANES).map((window) => window.folioId);
    expect(family).toHaveLength(20);
    expect(toggleFolioComparisonSelection(selected, family[9]!.folioId, family).reason).toBe("pane_limit");
    expect(reconcileFolioComparisonSelection(selected, family, family[19]!.folioId)).toEqual(selected);
    expect(initialFolioComparisonSelection(family, family[19]!.folioId)).toEqual([family[19]!.folioId]);
  });

  test("prunes removed windows and preserves remaining selections", () => {
    const family = makeOrder691WindowFamily(ORDER691_RESERVATION_ONE, 4);
    const nextFamily = family.slice(0, 3);
    expect(reconcileFolioComparisonSelection([family[1]!.folioId, family[3]!.folioId], nextFamily, null))
      .toEqual([family[1]!.folioId]);
    expect(toggleFolioComparisonSelection([family[1]!.folioId], family[1]!.folioId, family).reason).toBe("deselected");
  });

  test("validates exact reservation and folio identity before displaying a statement", () => {
    const family = makeOrder691WindowFamily(ORDER691_RESERVATION_ONE, 2);
    const statement = makeOrder691Statement(ORDER691_RESERVATION_ONE, family[1]!);
    expect(validateFolioComparisonStatement(statement, ORDER691_RESERVATION_ONE, family[1]!)).toBe(statement);
    expect(() => validateFolioComparisonStatement(statement, ORDER691_RESERVATION_TWO, family[1]!)).toThrow(/does not match/u);
    expect(() => validateFolioComparisonStatement({ ...statement, folio: { ...statement.folio, id: family[0]!.folioId } }, ORDER691_RESERVATION_ONE, family[1]!)).toThrow(/does not match/u);
  });

  test("rejects malformed money and currency locally rather than allowing render-time BigInt failure", () => {
    const family = makeOrder691WindowFamily(ORDER691_RESERVATION_ONE, 1);
    const statement = makeOrder691Statement(ORDER691_RESERVATION_ONE, family[0]!);
    expect(() => validateFolioComparisonStatement({ ...statement, balanceMinor: "1.25" }, ORDER691_RESERVATION_ONE, family[0]!)).toThrow(/does not match/u);
    expect(() => validateFolioComparisonStatement({ ...statement, folio: { ...statement.folio, currency: "US" } }, ORDER691_RESERVATION_ONE, family[0]!)).toThrow(/does not match/u);
    expect(() => validateFolioComparisonStatement({ ...statement, rows: [{ ...statement.rows[0]!, amountMinor: "NaN" }] }, ORDER691_RESERVATION_ONE, family[0]!)).toThrow(/does not match/u);
  });

  test("uses exact integer minor units in synthetic fixture values", () => {
    const window = makeOrder691WindowFamily(ORDER691_RESERVATION_ONE, 1)[0]!;
    const statement = makeOrder691Statement(ORDER691_RESERVATION_ONE, window);
    expect(BigInt(statement.balanceMinor)).toBeGreaterThan(BigInt(Number.MAX_SAFE_INTEGER));
    expect(statement.rows.map((row) => BigInt(row.amountMinor))).toEqual([12_445n, -2_500n]);
  });
});
