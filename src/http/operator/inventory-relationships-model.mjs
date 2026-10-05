// Read-only configured relationships, not a physical parent tree or sellability calculation.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function fail(message) { throw new Error(`Inventory relationships: ${message}`); }
function id(value) { if (typeof value !== 'string' || !UUID.test(value)) fail('invalid identity'); return value.toLowerCase(); }
function label(value) { if (typeof value !== 'string' || !value.trim()) fail('missing label'); return value; }
function index(rows, scope) {
  if (!Array.isArray(rows)) fail('missing configured records');
  const map = new Map();
  for (const row of rows) {
    if (!row || typeof row !== 'object' || id(row.propertyNode) !== id(scope.propertyId) || id(row.tenantId) !== id(scope.tenantId)) fail('record is outside requested scope');
    const key = id(row.id); if (map.has(key)) fail('duplicate identity'); map.set(key, row);
  }
  return map;
}
export function buildInventoryRelationships(inventory, scope) {
  if (!scope || typeof scope !== 'object' || !inventory || typeof inventory !== 'object') fail('scope and inventory are required');
  id(scope.propertyId); id(scope.tenantId);
  const types = index(inventory.unitTypes, scope), spaces = index(inventory.spaces, scope), units = index(inventory.sellableUnits, scope);
  for (const type of types.values()) { label(type.code); label(type.name); }
  for (const space of spaces.values()) { label(space.code); if (!(space.floor === null || typeof space.floor === 'string')) fail('invalid floor'); }
  const used = new Set();
  const unitViews = [...units.values()].map(unit => {
    const type = types.get(id(unit.unitTypeId)); if (!type || unit.unitTypeCode !== type.code) fail('unit type reference is incoherent');
    label(unit.name); label(unit.status);
    if (!Array.isArray(unit.spaces)) fail('missing claim mapping');
    const seen = new Set();
    const claims = unit.spaces.map(claim => {
      if (!claim || typeof claim !== 'object') fail('invalid claim mapping');
      const key = id(claim.spaceId), space = spaces.get(key);
      if (!space || claim.code !== space.code || !['exclusive', 'positional'].includes(claim.claimMode) || seen.has(key)) fail('space claim reference is incoherent');
      seen.add(key); used.add(key);
      return Object.freeze({ spaceId: space.id, code: space.code, floor: space.floor, claimMode: claim.claimMode });
    });
    return Object.freeze({ sellableUnitId: unit.id, name: unit.name, status: unit.status, unitTypeId: type.id, claims: Object.freeze(claims) });
  });
  return Object.freeze({ propertyId: scope.propertyId,
    unitTypes: Object.freeze([...types.values()].map(type => Object.freeze({ unitTypeId: type.id, code: type.code, name: type.name,
      sellableUnits: Object.freeze(unitViews.filter(unit => id(unit.unitTypeId) === id(type.id))) }))),
    unmappedSpaces: Object.freeze([...spaces.values()].filter(space => !used.has(id(space.id))).map(space => Object.freeze({ spaceId: space.id, code: space.code, floor: space.floor }))),
    loadedCounts: Object.freeze({ unitTypes: types.size, sellableUnits: units.size, spaces: spaces.size }),
    physicalParentHierarchy: 'not_recorded', availability: 'not_evaluated' });
}
