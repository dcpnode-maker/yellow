export type SearchStay = {
  reservationId: string;
  confirmationNo: string;
  primaryPartyId?: string;
  primaryGuestDisplayName?: string;
  primaryPartyName?: string;
  sellableUnitLabel?: string;
  unitTypeLabel?: string;
  status: string;
  stayFrom?: string;
  stayTo?: string;
};

export type SearchParty = {
  partyId: string;
  displayName: string;
  legalName?: string | null;
  kind: string;
  status: string;
  contacts?: readonly Readonly<{ kind: string; hint: string }>[];
};
export type SearchGroup = {
  groupId: string;
  code: string;
  name: string;
  kind: 'linked' | 'block' | 'share';
  status: string;
  memberCount: number;
};

export type HotelSearchResult = {
  key: string;
  kind: 'guest' | 'reservation' | 'group';
  label: string;
  title: string;
  detail: string;
  destination: string;
  statusLabel: string;
  href: string;
  cashierHref?: string;
};

export type HotelSearchFilter = 'all' | 'reservation' | 'guest' | 'group';
type HotelSearchCounts = Readonly<Record<Exclude<HotelSearchFilter, 'group'>, number> & { group?: number }>;

/** A changed draft must never present the prior submission's records as current. */
export function isHotelSearchCurrent(query: string, submitted: string, locked: boolean): boolean {
  return !locked && Array.from(submitted).length >= 2 && normalizeHotelSearchQuery(query) === submitted;
}

function displayStatus(status: string): string {
  const words = status.replaceAll('_', ' ');
  return words ? words[0]!.toLocaleUpperCase() + words.slice(1) : 'Status unavailable';
}

