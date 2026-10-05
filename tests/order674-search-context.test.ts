import { describe, expect, test } from 'bun:test';
import {
  buildHotelSearchResults, isHotelSearchCurrent, normalizeHotelSearchQuery,
  type SearchStay, type SearchParty,
} from '../frontend/yellow/src/hotel-search';

const property = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const firstStay = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const secondStay = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbc';
const partyId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const stay: SearchStay = {
  reservationId: firstStay, confirmationNo: 'Y-109', primaryPartyId: partyId,
  primaryGuestDisplayName: 'Asha Guest', status: 'checked_in', sellableUnitLabel: '109',
  stayFrom: '2026-09-23T20:00:00.000000Z', stayTo: '2026-09-25T20:00:00.000000Z',
};
const party: SearchParty = { partyId, displayName: 'Asha Guest', kind: 'person', status: 'active' };

describe('Order 674 compact search context', () => {
  test('same guest produces distinct profile, reservation and cashier destinations with hotel-local dates', () => {
    const results = buildHotelSearchResults(property, 'asha', [stay], [party], 30, { timezone: 'Asia/Kolkata' }).results;
    const reservation = results.find(result => result.kind === 'reservation')!;
    const profile = results.find(result => result.kind === 'guest')!;
    expect(reservation.title).toBe('Asha Guest');
    expect(reservation.label).toBe('Y-109');
    expect(reservation.detail).toBe('Y-109 · Room 109 · 24 Sept 2026 → 26 Sept 2026');
    expect(reservation.statusLabel).toBe('Checked in');
    expect(reservation.destination).toBe('Front desk › Reservation');
    expect(reservation.href).toBe(`/p/${property}/res/${firstStay}`);
    expect(reservation.cashierHref).toBe(`/p/${property}/today?workspace=finance&reservation=${firstStay}`);
    expect(profile.destination).toBe('Guest services › Profile');
    expect(profile.href).toBe(`/p/${property}/guests?guest=${partyId}`);
    expect(profile.cashierHref).toBeUndefined();
    expect(profile.statusLabel).toBe('Active');
  });

  test('repeat stays retain separate confirmations, rooms, dates and deep links', () => {
    const repeat = { ...stay, reservationId: secondStay, confirmationNo: 'Y-210', sellableUnitLabel: '210',
      stayFrom: '2026-10-03T12:00:00.000000Z', stayTo: '2026-10-05T12:00:00.000000Z', status: 'confirmed' };
    const results = buildHotelSearchResults(property, 'asha', [stay, repeat], [], 30, { timezone: 'Asia/Kolkata' }).results;
    expect(results.map(result => result.title)).toEqual(['Asha Guest', 'Asha Guest']);
    expect(new Set(results.map(result => result.detail)).size).toBe(2);
    expect(new Set(results.map(result => result.href)).size).toBe(2);
    expect(results[1]?.detail).toContain('3 Oct 2026 → 5 Oct 2026');
    expect(results[1]?.statusLabel).toBe('Confirmed');
  });

  test('unavailable timezone is honestly labeled UTC, never browser-local time', () => {
    for (const timezone of [undefined, 'Invalid/Zone']) {
      const result = buildHotelSearchResults(property, '109', [stay], [], 30, { timezone }).results[0]!;
      expect(result.detail).toContain('23 Sept 2026 → 25 Sept 2026 (UTC)');
    }
  });

  test('missing or zone-less dates and unassigned rooms are not invented', () => {
    const missing: SearchStay = { ...stay, sellableUnitLabel: undefined, unitTypeLabel: 'Deluxe',
      stayFrom: undefined, stayTo: '2026-09-26T11:00:00' };
    const result = buildHotelSearchResults(property, 'asha', [missing], [], 30, { timezone: 'Asia/Kolkata' }).results[0]!;
    expect(result.detail).toBe('Y-109 · Deluxe · Room unassigned · Stay dates unavailable');
    const partial = buildHotelSearchResults(property, 'asha', [{ ...missing, stayTo: stay.stayTo }], []).results[0]!;
    expect(partial.detail).toContain('Arrival unavailable → 25 Sept 2026 (UTC)');
  });

  test('type filtering precedes display cap and counts deduplicate identities', () => {
    const parties = Array.from({ length: 40 }, (_, index): SearchParty => ({ ...party,
      partyId: `cccccccc-cccc-4ccc-8ccc-${index.toString().padStart(12, '0')}` }));
    const all = buildHotelSearchResults(property, 'asha', [stay, stay], [...parties, parties[0]!]);
    expect(all.results).toHaveLength(30);
    expect(all.counts).toEqual({ all: 41, guest: 40, reservation: 1 });
    const stays = buildHotelSearchResults(property, 'asha', [stay], parties, 30, { filter: 'reservation' });
    expect(stays.results).toHaveLength(1);
    expect(stays.results[0]?.key).toBe(`reservation:${firstStay}`);
    expect(stays.total).toBe(1);
    expect(stays.counts).toEqual(all.counts);
    const profiles = buildHotelSearchResults(property, 'asha', [stay], parties, 30, { filter: 'guest' });
    expect(profiles.total).toBe(40);
    expect(profiles.results).toHaveLength(30);
    expect(profiles.results.every(result => result.kind === 'guest')).toBe(true);
  });

  test('failed or denied source does not gain destinations from the other authorized source', () => {
    const noProfiles = buildHotelSearchResults(property, 'asha', [stay], [], 30, { filter: 'guest' });
    expect(noProfiles.results).toEqual([]);
    expect(noProfiles.counts).toEqual({ all: 1, reservation: 1, guest: 0 });
    const noStays = buildHotelSearchResults(property, 'asha', [], [party], 30, { filter: 'reservation' });
    expect(noStays.results).toEqual([]);
    expect(noStays.counts).toEqual({ all: 1, reservation: 0, guest: 1 });
    expect(buildHotelSearchResults(property, 'asha', [], [party]).results[0]?.cashierHref).toBeUndefined();
  });

  test('only supplied masked contact hint is presented and raw extra contact fields are not copied', () => {
    const contacts = [{ kind: 'phone', hint: '•••• 2041', value: '+91-99999-99999' }];
    const result = buildHotelSearchResults(property, 'asha', [], [{ ...party, contacts }]).results[0]!;
    expect(result.detail).toContain('•••• 2041');
    expect(JSON.stringify(result)).not.toContain('+91-99999-99999');
  });

  test('unsafe property or entity identifiers never become navigable results or tab counts', () => {
    const invalidProperty = buildHotelSearchResults('../other', 'asha', [stay], [party]);
    expect(invalidProperty.counts.all).toBe(0);
    const invalidIds = buildHotelSearchResults(property, 'asha', [{ ...stay, reservationId: '../res' }], [{ ...party, partyId: 'bad/profile' }]);
    expect(invalidIds.results).toEqual([]);
    expect(invalidIds.counts.all).toBe(0);
  });

  test('edited or cleared draft and recovery lock suppress prior submitted results', () => {
    expect(isHotelSearchCurrent('asha', 'asha', false)).toBe(true);
    expect(isHotelSearchCurrent('  asha  guest ', normalizeHotelSearchQuery('asha guest'), false)).toBe(true);
    for (const draft of ['ash', 'a', '', 'another guest']) {
      expect(isHotelSearchCurrent(draft, 'asha', false)).toBe(false);
    }
    expect(isHotelSearchCurrent('asha', 'asha', true)).toBe(false);
    expect(isHotelSearchCurrent('a', 'a', false)).toBe(false);
    expect(isHotelSearchCurrent('asha', '', false)).toBe(false);
  });
});
