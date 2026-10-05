import type { FolioComparisonStatement, FolioWindowComparisonWindow } from "../../../frontend/yellow/src/folio-window-comparison";

export type Order691Statement = FolioComparisonStatement & Readonly<{
  siblingWindows: readonly Readonly<{ id: string; windowNo: number; reference: string | null; name: string | null; status: string; balanceMinor: string }>[];
  generation: string;
  chargeOptions: readonly unknown[];
  chargeAvailability: Readonly<{ allowed: boolean; reason: string }>;
}>;

export const ORDER691_PROPERTY_ID = "6081b544-22a1-534f-a86d-bb1ae0519e14";
export const ORDER691_RESERVATION_ONE = "69100000-0000-4000-8000-000000000001";
export const ORDER691_RESERVATION_TWO = "69200000-0000-4000-8000-000000000002";
export const ORDER691_OTHER_RESERVATION = "69300000-0000-4000-8000-000000000003";

const familyPrefix = (reservationId: string): "69100000" | "69200000" | "69300000" =>
  reservationId === ORDER691_RESERVATION_ONE ? "69100000" : reservationId === ORDER691_RESERVATION_TWO ? "69200000" : "69300000";

export function makeOrder691Window(reservationId: string, windowNo: number): FolioWindowComparisonWindow {
  const identity = familyPrefix(reservationId);
  return Object.freeze({
    folioId: `${identity}-0000-4000-8000-${String(windowNo).padStart(12, "0")}`,
    windowNo,
    name: windowNo === 1 ? "Primary guest" : windowNo === 2 ? "Business incidentals" : `Window ${windowNo} fixture`,
    reference: `F-${identity.slice(0, 3)}-${String(windowNo).padStart(3, "0")}`,
    status: "open",
  });
}

export function makeOrder691WindowFamily(reservationId: string, count: number): readonly FolioWindowComparisonWindow[] {
  if (!Number.isInteger(count) || count < 0 || count > 20) throw new RangeError("Order691 fixtures support 0–20 existing windows.");
  return Array.from({ length: count }, (_, index) => makeOrder691Window(reservationId, index + 1));
}

export function makeOrder691Statement(
  reservationId: string,
  window: FolioWindowComparisonWindow,
): Order691Statement {
  const openingMinor = BigInt("900719925474099312345") + BigInt(window.windowNo) * 100_000n;
  const chargeMinor = (12_345n + BigInt(window.windowNo) * 100n).toString();
  const paymentMinor = (-2_500n).toString();
  const afterChargeMinor = (openingMinor + BigInt(chargeMinor)).toString();
  const balanceMinor = (BigInt(afterChargeMinor) + BigInt(paymentMinor)).toString();
  const family = makeOrder691WindowFamily(reservationId, 20);
  return Object.freeze({
    reservationId,
    folio: Object.freeze({ id: window.folioId, reference: window.reference, name: window.name, windowNo: window.windowNo, status: window.status, currency: "INR" }),
    siblingWindows: Object.freeze(family.map((item) => Object.freeze({
      id: item.folioId, windowNo: item.windowNo, reference: item.reference, name: item.name,
      status: item.status, balanceMinor: (BigInt("900719925474099312345") + BigInt(item.windowNo) * 100_000n +
        BigInt(12_345n + BigInt(item.windowNo) * 100n) - 2_500n).toString(),
    }))),
    balanceMinor,
    stayTotalMinor: balanceMinor,
    generation: `fixture-${window.windowNo}`,
    rows: Object.freeze([
      Object.freeze({
        lineId: `${window.folioId}-1000`, journalId: `${window.folioId}-2000`, kind: "charge",
        businessDate: "2026-09-24", description: `Synthetic room charge · window ${window.windowNo}`,
        quantity: "1.000", amountMinor: chargeMinor, runningBalanceMinor: afterChargeMinor,
        txCode: "ROOM", transferGroup: Object.freeze({ id: `${window.folioId}-3000`, memberCount: 1, eligible: true, reason: null, currentWindowId: window.folioId }),
      }),
      Object.freeze({
        lineId: `${window.folioId}-1001`, journalId: `${window.folioId}-2001`, kind: "payment",
        businessDate: "2026-09-24", description: "Synthetic hosted payment reference",
        quantity: "1.000", amountMinor: paymentMinor, runningBalanceMinor: balanceMinor,
        txCode: "PAYMENT", transferGroup: Object.freeze({ id: `${window.folioId}-3001`, memberCount: 1, eligible: true, reason: null, currentWindowId: window.folioId }),
      }),
    ]),
    chargeOptions: Object.freeze([]),
    chargeAvailability: Object.freeze({ allowed: false, reason: "Read-only browser fixture." }),
  });
}