function stayDates(stay: SearchStay, timezone?: string): string {
  let zone = timezone || 'UTC';
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: zone });
  } catch {
    zone = 'UTC';
    formatter = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: zone });
  }
  const format = (instant: string | undefined): string | undefined => {
    // Board values are explicit UTC instants. Never interpret a zone-less value
    // in the browser's timezone or silently turn a missing date into today.
    if (!instant || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(instant)) return;
    const date = new Date(instant);
    return Number.isFinite(date.getTime()) ? formatter.format(date) : undefined;
  };
  const from = format(stay.stayFrom);
  const to = format(stay.stayTo);
  if (!from && !to) return 'Stay dates unavailable';
  return `${from ?? 'Arrival unavailable'} → ${to ?? 'Departure unavailable'}${zone === 'UTC' ? ' (UTC)' : ''}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function canonicalUuid(value: string | undefined): value is string {
  return typeof value === 'string' && UUID.test(value);
}

function comparable(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase();
}

export function normalizeHotelSearchQuery(raw: string): string {
  return Array.from(raw.trim().replace(/\s+/gu, ' ')).slice(0, 100).join('');
}

function matchRank(query: string, fields: readonly (string | undefined)[]): number | undefined {
  let best: number | undefined;
  for (const field of fields) {
    if (!field) continue;
    const text = comparable(field);
    if (text === query) best = Math.min(best ?? 99, 0);
    else if (text.startsWith(query)) best = Math.min(best ?? 99, 1);
    else if (text.includes(query)) best = Math.min(best ?? 99, 2);
  }
  return best;
}

type Ranked = { result: HotelSearchResult; rank: number; identity: string };

export function buildHotelSearchResults(
  propertyId: string,
  query: string,
  stays: readonly SearchStay[],
  parties: readonly SearchParty[],
  limit = 30,
  options: Readonly<{ filter?: HotelSearchFilter; timezone?: string; groups?: readonly SearchGroup[] }> = {},
): { results: readonly HotelSearchResult[]; total: number; counts: HotelSearchCounts } {
  const normalizedQuery = comparable(normalizeHotelSearchQuery(query));
  if (!canonicalUuid(propertyId) || Array.from(normalizedQuery).length < 2) {
    return { results: [], total: 0, counts: options.groups ? { all: 0, reservation: 0, guest: 0, group: 0 } : { all: 0, reservation: 0, guest: 0 } };
  }

  const property = encodeURIComponent(propertyId);
  const found: Ranked[] = [];
  const seen = new Set<string>();
  const add = (ranked: Ranked) => {
    if (seen.has(ranked.identity)) return;
    seen.add(ranked.identity);
    found.push(ranked);
  };

  for (const stay of stays) {
    if (!canonicalUuid(stay.reservationId)) continue;
    const reservationId = encodeURIComponent(stay.reservationId);
    const room = stay.sellableUnitLabel ?? stay.unitTypeLabel;
    const reservationRank = matchRank(normalizedQuery, [
      stay.primaryGuestDisplayName,
      stay.primaryPartyName,
      stay.confirmationNo,
      room,
      stay.reservationId,
    ]);
    if (reservationRank !== undefined) {
      add({
        identity: `reservation:${stay.reservationId}`,
        rank: reservationRank,
        result: {
          key: `reservation:${stay.reservationId}`,
          kind: 'reservation',
          label: stay.confirmationNo || 'Reservation',
          title: stay.primaryGuestDisplayName || stay.primaryPartyName || stay.confirmationNo || 'Reservation',
          detail: [stay.confirmationNo,
            stay.sellableUnitLabel ? `Room ${stay.sellableUnitLabel}` : stay.unitTypeLabel ? `${stay.unitTypeLabel} · Room unassigned` : 'Room unassigned',
            stayDates(stay, options.timezone)].filter(Boolean).join(' · '),
          destination: 'Front desk › Reservation',
          statusLabel: displayStatus(stay.status),
          href: `/p/${property}/res/${reservationId}`,
          cashierHref: `/p/${property}/today?workspace=finance&reservation=${reservationId}`,
        },
      });
    }

    // A permitted stay read is not a substitute for permitted profile search.
    // Profile destinations are emitted only from the party API's own candidates.
  }

  for (const party of parties) {
    if (!canonicalUuid(party.partyId)) continue;
    const rank = matchRank(normalizedQuery, [party.displayName, party.legalName ?? undefined, party.partyId]);
    // The party API also searches aliases and contact fields that are not in this
    // structural type. Its returned candidates remain searchable at a lower rank.
    const effectiveRank = rank ?? 3;
    const partyId = encodeURIComponent(party.partyId);
    add({
      identity: `guest:${party.partyId}`,
      rank: effectiveRank,
      result: {
        key: `guest:${party.partyId}`,
        kind: 'guest',
        label: party.displayName || party.legalName || 'Guest',
        title: party.displayName || party.legalName || 'Guest',
        detail: [party.legalName !== party.displayName ? party.legalName : null,
          party.contacts?.[0]?.hint || `Profile ending ${party.partyId.slice(-8)}`,
          party.kind].filter(Boolean).join(' · '),
        destination: 'Guest services › Profile',
        statusLabel: displayStatus(party.status),
        href: `/p/${property}/guests?guest=${partyId}`,
      },
    });
  }

  for (const group of options.groups ?? []) {
    if (!canonicalUuid(group.groupId) || !['linked', 'block', 'share'].includes(group.kind)) continue;
    const rank = matchRank(normalizedQuery, [group.name, group.code]);
    if (rank === undefined) continue;
    add({
      identity: `group:${group.groupId}`,
      rank,
      result: {
        key: `group:${group.groupId}`,
        kind: 'group',
        label: group.code,
        title: group.name,
        detail: `${group.code} · ${group.memberCount} associated reservation${group.memberCount === 1 ? '' : 's'} · ${group.kind === 'linked' ? 'No rooms held by group' : `${group.kind} group`}`,
        destination: 'Reservations › Groups',
        statusLabel: displayStatus(group.status),
        href: `/p/${property}/reservations?view=groups&group=${encodeURIComponent(group.groupId)}`,
      },
    });
  }

  found.sort((a, b) => a.rank - b.rank || a.result.kind.localeCompare(b.result.kind) ||
    a.result.label.localeCompare(b.result.label) || a.identity.localeCompare(b.identity));
  const boundedLimit = Number.isFinite(limit) ? Math.max(1, Math.min(50, Math.trunc(limit))) : 30;
  const counts: { all: number; reservation: number; guest: number; group?: number } = options.groups
    ? { all: found.length, reservation: 0, guest: 0, group: 0 }
    : { all: found.length, reservation: 0, guest: 0 };
  for (const { result } of found) {
    if (result.kind === 'group') counts.group = (counts.group ?? 0) + 1;
    else counts[result.kind] += 1;
  }
  const filtered = found.filter(({ result }) => !options.filter || options.filter === 'all' || result.kind === options.filter);
  return { results: filtered.slice(0, boundedLimit).map(({ result }) => result), total: filtered.length, counts };
}
