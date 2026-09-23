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
             jsonb_build_object('code','OTA','label','OTA','segments',jsonb_build_array(
               jsonb_build_object('code','OTA_RETAIL','label','OTA retail')
             )),
             jsonb_build_object('code','RETAIL','label','Retail','segments',jsonb_build_array(
               jsonb_build_object('code','RETAIL','label','Retail direct')
             )),
             jsonb_build_object('code','GROUPS','label','Groups','segments',jsonb_build_array(
               jsonb_build_object('code','MICE','label','MICE'),
               jsonb_build_object('code','SOCIAL','label','Social groups')
             )),
             jsonb_build_object('code','ALL_BUSINESS','label','All current business','segments',jsonb_build_array(
               jsonb_build_object('code','ALL_SEGMENT','label','All market segments')
             ))
           ),
           'distributionGroups', jsonb_build_array(
             jsonb_build_object('code','OTA','label','OTA','sources',jsonb_build_array(
               jsonb_build_object('code','BOOKING','label','Booking.com','channelCodes',jsonb_build_array('BOOKING.COM')),
               jsonb_build_object('code','AIRBNB','label','Airbnb','channelCodes',jsonb_build_array('AIRBNB')),
               jsonb_build_object('code','EXPEDIA','label','Expedia','channelCodes',jsonb_build_array('EXPEDIA')),
               jsonb_build_object('code','AGODA','label','Agoda','channelCodes',jsonb_build_array('AGODA'))
             )),
             jsonb_build_object('code','DIRECT','label','Direct','sources',jsonb_build_array(
               jsonb_build_object('code','WEBSITE','label','Website','channelCodes',jsonb_build_array('DIRECT','WEBSITE','WEB'))
             )),
             jsonb_build_object('code','TRADE','label','Travel trade','sources',jsonb_build_array(
               jsonb_build_object('code','TRAVEL_TRADE','label','Travel trade','channelCodes',jsonb_build_array('TRAVEL_TRADE')),
               jsonb_build_object('code','CORP','label','Corporate','channelCodes',jsonb_build_array('CORP'))
             )),
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
             jsonb_build_object('marketCode','OTA_RETAIL','segmentCode','OTA_RETAIL'),
             jsonb_build_object('marketCode','RETAIL','segmentCode','RETAIL'),
             jsonb_build_object('marketCode','MICE','segmentCode','MICE'),
             jsonb_build_object('marketCode','SOCIAL','segmentCode','SOCIAL'),
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
       jsonb_array_length(e.content->'demandGroups') AS demand_groups,
       jsonb_array_length(e.content->'distributionGroups') AS distribution_groups
FROM extension e
WHERE e.type = 'commercial_attribution'
  AND e.key = 'property:$PropertyId';
"@

$sql | docker compose -p $ProjectName exec -T postgres psql -v ON_ERROR_STOP=1 -U yellow_deploy -d $DatabaseName
