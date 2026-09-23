export interface SignedAllocationWeight {
  readonly ordinal: string;
  readonly weightMinor: string;
}

export interface SignedAllocation {
  readonly ordinal: string;
  readonly amountMinor: string;
}

const INTEGER = /^-?(?:0|[1-9][0-9]*)$/;
const POSITIVE = /^[1-9][0-9]*$/;
const ORDINAL = /^(?:0|[1-9][0-9]*)$/;
const MAX = 9223372036854775807n;
const MIN = -9223372036854775808n;

export class SignedLargestRemainderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SignedLargestRemainderError";
  }
}

function signed(value: string): bigint {
  if (!INTEGER.test(value)) throw new SignedLargestRemainderError("amount must be canonical signed integer");
  const parsed = BigInt(value);
  if (parsed < MIN || parsed > MAX) throw new SignedLargestRemainderError("amount exceeds signed int64");
  return parsed;
}

/** Deterministic signed largest-remainder allocation; no floating point is used. */
export function allocateSignedLargestRemainder(
  amountMinor: string,
  weights: readonly SignedAllocationWeight[],
): readonly SignedAllocation[] {
  const amount = signed(amountMinor);
  if (amount === 0n) throw new SignedLargestRemainderError("zero source cannot be allocated");
  if (!Object.isFrozen(weights) || weights.length === 0 || weights.length > 366) {
    throw new SignedLargestRemainderError("weights must be a frozen 1..366 collection");
  }
  const seen = new Set<string>();
  const parsed = weights.map((item) => {
    if (!Object.isFrozen(item) || !ORDINAL.test(item.ordinal) || !POSITIVE.test(item.weightMinor) || seen.has(item.ordinal)) {
      throw new SignedLargestRemainderError("weights require unique canonical ordinals and positive integers");
    }
    seen.add(item.ordinal);
    return { ordinal: item.ordinal, weight: BigInt(item.weightMinor) };
  });
  const totalWeight = parsed.reduce((sum, item) => sum + item.weight, 0n);
  if (totalWeight <= 0n || totalWeight > MAX) throw new SignedLargestRemainderError("weight total is unsafe");
  const magnitude = amount < 0n ? -amount : amount;
  const rows = parsed.map((item) => {
    const product = magnitude * item.weight;
    return { ...item, share: product / totalWeight, remainder: product % totalWeight };
  });
  let residual = magnitude - rows.reduce((sum, row) => sum + row.share, 0n);
  const ranked = [...rows].sort((a, b) => {
    if (a.remainder !== b.remainder) return a.remainder > b.remainder ? -1 : 1;
    const ao = BigInt(a.ordinal), bo = BigInt(b.ordinal);
    return ao < bo ? -1 : ao > bo ? 1 : 0;
  });
  for (const row of ranked) {
    if (residual === 0n) break;
    row.share += 1n;
    residual -= 1n;
  }
  if (residual !== 0n) throw new SignedLargestRemainderError("allocation did not reconcile");
  const sign = amount < 0n ? -1n : 1n;
  const result = rows
    .sort((a, b) => BigInt(a.ordinal) < BigInt(b.ordinal) ? -1 : 1)
    .map((row) => Object.freeze({ ordinal: row.ordinal, amountMinor: (row.share * sign).toString() }));
  if (result.reduce((sum, row) => sum + BigInt(row.amountMinor), 0n) !== amount) {
    throw new SignedLargestRemainderError("signed allocation did not reconcile");
  }
  return Object.freeze(result);
}
