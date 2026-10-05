import { parsePositiveTaxAttributionSnapshot } from "./attribution";

const MAX_SIGNED_MINOR = 9_223_372_036_854_775_807n;
const AGGREGATE_GST_CODE = /^GST(?:_|$)/;

export type PositiveTaxPostingPlanBlocker =
  | "document_tax_allocation_required"
  | "india_place_of_supply_decomposition_required";

export interface PositiveTaxPostingPlanRevenueLineV1 {
  readonly lineId: "room";
  readonly revenueGroup: "room_revenue";
  readonly inputAmountMinor: string;
  readonly baseTotalMinor: string;
}

export interface PositiveTaxPostingPlanTaxLineageV1 {
  readonly index: string;
  readonly code: string;
  readonly name: string;
  readonly taxMinor: string;
}

export interface PositiveTaxPostingPlanGuestReceivableLineV1 {
  readonly index: "0";
  readonly role: "guest_receivable";
  readonly direction: "debit";
  readonly amountMinor: string;
}

export interface PositiveTaxPostingPlanRoomRevenueLineV1 {
  readonly index: "1";
  readonly role: "room_revenue";
  readonly direction: "credit";
  readonly lineId: "room";
  readonly revenueGroup: "room_revenue";
  readonly amountMinor: string;
}

export interface PositiveTaxPostingPlanTaxPayableLineV1 {
  readonly index: string;
  readonly role: "tax_payable";
  readonly direction: "credit";
  readonly taxIndex: string;
  readonly taxCode: string;
  readonly taxName: string;
  readonly amountMinor: string;
}

export type PositiveTaxPostingPlanLineV1 =
  | PositiveTaxPostingPlanGuestReceivableLineV1
  | PositiveTaxPostingPlanRoomRevenueLineV1
  | PositiveTaxPostingPlanTaxPayableLineV1;

export interface PositiveTaxPostingPlanV1 {
  readonly schemaVersion: 1;
  readonly quoteHash: string;
  readonly snapshotHash: string;
  readonly currency: string;
  readonly state: "route_ready" | "policy_blocked";
  readonly blockers: readonly PositiveTaxPostingPlanBlocker[];
  readonly revenueLine: PositiveTaxPostingPlanRevenueLineV1;
  readonly taxLineage: readonly PositiveTaxPostingPlanTaxLineageV1[];
  readonly lines: readonly PositiveTaxPostingPlanLineV1[];
  readonly balanceMinor: "0";
}

export class PositiveTaxPostingPlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PositiveTaxPostingPlanError";
  }
}

function positiveMinor(value: string, subject: string): bigint {
  const amount = BigInt(value);
  if (amount <= 0n || amount > MAX_SIGNED_MINOR) {
    throw new PositiveTaxPostingPlanError(`${subject} must be a positive signed-int64 amount`);
  }
  return amount;
}

function creditMinor(amount: bigint): string {
  return `-${amount.toString()}`;
}

export function derivePositiveTaxPostingPlan(snapshot: unknown): PositiveTaxPostingPlanV1 {
  const parsed = parsePositiveTaxAttributionSnapshot(snapshot);
  const grandTotal = positiveMinor(parsed.evaluation.grandTotalMinor, "grand total");
  const baseTotal = positiveMinor(parsed.evaluation.baseTotalMinor, "base total");

  const blockers: PositiveTaxPostingPlanBlocker[] = [];
  if (parsed.evaluation.rounding === "document") {
    blockers.push("document_tax_allocation_required");
  }
  if (parsed.evaluation.country === "IN" ||
      parsed.evaluation.taxes.some(({ code }) => AGGREGATE_GST_CODE.test(code))) {
    blockers.push("india_place_of_supply_decomposition_required");
  }

  const revenueLine: PositiveTaxPostingPlanRevenueLineV1 = Object.freeze({
    lineId: "room",
    revenueGroup: "room_revenue",
    inputAmountMinor: parsed.revenueLine.inputAmountMinor,
    baseTotalMinor: parsed.evaluation.baseTotalMinor,
  });
  const taxLineage: readonly PositiveTaxPostingPlanTaxLineageV1[] = Object.freeze(
    parsed.evaluation.taxes.map(({ index, code, name, taxMinor }) => Object.freeze({
      index,
      code,
      name,
      taxMinor,
    })),
  );

  const lines: PositiveTaxPostingPlanLineV1[] = [
    Object.freeze({
      index: "0",
      role: "guest_receivable",
      direction: "debit",
      amountMinor: grandTotal.toString(),
    }),
    Object.freeze({
      index: "1",
      role: "room_revenue",
      direction: "credit",
      lineId: "room",
      revenueGroup: "room_revenue",
      amountMinor: creditMinor(baseTotal),
    }),
  ];
  let balance = grandTotal - baseTotal;
  for (const tax of parsed.evaluation.taxes) {
    const taxAmount = BigInt(tax.taxMinor);
    if (taxAmount === 0n) continue;
    if (taxAmount < 0n || taxAmount > MAX_SIGNED_MINOR) {
      throw new PositiveTaxPostingPlanError("tax amount is outside the signed-int64 range");
    }
    lines.push(Object.freeze({
      index: String(lines.length),
      role: "tax_payable",
      direction: "credit",
      taxIndex: tax.index,
      taxCode: tax.code,
      taxName: tax.name,
      amountMinor: creditMinor(taxAmount),
    }));
    balance -= taxAmount;
  }
  if (balance !== 0n) {
    throw new PositiveTaxPostingPlanError("posting plan does not balance to zero");
  }

  return Object.freeze({
    schemaVersion: 1,
    quoteHash: parsed.origin.quoteHash,
    snapshotHash: parsed.snapshotHash,
    currency: parsed.currency,
    state: blockers.length === 0 ? "route_ready" : "policy_blocked",
    blockers: Object.freeze(blockers),
    revenueLine,
    taxLineage,
    lines: Object.freeze(lines),
    balanceMinor: "0",
  });
}
