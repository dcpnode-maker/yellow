/** @typedef {Readonly<{spaceId:string, code:string, floor:string|null}>} SpaceReference */
/** @typedef {SpaceReference & Readonly<{claimMode:'exclusive'|'positional'}>} ClaimReference */
/** @typedef {Readonly<{sellableUnitId:string,name:string,status:string,unitTypeId:string,claims:readonly ClaimReference[]}>} Sellable */
/** @typedef {Readonly<{unitTypeId:string,code:string,name:string,sellableUnits:readonly Sellable[]}>} UnitType */
/** @typedef {Readonly<{propertyId:string,unitTypes:readonly UnitType[],unmappedSpaces:readonly SpaceReference[],loadedCounts:Readonly<{unitTypes:number,sellableUnits:number,spaces:number}>,physicalParentHierarchy:'not_recorded',availability:'not_evaluated'}>} RelationshipModel */

/**
 * Render an already admitted buildInventoryRelationships model. No scope admission,
 * availability calculation, event handlers, transport, storage or command authority.
 * Replace the returned element to reset its native disclosures.
 * @param {Document} document
 * @param {RelationshipModel} model
 * @returns {HTMLElement}
 */
export function createInventoryRelationshipsView(document, model) {
  /** @param {string} tag @param {string} className @param {string} [text] */
  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  /** @param {HTMLElement} container @param {string} text */
  const note = (container, text) => container.append(node('p', 'inventory-relationships__note', text));
  /** @param {HTMLElement} container @param {string} text */
  const warning = (container, text) => {
    const element = node('p', 'inventory-relationships__warning', text);
    element.setAttribute('role', 'status');
    container.append(element);
  };
  /** @param {HTMLElement} container @param {string[]} references @param {string} [className] */
  const details = (container, references, className = 'inventory-relationships__details') => {
    const disclosure = node('details', className);
    disclosure.append(node('summary', '', 'Details'));
    references.forEach(reference => disclosure.append(node('p', '', reference)));
    container.append(disclosure);
  };
  /** @param {SpaceReference} space */
  const floorLabel = space => space.floor === null ? 'Floor not recorded' : space.floor === '' ? 'Floor label is empty' : `Floor ${space.floor}`;
  /** @type {Map<string,number>} */
  const references = new Map();
  for (const type of model.unitTypes) for (const unit of type.sellableUnits) for (const claim of unit.claims) {
    const key = claim.spaceId.toLowerCase();
    references.set(key, (references.get(key) ?? 0) + 1);
  }
  const root = node('section', 'inventory-relationships');
  root.setAttribute('aria-label', 'Configured inventory relationships');
  root.append(node('h3', 'inventory-relationships__heading', 'Inventory'));
  root.append(node('p', 'inventory-relationships__counts', `${model.loadedCounts.unitTypes} returned unit types · ${model.loadedCounts.sellableUnits} returned sellable units · ${model.loadedCounts.spaces} returned physical spaces`));
  const status = node('p', 'inventory-relationships__status', 'Configured relationships · availability not evaluated');
  status.setAttribute('role', 'status');
  root.append(status);
  details(root, [
    'These are returned records, not total stock.',
    'A sellable unit references configured physical spaces. Shared references are alternatives using the same space, not independent rooms; do not add them together as stock.',
    'Physical parent hierarchy is not recorded. Availability is not evaluated; configuration does not establish occupancy, sellability or booking permission.',
    `Property reference: ${model.propertyId}`,
  ], 'inventory-relationships__details inventory-relationships__supporting');
  if (model.unitTypes.length === 0) note(root, 'No unit types in returned configuration.');
  const types = node('ul', 'inventory-relationships__types');
  for (const type of model.unitTypes) {
    const typeRow = node('li', 'inventory-relationships__type');
    typeRow.append(node('h4', '', `Unit type ${type.code} · ${type.name}`));
    details(typeRow, [`Unit type reference: ${type.unitTypeId}`]);
    if (type.sellableUnits.length === 0) note(typeRow, 'No sellable units returned for this unit type.');
    const units = node('ul', 'inventory-relationships__units');
    for (const unit of type.sellableUnits) {
      const unitRow = node('li', 'inventory-relationships__unit');
      unitRow.append(node('strong', '', unit.name));
      const knownStatus = unit.status === 'active' || unit.status === 'inactive';
      const statusText = `${knownStatus ? 'Recorded status' : 'Unrecognized recorded status'}: ${unit.status}`;
      if (knownStatus) note(unitRow, statusText); else warning(unitRow, statusText);
      if (unit.claims.length === 0) warning(unitRow, 'No claim mapping returned. This configuration does not establish physical coverage.');
      const claims = node('ul', 'inventory-relationships__claims');
      for (const claim of unit.claims) {
        const claimRow = node('li', 'inventory-relationships__claim');
        claimRow.append(node('strong', '', `Physical space ${claim.code}`));
        note(claimRow, `${floorLabel(claim)} · ${claim.claimMode} claim`);
        if ((references.get(claim.spaceId.toLowerCase()) ?? 0) > 1) note(claimRow, 'Shared physical space reference');
        details(claimRow, [`Space reference: ${claim.spaceId}`]);
        claims.append(claimRow);
      }
      unitRow.append(claims);
      details(unitRow, [`Sellable unit reference: ${unit.sellableUnitId}`, `Unit type reference: ${unit.unitTypeId}`]);
      units.append(unitRow);
    }
    typeRow.append(units);
    types.append(typeRow);
  }
  root.append(types);
  const unmapped = node('section', 'inventory-relationships__unmapped');
  unmapped.setAttribute('aria-label', 'Physical spaces without returned claims');
  unmapped.append(node('h4', '', 'No claim in returned units'));
  if (model.unmappedSpaces.length === 0) note(unmapped, 'No unclaimed physical spaces in returned configuration.');
  const spaces = node('ul', 'inventory-relationships__spaces');
  for (const space of model.unmappedSpaces) {
    const spaceRow = node('li', 'inventory-relationships__space');
    spaceRow.append(node('strong', '', `Physical space ${space.code}`));
    note(spaceRow, floorLabel(space));
    details(spaceRow, [`Space reference: ${space.spaceId}`]);
    spaces.append(spaceRow);
  }
  unmapped.append(spaces);
  root.append(unmapped);
  return root;
}
