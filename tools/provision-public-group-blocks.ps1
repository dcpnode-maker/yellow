param(
  [string]$Container = "yellow-public-demo-postgres-1",
  [string]$Database = "yellow_public_demo",
  [string]$DeployRole = "yellow_deploy"
)

$ErrorActionPreference = "Stop"

function Invoke-Docker {
  param([Parameter(ValueFromRemainingArguments = $true)][object[]]$Args)
  $dockerArgs = @()
  foreach ($arg in $Args) {
    if ($arg -is [array]) {
      foreach ($item in $arg) { $dockerArgs += [string]$item }
    } else {
      $dockerArgs += [string]$arg
    }
  }
  & docker @dockerArgs
  if ($LASTEXITCODE -ne 0) { throw "docker $($dockerArgs -join ' ') failed with exit code $LASTEXITCODE" }
}

$sql = @'
BEGIN;
SELECT set_config('app.tenant_id', '6d9b7ce2-2d14-5576-b8c3-80f06501a603', true);

INSERT INTO block_status_def(tenant_id, code, deducts, sort) VALUES
  ('6d9b7ce2-2d14-5576-b8c3-80f06501a603','tentative',false,10),
  ('6d9b7ce2-2d14-5576-b8c3-80f06501a603','definite',true,20),
  ('6d9b7ce2-2d14-5576-b8c3-80f06501a603','released',false,90)
ON CONFLICT (tenant_id, code) DO UPDATE SET deducts=EXCLUDED.deducts, sort=EXCLUDED.sort;

DO $$
DECLARE
  v_tenant uuid := '6d9b7ce2-2d14-5576-b8c3-80f06501a603';
  v_property uuid := '6081b544-22a1-534f-a86d-bb1ae0519e14';
  v_northstar uuid := '4f70b273-9de4-59d7-80a5-19250f975c47';
  v_horizon uuid := 'd83645f1-b434-583b-baad-f4932951a73d';
  v_l1br uuid := 'e398e16e-5d5c-5cab-b62b-35815cf9368c';
  v_l2br uuid := '6e3aca45-0174-560a-915e-0f143931d402';
  v_mice_group uuid;
  v_social_group uuid;
  v_mice_account uuid;
  v_social_account uuid;
  v_mice_folio uuid;
  v_social_folio uuid;
