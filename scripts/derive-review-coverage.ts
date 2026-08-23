import { fileURLToPath } from "node:url";

export interface IndependentReviewCoverage {
  readonly throughOrder: number;
  readonly approvedReviewFiles: readonly string[];
}

const REVIEW_DIRECTORY = new URL("../handoff/reviews/", import.meta.url);
const GENERATED_MODULE = new URL("../src/generated/review-coverage.ts", import.meta.url);

const KNOWN_SEQUENCE_GAPS = new Set([87, 88]);

export function parseApprovedOrders(source: string): number[] | undefined {
  const reviewerMatch = source.match(/\*\*Reviewed by:\*\*([\s\S]*?)(?:\*\*Date:\*\*|\*\*Verdict:\*\*|\n\n)/i)
    ?? source.match(/^\*\*Reviewed by:\*\*\s*(.+)$/im);
  const reviewer = (reviewerMatch?.[1] ?? "").trim();
  if (!reviewer) return undefined;

  // Builder self-reviews are strictly rejected
  if (/builder/i.test(reviewer)) return undefined;

  // Must be recognized review authority: architect role or independent non-implementing reviewer
  const isArchitect = /architect role/i.test(reviewer);
  const isIndependentReviewer = /independent non-implementing reviewer/i.test(reviewer);
  if (!isArchitect && !isIndependentReviewer) return undefined;

  const verdictRaw = source.match(/\*\*Verdict:\*\*\s*(.+)$/im)?.[1];
  if (!verdictRaw) return undefined;
  const verdict = verdictRaw.replace(/\*/g, "").trim();
  if (!/^APPROVED\b/i.test(verdict)) return undefined;

  const titleRaw = source.match(/^# REVIEW\s+(.+)$/m)?.[1];
  if (!titleRaw) return undefined;
  const title = titleRaw.trim();

  // Multi-wave reviews declare exclusive discharge scopes
  const exclusiveScopeRaw = source.match(/## Exclusive discharge scope\s+([\s\S]*?)(?:\n##|\n---|$)/i)?.[1];
  if (exclusiveScopeRaw !== undefined) {
    const scopeText = exclusiveScopeRaw;
    const ordersMatch = scopeText.match(/Orders\s+\*\*?([^*.\n]+)\*\*?/i)?.[1];
    const targetText = ordersMatch ?? scopeText;
    const orders = new Set<number>();
    const orderRangeRegex = /(\d{3})(?:\s*[–-]\s*(\d{3}))?/g;
    let match: RegExpExecArray | null;
    while ((match = orderRangeRegex.exec(targetText)) !== null) {
      const first = match[1];
      if (!first) continue;
      const start = Number(first);
      const second = match[2];
      const end = second ? Number(second) : start;
      if (Number.isSafeInteger(start) && Number.isSafeInteger(end) && start <= end) {
        for (let o = start; o <= end; o++) {
          orders.add(o);
        }
      }
    }
    if (orders.size === 0) return undefined;
    return Array.from(orders).sort((a, b) => a - b);
  }

  // Reject partial wave reviews without an exclusive discharge scope to prevent header inflation
  if (/\bwave\b/i.test(title)) return undefined;

  // Single or cumulative reviews declare range in title
  const rangeMatch = title.match(/^(\d{3})(?:[–-](\d{3}))?\b/);
  if (!rangeMatch) return undefined;
  const startStr = rangeMatch[1];
  if (!startStr) return undefined;
  const start = Number(startStr);
  const endStr = rangeMatch[2];
  const end = Number(endStr ?? startStr);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start <= 0) {
    return undefined;
  }
  const orders: number[] = [];
  for (let o = start; o <= end; o++) {
    orders.push(o);
  }
  return orders;
}

export function approvedReviewEnd(source: string): number | undefined {
  const orders = parseApprovedOrders(source);
  if (!orders || orders.length === 0) return undefined;
  return Math.max(...orders);
}

export async function deriveIndependentReviewCoverage(
  directory = REVIEW_DIRECTORY,
): Promise<IndependentReviewCoverage> {
  const approvedReviewFiles: string[] = [];
  const allApprovedOrders = new Set<number>();
  const fileNames: string[] = [];
  const cwd = fileURLToPath(directory);
  for await (const fileName of new Bun.Glob("*.md").scan({ cwd, onlyFiles: true })) {
    fileNames.push(fileName);
  }
  fileNames.sort((left, right) => left.localeCompare(right));
  for (const fileName of fileNames) {
    const source = await Bun.file(new URL(fileName, directory)).text();
    const orders = parseApprovedOrders(source);
    if (!orders) continue;
    approvedReviewFiles.push(fileName);
    for (const o of orders) {
      allApprovedOrders.add(o);
    }
  }

  let throughOrder = 0;
  if (allApprovedOrders.has(44)) {
    throughOrder = 44;
  }

  // Gate-3 requires all 45 manifest rows (045..086, 089..091, accounting for 087/088 sequence gaps)
  const gate3Required = Array.from({ length: 91 - 45 + 1 }, (_, i) => 45 + i)
    .filter((order) => !KNOWN_SEQUENCE_GAPS.has(order));
  const hasFullGate3Coverage = gate3Required.every((order) => allApprovedOrders.has(order));
  if (throughOrder === 44 && hasFullGate3Coverage) {
    throughOrder = 91;
  }

  return Object.freeze({ throughOrder, approvedReviewFiles: Object.freeze(approvedReviewFiles) });
}

export function renderReviewCoverageModule(coverage: IndependentReviewCoverage): string {
  const files = coverage.approvedReviewFiles.map((fileName) => `  ${JSON.stringify(fileName)},`).join("\n");
  return `// Generated by scripts/derive-review-coverage.ts from approved architect review documents.\n` +
    `// Do not edit this file directly. Run: bun scripts/derive-review-coverage.ts --write\n` +
    `export const APPROVED_REVIEW_FILES = Object.freeze([\n${files}\n] as const);\n` +
    `export const INDEPENDENTLY_REVIEWED_THROUGH_ORDER = ${coverage.throughOrder};\n`;
}

if (import.meta.main) {
  const mode = process.argv[2] ?? "--check";
  if (mode !== "--check" && mode !== "--write") {
    throw new Error("usage: bun scripts/derive-review-coverage.ts [--check|--write]");
  }
  const expected = renderReviewCoverageModule(await deriveIndependentReviewCoverage());
  if (mode === "--write") {
    await Bun.write(GENERATED_MODULE, expected);
    process.stdout.write("Generated independent review coverage.\n");
  } else {
    const actual = await Bun.file(GENERATED_MODULE).text();
    if (actual !== expected) throw new Error("generated review coverage is stale; run with --write");
    process.stdout.write("Generated independent review coverage is exact.\n");
  }
}
