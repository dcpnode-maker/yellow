import { describe, expect, test } from 'bun:test';
import { buildHotelSearchResults, normalizeHotelSearchQuery, type SearchGroup, type SearchParty, type SearchStay } from '../frontend/yellow/src/hotel-search';

const property = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const stayId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const partyId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const otherPartyId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const stays: SearchStay[] = [{
  reservationId: stayId,
  confirmationNo: 'AB-204',
  primaryPartyId: partyId,
  primaryGuestDisplayName: 'Zoë Guest',
  primaryPartyName: 'Zoe Legal',
  sellableUnitLabel: 'Suite 204',
  unitTypeLabel: 'Suite',
  status: 'checked_in',
}];

const parties: SearchParty[] = [
  { partyId, displayName: 'Zoë Guest', legalName: 'Zoe Legal', kind: 'person', status: 'active' },
  { partyId: otherPartyId, displayName: 'Zoë Guest', legalName: 'Zoë Other', kind: 'person', status: 'active' },
];

describe('Order 668 pure hotel search model', () => {
  test('normalizes whitespace and caps input at 100 Unicode characters', () => {
    expect(normalizeHotelSearchQuery('  hello\n  world  ')).toBe('hello world');
    expect(Array.from(normalizeHotelSearchQuery('🛎️'.repeat(60))).length).toBe(100);
  });

  test('ranks exact, prefix, then substring matches deterministically', () => {
    const candidates: SearchStay[] = [
      { ...stays[0]!, reservationId: stayId, confirmationNo: 'xxAB-204xx' },
      { ...stays[0]!, reservationId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', confirmationNo: 'AB-204 extra' },
      { ...stays[0]!, reservationId: 'ffffffff-ffff-4fff-8fff-ffffffffffff', confirmationNo: 'AB-204' },
    ];
    const result = buildHotelSearchResults(property, ' ab-204 ', candidates, [], 30);
    expect(result.results.map((item) => item.label)).toEqual(['AB-204', 'AB-204 extra', 'xxAB-204xx']);
    expect(result.total).toBe(3);
  });

  test('supports Unicode case folding and room-label matches', () => {
    const guest = buildHotelSearchResults(property, 'ZOË', stays, [], 30);
    expect(guest.results[0]?.title).toContain('Zoë Guest');
    const room = buildHotelSearchResults(property, 'suite 204', stays, [], 30);
    expect(room.results[0]?.kind).toBe('reservation');
    expect(room.results[0]?.href).toBe(`/p/${property}/res/${stayId}`);
  });

  test('finds reservations by their primary guest name', () => {
    const result = buildHotelSearchResults(property, 'Zoë Guest', stays, [], 30);
    expect(result.results.some((item) => item.kind === 'reservation' && item.key === `reservation:${stayId}`)).toBe(true);
  });

  test('a failed or denied profile source cannot synthesize profile destinations from stays', () => {
    const result = buildHotelSearchResults(property, 'Zoë Guest', stays, []);
    expect(result.results).toHaveLength(1);
    expect(result.results.every(item => item.kind === 'reservation')).toBe(true);
    expect(result.results.some(item => item.href.includes('/guests?'))).toBe(false);
  });

  test('keeps duplicate names as separate identities and deduplicates repeated identity', () => {
    const result = buildHotelSearchResults(property, 'zoë', stays, parties, 30);
    const guests = result.results.filter((item) => item.kind === 'guest');
    expect(guests).toHaveLength(2);
    expect(new Set(guests.map((item) => item.key)).size).toBe(2);
    expect(new Set(guests.map((item) => item.detail)).size).toBe(2);
  });

  test('uses the authorized masked contact hint to distinguish otherwise identical profiles', () => {
    const result = buildHotelSearchResults(property, 'zoë', [], [{ ...parties[0]!, contacts: [{ kind: 'phone', hint: '•••• 2041' }] }]);
    expect(result.results[0]?.detail).toContain('•••• 2041');
    expect(result.results[0]?.detail).not.toContain('Profile ending');
  });

  test('guards property and entity route IDs before producing URLs', () => {
    const unsafe: SearchStay[] = [
      { ...stays[0]!, reservationId: '../bad' },
      { ...stays[0]!, reservationId: 'bad/id', primaryPartyId: 'bad/id' },
    ];
    expect(buildHotelSearchResults('../bad', 'ab', stays, parties).results).toEqual([]);
    const result = buildHotelSearchResults(property, 'ab', unsafe, [
      { ...parties[0]!, partyId: 'bad/id' },
    ]);
    expect(result.results).toEqual([]);
  });

  test('returns empty for short queries and reports total before the capped result page', () => {
    expect(buildHotelSearchResults(property, ' a ', stays, parties).results).toEqual([]);
    const result = buildHotelSearchResults(property, 'zo', [], parties, 1);
    expect(result.results).toHaveLength(1);
    expect(result.total).toBe(2);
    expect(buildHotelSearchResults(property, 'zo', [], parties, 500).results).toHaveLength(2);
  });

  test('includes API party candidates for alias/contact hits absent from local fields', () => {
    const result = buildHotelSearchResults(property, 'alias@example.test', [], parties, 30);
    expect(result.total).toBe(2);
    expect(result.results.map((item) => item.kind)).toEqual(['guest', 'guest']);
  });

  test('builds the canonical reservation cashier destination', () => {
    const result = buildHotelSearchResults(property, 'AB-204', stays, [], 30);
    expect(result.results[0]?.cashierHref).toBe(`/p/${property}/today?workspace=finance&reservation=${stayId}`);
  });
  test('ranks authorized group name/code candidates with exact group deep links and no cashier route', () => {
    const groups: SearchGroup[] = [
      { groupId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', code: 'GRP-WEDDING', name: 'Patel wedding', kind: 'linked', status: 'tentative', memberCount: 3 },
      { groupId: 'ffffffff-ffff-4fff-8fff-ffffffffffff', code: 'GRP-SUMMIT', name: 'Summit team', kind: 'block', status: 'tentative', memberCount: 2 },
    ];
    const byName = buildHotelSearchResults(property, 'patel', [], [], 30, { groups });
    expect(byName.counts.group).toBe(1);
    expect(byName.results[0]).toMatchObject({ kind: 'group', title: 'Patel wedding',
      href: `/p/${property}/reservations?view=groups&group=${groups[0]!.groupId}` });
    expect(byName.results[0]?.detail).toContain('No rooms held by group');
    expect(byName.results[0]?.cashierHref).toBeUndefined();
    expect(buildHotelSearchResults(property, 'grp-summit', [], [], 30, { groups, filter: 'group' }).results[0]?.key)
      .toBe(`group:${groups[1]!.groupId}`);
    expect(buildHotelSearchResults(property, 'patel', [], [], 30, { groups: [{ ...groups[0]!, groupId: '../bad' }] }).results).toEqual([]);
  });
});
