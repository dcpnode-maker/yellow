param(
  [string]$ProjectName = "yellow-public-demo",
  [string]$DatabaseName = "yellow_public_demo",
  [string]$PropertyId = "6081b544-22a1-534f-a86d-bb1ae0519e14"
)

$ErrorActionPreference = "Stop"

$sql = @"
WITH property_scope AS (
  SELECT tenant_id, id AS property_node
  FROM org_node
  WHERE id = '$PropertyId'::uuid
    AND kind = 'property'
), registered_type AS (
  INSERT INTO extension_type(type, json_schema)
  VALUES ('commercial_attribution', '{}'::jsonb)
  ON CONFLICT (type) DO UPDATE SET json_schema = EXCLUDED.json_schema
  RETURNING type
), taxonomy AS (
  SELECT property_scope.tenant_id,
         'property:' || property_scope.property_node::text AS extension_key,
         jsonb_build_object(
           'demandGroups', jsonb_build_array(
             jsonb_build_object('code','ALL_BUSINESS','label','All current business','segments',jsonb_build_array(
               jsonb_build_object('code','ALL_SEGMENT','label','All market segments')
             ))
           ),
           'distributionGroups', jsonb_build_array(
             jsonb_build_object('code','ALL_DISTRIBUTION','label','All distribution','sources',jsonb_build_array(
               jsonb_build_object('code','ALL','label','All sources','channelCodes',jsonb_build_array('ALL'))
             ))
           ),
           'companies', '[]'::jsonb,
           'roomClasses', COALESCE((
             SELECT jsonb_agg(jsonb_build_object(
               'code', upper(regexp_replace(unit_type.code, '[^A-Za-z0-9_.-]', '_', 'g')),
               'label', unit_type.name,
               'unitTypeIds', jsonb_build_array(unit_type.id::text)
             ) ORDER BY unit_type.code)
             FROM unit_type
             WHERE unit_type.tenant_id = property_scope.tenant_id
               AND unit_type.property_node = property_scope.property_node
           ), '[]'::jsonb),
           'marketMappings', jsonb_build_array(
             jsonb_build_object('marketCode','ALL','segmentCode','ALL_SEGMENT')
           )
         ) AS content
  FROM property_scope
)
INSERT INTO extension(tenant_id, type, key, version, effective, content, status)
SELECT tenant_id, 'commercial_attribution', extension_key, 1,
       tstzrange('2026-01-01 00:00:00+00'::timestamptz, NULL, '[)'),
       content, 'active'
FROM taxonomy
ON CONFLICT (tenant_id, type, key, version)
DO UPDATE SET effective = EXCLUDED.effective, content = EXCLUDED.content, status = 'active';

SELECT e.tenant_id, e.key, e.version,
       e.content #>> '{demandGroups,0,label}' AS demand_group,
       e.content #>> '{distributionGroups,0,sources,0,label}' AS source
FROM extension e
WHERE e.type = 'commercial_attribution'
  AND e.key = 'property:$PropertyId';
"@

$sql | docker compose -p $ProjectName exec -T postgres psql -v ON_ERROR_STOP=1 -U yellow_deploy -d $DatabaseName