BEGIN
  SELECT id INTO v_mice_account
  FROM account
  WHERE tenant_id=v_tenant AND property_node=v_property AND role='group_master'
    AND name='Northstar Consulting · MICE master';
  IF v_mice_account IS NULL THEN
    INSERT INTO account(tenant_id, property_node, role, party_id, name, currency)
    VALUES (v_tenant, v_property, 'group_master', v_northstar, 'Northstar Consulting · MICE master', 'SAR')
    RETURNING id INTO v_mice_account;
  END IF;

  SELECT id INTO v_social_account
  FROM account
  WHERE tenant_id=v_tenant AND property_node=v_property AND role='group_master'
    AND name='Horizon Travel · Social group master';
  IF v_social_account IS NULL THEN
    INSERT INTO account(tenant_id, property_node, role, party_id, name, currency)
    VALUES (v_tenant, v_property, 'group_master', v_horizon, 'Horizon Travel · Social group master', 'SAR')
    RETURNING id INTO v_social_account;
  END IF;

  INSERT INTO folio(tenant_id, account_id, reservation_id, folio_no, window_no, name, status)
  VALUES (v_tenant, v_mice_account, NULL, 'GRP-MICE-0926', 1, 'Northstar MICE master folio', 'open')
  ON CONFLICT (tenant_id, folio_no) WHERE folio_no IS NOT NULL DO UPDATE SET name=EXCLUDED.name
  RETURNING id INTO v_mice_folio;

  INSERT INTO folio(tenant_id, account_id, reservation_id, folio_no, window_no, name, status)
  VALUES (v_tenant, v_social_account, NULL, 'GRP-SOC-0928', 1, 'Horizon social master folio', 'open')
  ON CONFLICT (tenant_id, folio_no) WHERE folio_no IS NOT NULL DO UPDATE SET name=EXCLUDED.name
  RETURNING id INTO v_social_folio;

  INSERT INTO reservation_group(tenant_id, property_node, kind, code, name, account_party, status, cutoff_date, elastic, wash_schedule, master_folio)
  VALUES (v_tenant, v_property, 'block', 'LOC-MICE-0926', 'Northstar Leadership Summit', v_northstar, 'definite', DATE '2026-09-24', false,
    '[{"days_before":7,"release_pct":20},{"days_before":3,"release_pct":50}]'::jsonb, v_mice_folio)
  ON CONFLICT (tenant_id, property_node, code) DO UPDATE SET name=EXCLUDED.name, account_party=EXCLUDED.account_party,
    status=EXCLUDED.status, cutoff_date=EXCLUDED.cutoff_date, elastic=EXCLUDED.elastic,
    wash_schedule=EXCLUDED.wash_schedule, master_folio=EXCLUDED.master_folio
  RETURNING id INTO v_mice_group;

  INSERT INTO reservation_group(tenant_id, property_node, kind, code, name, account_party, status, cutoff_date, elastic, wash_schedule, master_folio)
  VALUES (v_tenant, v_property, 'block', 'LOC-SOC-0928', 'Horizon Family Wedding', v_horizon, 'tentative', DATE '2026-09-25', true,
    '[{"days_before":10,"release_pct":25},{"days_before":5,"release_pct":50}]'::jsonb, v_social_folio)
  ON CONFLICT (tenant_id, property_node, code) DO UPDATE SET name=EXCLUDED.name, account_party=EXCLUDED.account_party,
    status=EXCLUDED.status, cutoff_date=EXCLUDED.cutoff_date, elastic=EXCLUDED.elastic,
    wash_schedule=EXCLUDED.wash_schedule, master_folio=EXCLUDED.master_folio
  RETURNING id INTO v_social_group;

  INSERT INTO block_allotment(tenant_id, group_id, unit_type_id, stay_date, blocked, rate_override)
  SELECT v_tenant, v_mice_group, unit_type_id, stay_date, blocked, NULL::jsonb
  FROM (VALUES
    (v_l1br, DATE '2026-09-26', 4), (v_l2br, DATE '2026-09-26', 5),
    (v_l1br, DATE '2026-09-27', 4), (v_l2br, DATE '2026-09-27', 5),
    (v_l1br, DATE '2026-09-28', 3), (v_l2br, DATE '2026-09-28', 4),
    (v_l1br, DATE '2026-09-29', 3), (v_l2br, DATE '2026-09-29', 4)
  ) AS seed(unit_type_id, stay_date, blocked)
  ON CONFLICT (group_id, unit_type_id, stay_date) DO UPDATE SET blocked=EXCLUDED.blocked, rate_override=EXCLUDED.rate_override;

  INSERT INTO block_allotment(tenant_id, group_id, unit_type_id, stay_date, blocked, rate_override)
  SELECT v_tenant, v_social_group, unit_type_id, stay_date, blocked, '{"note":"family-and-social-package"}'::jsonb
  FROM (VALUES
    (v_l1br, DATE '2026-09-28', 6), (v_l2br, DATE '2026-09-28', 4),
    (v_l1br, DATE '2026-09-29', 6), (v_l2br, DATE '2026-09-29', 4),
    (v_l1br, DATE '2026-09-30', 5), (v_l2br, DATE '2026-09-30', 3)
  ) AS seed(unit_type_id, stay_date, blocked)
  ON CONFLICT (group_id, unit_type_id, stay_date) DO UPDATE SET blocked=EXCLUDED.blocked, rate_override=EXCLUDED.rate_override;

  UPDATE reservation SET group_id = NULL
  WHERE tenant_id=v_tenant AND property_node=v_property
    AND group_id IN (v_mice_group, v_social_group)
    AND confirmation_no NOT IN (
      'L3R-FU-0030','L3R-FU-0031','L3R-FU-0032','L3R-FU-0033',
      'L3R-FU-0034','L3R-FU-0035','L3R-FU-0036','L3R-FU-0037'
    );

  UPDATE reservation SET group_id = v_mice_group, market_code='MICE', source_code='CORP'
  WHERE tenant_id=v_tenant AND property_node=v_property
    AND confirmation_no IN ('L3R-FU-0030','L3R-FU-0031','L3R-FU-0032','L3R-FU-0033');
  UPDATE reservation SET group_id = v_social_group, market_code='SOCIAL', source_code='TRAVEL_TRADE'
  WHERE tenant_id=v_tenant AND property_node=v_property
    AND confirmation_no IN ('L3R-FU-0034','L3R-FU-0035','L3R-FU-0036','L3R-FU-0037');
END $$;

COMMIT;

WITH allotment AS (
  SELECT group_id, sum(blocked)::int AS blocked_rooms
  FROM block_allotment
  WHERE tenant_id='6d9b7ce2-2d14-5576-b8c3-80f06501a603'
  GROUP BY group_id
),
pickup AS (
  SELECT group_id, count(DISTINCT id)::int AS picked_reservations
  FROM reservation
  WHERE tenant_id='6d9b7ce2-2d14-5576-b8c3-80f06501a603'
  GROUP BY group_id
)
SELECT rg.code, rg.name, rg.status, COALESCE(allotment.blocked_rooms,0) AS blocked_rooms,
       COALESCE(pickup.picked_reservations,0) AS picked_reservations
FROM reservation_group rg
LEFT JOIN allotment ON allotment.group_id=rg.id
LEFT JOIN pickup ON pickup.group_id=rg.id
WHERE rg.tenant_id='6d9b7ce2-2d14-5576-b8c3-80f06501a603'
  AND rg.property_node='6081b544-22a1-534f-a86d-bb1ae0519e14'
  AND rg.code IN ('LOC-MICE-0926','LOC-SOC-0928')
ORDER BY rg.code;
'@

$tempSql = "/tmp/yellow-public-group-blocks.sql"
$localTemp = Join-Path $env:TEMP "yellow-public-group-blocks.sql"
Set-Content -LiteralPath $localTemp -Value $sql -Encoding UTF8
try {
  Invoke-Docker @("cp", $localTemp, "$($Container):$tempSql")
  Invoke-Docker @("exec", $Container, "psql", "-U", $DeployRole, "-d", $Database, "-v", "ON_ERROR_STOP=1", "-f", $tempSql)
} finally {
  Remove-Item -LiteralPath $localTemp -Force -ErrorAction SilentlyContinue
}
