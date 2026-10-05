const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MONEY = /^(?:0|-?[1-9][0-9]*)$/;
/** @param {unknown} value @returns {Record<string, unknown>} */
function record(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Owner trust evidence unavailable');
  return /** @type {Record<string, unknown>} */ (value);
}
/** @param {unknown} value @param {string} key @returns {unknown} */
function data(value, key) {
  const descriptor = Object.getOwnPropertyDescriptor(record(value), key);
  if (!descriptor || !('value' in descriptor)) throw new Error('Owner trust evidence unavailable');
  return descriptor.value;
}
/** @param {unknown} value @returns {string} */
function text(value) { if (typeof value !== 'string') throw new Error('Owner trust evidence unavailable'); return value; }
/** @param {unknown} value @returns {string} */
function uuid(value) { const v = text(value); if (!UUID.test(v)) throw new Error('Owner trust identity unavailable'); return v; }
/** @param {unknown} value @returns {string} */
function money(value) { const v = text(value); if (!MONEY.test(v)) throw new Error('Owner trust amount unavailable'); return v; }
/** @param {unknown} value @returns {string} */
function positive(value) { const v = money(value); if (!/^[1-9][0-9]*$/.test(v)) throw new Error('Owner trust expense unavailable'); return v; }
/** @param {unknown} value @returns {boolean} */
function flag(value) { if (typeof value !== 'boolean') throw new Error('Owner trust route unavailable'); return value; }
/** @param {unknown} value @returns {string} */
function currency(value) { const v = text(value); if (!/^[A-Z]{3}$/.test(v)) throw new Error('Owner trust currency unavailable'); return v; }
/** @param {unknown} value @returns {string} */
function timestamp(value) { const v = text(value); if (new Date(v).toISOString() !== v) throw new Error('Owner trust date unavailable'); return v; }
/** @param {unknown} value @returns {string|null} */
function cursor(value) { if (value === null) return null; const v = text(value); if (!/^(?:0|[1-9][0-9]{0,8})$/.test(v)) throw new Error('Owner trust cursor unavailable'); return v; }
/** @param {unknown} value @returns {import('../../contexts/financials/index').OwnerTrustAccountView} */
function account(value) {
  return Object.freeze({ accountReference: uuid(data(value, 'accountReference')), accountLabel: text(data(value, 'accountLabel')),
    ownerLabel: text(data(value, 'ownerLabel')), currency: currency(data(value, 'currency')),
    availableBalanceMinor: money(data(value, 'availableBalanceMinor')), canPost: flag(data(value, 'canPost')) });
}
/** @param {unknown} value @returns {import('../../contexts/financials/index').OwnerTrustApprovalView} */
function approval(value) {
  const status = data(value, 'status');
  if (status !== 'pending' && status !== 'approved' && status !== 'rejected' && status !== 'expired') throw new Error('Owner trust status unavailable');
  const decided = data(value, 'decidedAt');
  return Object.freeze({ approvalId: uuid(data(value, 'approvalId')), accountReference: uuid(data(value, 'accountReference')),
    accountLabel: text(data(value, 'accountLabel')), ownerLabel: text(data(value, 'ownerLabel')), currency: currency(data(value, 'currency')),
    amountMinor: positive(data(value, 'amountMinor')), availableBalanceMinor: money(data(value, 'availableBalanceMinor')),
    projectedBalanceMinor: money(data(value, 'projectedBalanceMinor')), reason: text(data(value, 'reason')),
    requesterLabel: text(data(value, 'requesterLabel')), status, requestedAt: timestamp(data(value, 'requestedAt')),
    decidedAt: decided === null ? null : timestamp(decided), canDecide: flag(data(value, 'canDecide')), canPost: flag(data(value, 'canPost')) });
}
/** @template T @param {unknown} value @param {(row:unknown)=>T} parse @param {(row:T)=>string} identity @returns {readonly T[]} */
function rows(value, parse, identity) {
  if (!Array.isArray(value) || value.length > 100) throw new Error('Owner trust page unavailable');
  const ids = new Set(), result = [];
  for (let i = 0; i < value.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
    if (!descriptor || !('value' in descriptor)) throw new Error('Owner trust page unavailable');
    const row = parse(descriptor.value), id = identity(row);
    if (ids.has(id)) throw new Error('Duplicate owner trust identity');
    ids.add(id); result.push(row);
  }
  return Object.freeze(result);
}
/** @param {unknown} value @returns {import('./owner-trust-workbench-read.mjs').OwnerTrustAccountPage} */
export function parseOwnerTrustAccounts(value) {
  return Object.freeze({ accounts: rows(data(value, 'accounts'), account, row => row.accountReference), nextCursor: cursor(data(value, 'nextCursor')) });
}
/** @param {unknown} value @returns {import('./owner-trust-workbench-read.mjs').OwnerTrustApprovalPage} */
export function parseOwnerTrustApprovals(value) {
  return Object.freeze({ approvals: rows(data(value, 'approvals'), approval, row => row.approvalId), nextCursor: cursor(data(value, 'nextCursor')) });
}
/** @param {unknown} value @returns {import('../../contexts/financials/index').OwnerTrustExpensePreview} */
export function parseOwnerTrustPreview(value) {
  return Object.freeze({ accountReference: uuid(data(value, 'accountReference')), accountLabel: text(data(value, 'accountLabel')),
    ownerLabel: text(data(value, 'ownerLabel')), currency: currency(data(value, 'currency')),
    amountMinor: positive(data(value, 'amountMinor')), availableBalanceMinor: money(data(value, 'availableBalanceMinor')),
    projectedBalanceMinor: money(data(value, 'projectedBalanceMinor')), approvalRequired: flag(data(value, 'approvalRequired')) });
}
/** @param {unknown} value @param {string} property @returns {boolean} */
export function hasOwnerTrustPropertyGrant(value, property) {
  const properties = data(value, 'properties');
  if (!Array.isArray(properties) || properties.length > 10000) throw new Error('Property grants unavailable');
  const ids = new Set();
  for (let i = 0; i < properties.length; i++) {
    const d = Object.getOwnPropertyDescriptor(properties, String(i));
    if (!d || !('value' in d)) throw new Error('Property grants unavailable');
    const id = uuid(data(d.value, 'id')); if (ids.has(id)) throw new Error('Duplicate property grant'); ids.add(id);
  }
  return ids.has(property);
}
/** @template T @param {readonly T[]} before @param {readonly T[]} next @param {(row:T)=>string} identity @param {readonly string[]} used @param {string|null} requested @param {string|null} following @returns {readonly T[]} */
export function appendOwnerTrustPage(before, next, identity, used, requested, following) {
  if (before.length + next.length > 100 || (following !== null && (following === requested || used.includes(following)))) throw new Error('Bounded owner trust page unavailable; refresh');
  const ids = new Set(before.map(identity));
  for (const row of next) { const id = identity(row); if (ids.has(id)) throw new Error('Duplicate owner trust page; refresh'); ids.add(id); }
  return Object.freeze([...before, ...next]);
}
/** @param {import('./owner-trust-workbench-read.mjs').OwnerTrustReadContext} captured @param {import('./owner-trust-workbench-read.mjs').OwnerTrustReadContext} current @returns {boolean} */
export function ownerTrustReadIsCurrent(captured, current) {
  return captured.financeEpoch === current.financeEpoch && ownerTrustReadSameSession(captured, current);
}
/** @param {import('./owner-trust-workbench-read.mjs').OwnerTrustReadContext} captured @param {import('./owner-trust-workbench-read.mjs').OwnerTrustReadContext} current @returns {boolean} */
export function ownerTrustReadSameSession(captured, current) {
  return captured.generation === current.generation && captured.property === current.property && captured.token === current.token
    && captured.principal === current.principal && current.view === 'trust' && current.token.length > 0 && current.principal !== null;
}

/** Native problem metadata classifies negative admission only, never a permission grant.
 * @param {number} status @param {unknown} body @returns {import('./owner-trust-workbench-read.mjs').OwnerTrustReadFailure} */
export function classifyOwnerTrustReadFailure(status, body) {
  if (status === 401) return Object.freeze({ status, kind: 'session-denied', suppliedType: null });
  if (status !== 403 && status !== 404) return Object.freeze({ status, kind: 'unavailable', suppliedType: null });
  try {
    const problemStatus = data(body, 'status'), type = data(body, 'type');
    if (problemStatus !== status || typeof type !== 'string') throw new Error('Unverified denial');
    const kind = type === 'auth/scope_missing' ? 'scope-missing' : type === 'auth/property_forbidden' ? 'property-forbidden' : 'unverified-denial';
    return Object.freeze({ status, kind, suppliedType: type });
  } catch { return Object.freeze({ status, kind: 'unverified-denial', suppliedType: null }); }
}
