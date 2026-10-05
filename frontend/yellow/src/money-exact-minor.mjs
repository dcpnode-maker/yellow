/** @param {string} minor @param {string} currency @returns {string} */
export function moneyExactMinor(minor, currency) { const formatter = new Intl.NumberFormat(undefined, { style: "currency", currency }); const fractionDigits = formatter.resolvedOptions().maximumFractionDigits ?? 2; const amount = BigInt(minor); const negative = amount < 0n; const absolute = negative ? -amount : amount; const scale = 10n ** BigInt(fractionDigits); const whole = absolute / scale; const fraction = (absolute % scale).toString().padStart(fractionDigits, "0"); const parts = formatter.formatToParts(negative ? -whole : whole); const rendered = parts.map((part) => part.type === "fraction" ? fraction : part.value).join(""); return negative && whole === 0n && !parts.some((part) => part.type === "minusSign") ? `-${rendered}` : rendered; }

/** Strict guest presentation only; native command admission remains unchanged.
 * @param {unknown} amountMinor @param {unknown} currency @returns {string}
 */
export function guestDepositAmountDisplay(amountMinor, currency) {
  if (typeof amountMinor !== "string" || !/^(?:0|[1-9][0-9]*)$/.test(amountMinor)) return "Amount unavailable";
  if (typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency)) return amountMinor + " minor units · currency unavailable";
  const unavailable = amountMinor + " " + currency + " minor units · currency precision unavailable";
  if (["XXX", "XTS", "XAU", "XAG", "XPD", "XPT", "XBA", "XBB", "XBC", "XBD"].includes(currency)) return unavailable;
  try {
    if (typeof Intl.supportedValuesOf !== "function") return unavailable;
    const catalogue = Intl.supportedValuesOf("currency");
    if (!Array.isArray(catalogue) || !catalogue.includes(currency)) return unavailable;
    const formatter = new Intl.NumberFormat(undefined, { style: "currency", currency });
    const precision = formatter.resolvedOptions().maximumFractionDigits;
    if (typeof precision !== "number" || !Number.isSafeInteger(precision) || precision < 0) return unavailable;
    return moneyExactMinor(amountMinor, currency);
  } catch { return unavailable; }
}
