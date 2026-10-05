/** @param {typeof import('react').createElement} h */
export function createStaffGroupBlockEvidenceCard(h) {
  /** @param {import('./StaffGroupBlockEvidenceCard.mjs').StaffGroupBlockEvidenceCardProps} props */
  return function StaffGroupBlockEvidenceCard({ group = null, contextLabel, evidenceState, unavailableReason, reservationLinks, masterFolioLink }) {
    const key = JSON.stringify([contextLabel, evidenceState, group]);
    /** @param {string} text */
    const note = text => h('p', { className: 'group-evidence__note' }, text);
    /** @param {string} label @param {import('react').ReactNode} value */
    const metric = (label, value) => h('div', { className: 'group-evidence__row', key: label }, h('dt', null, label), h('dd', null, value));
    /** @param {string} caption @param {readonly (readonly [string, import('react').ReactNode])[]} rows @param {string} rowKey */
    const table = (caption, rows, rowKey) => h('table', { className: 'group-evidence__table', key: rowKey },
      h('caption', null, caption), h('tbody', null, rows.map(([label, value]) => h('tr', { key: label },
        h('th', { scope: 'row' }, label), h('td', null, value)))));
    let content;
    if (evidenceState === 'unavailable') content = h('p', { role: 'alert', className: 'group-evidence__alert' },
      `Evidence unavailable. ${unavailableReason || 'Read this block again through the existing caller.'}`);
    else if (!group) content = note('No group block evidence returned.');
    else {
      const folioReference = group.masterFolioNo ?? 'Folio number not returned';
      const suppliedFolio = group.masterFolioId !== null && masterFolioLink !== undefined && masterFolioLink !== null ? masterFolioLink : folioReference;
      content = h('div', null,
        h('p', { className: 'group-evidence__state', role: 'status' },
          `${evidenceState === 'stale' ? 'Previously read block status' : 'Returned block status'}: ${group.status}`),
        h('p', { className: 'group-evidence__name' }, group.code, ' · ', group.name ?? 'Name not returned'),
        note(group.statusDeductsInventory ? 'Returned status deducts inventory.' : 'Returned status does not deduct inventory.'),
        h('dl', { className: 'group-evidence__metrics' },
          metric('Account', group.accountPartyName ?? 'Account name not returned'),
          metric('Dated range', `${group.arrivalDate ?? 'Arrival date not returned'} → ${group.departureDate ?? 'Departure date not returned'}`),
          metric('Blocked room nights', group.blockedRooms),
          metric('Picked-up room nights', group.pickedUpRooms),
          metric('Remaining room nights', group.remainingRooms),
          metric('Returned pickup', `${group.pickupPercent}%`),
          metric('Cutoff', `${group.cutoffDate ?? 'Cutoff date not returned'} · ${group.cutoffState}`),
          metric('Master folio', suppliedFolio),
          metric('Master folio status', group.masterFolioStatus ?? 'Folio status not returned'),
          metric('Wash schedule', group.washSchedule === null ? 'Not returned' : 'Present · contents not interpreted')),
        note('Totals count dated room nights. Pickup is returned evidence; it does not authorize new reservations or cutoff release.'),
        h('details', { className: 'group-evidence__details' }, h('summary', null, `Allotment details (${group.allotment.length} rows)`),
          group.allotment.length === 0 ? note('No allotment rows returned.') :
          group.allotment.map((row, index) => table(`Allotment ${index + 1} · ${row.unitTypeCode} · ${row.unitTypeName}`, [
            ['Stay date', row.stayDate], ['Blocked room nights', row.blocked], ['Picked-up room nights', row.pickedUp],
            ['Remaining room nights', row.remaining], ['Rate override', row.rateOverride === null ? 'Not returned' : 'Present · contents not interpreted'],
          ], String(index)))),
        h('details', { className: 'group-evidence__details' }, h('summary', null, `Rooming details (${group.roomingList.length} rows)`),
          group.roomingList.length === 0 ? note('No rooming rows returned.') :
          group.roomingList.map((row, index) => {
            const supplied = reservationLinks && Object.hasOwn(reservationLinks, row.reservationId) ? reservationLinks[row.reservationId] : undefined;
            return table(`Rooming row ${index + 1} · ${row.primaryGuestDisplayName}`, [
              ['Confirmation', row.confirmationNo], ['Status', row.status],
              ['Room type', `${row.unitTypeCode ?? 'Code not returned'} · ${row.unitTypeName ?? 'Name not returned'}`],
              ['Stay from', row.stayFrom], ['Stay to', row.stayTo], ['Picked-up nights', row.pickedUpNights],
              ['Reservation', supplied ?? row.reservationId],
            ], String(index));
          })),
        h('details', { className: 'group-evidence__details group-evidence__references' }, h('summary', null, 'References'),
          note(`Group reference: ${group.groupId}`), note(`Account reference: ${group.accountPartyId ?? 'Not returned'}`),
          note(`Master folio reference: ${group.masterFolioId ?? 'Not returned'}`),
          note(`Elastic flag: ${group.elastic ? 'true' : 'false'}`),
          ...group.allotment.map((row, index) => note(`Allotment ${index + 1} room-type reference: ${row.unitTypeId}`)),
          ...group.roomingList.map((row, index) => note(`Rooming ${index + 1} reservation reference: ${row.reservationId}`))));
    }
    return h('section', { key, className: 'group-evidence', 'aria-label': 'Group block and pickup evidence', 'data-evidence-state': evidenceState },
      h('h3', null, 'Group block and pickup'), note(contextLabel),
      evidenceState === 'stale' ? h('p', { role: 'alert', className: 'group-evidence__alert' },
        'Stale evidence · previously read values and links are historical. Read again before using them.') : null, content);
  };
}
