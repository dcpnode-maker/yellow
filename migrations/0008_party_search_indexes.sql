-- Tenant-leading access paths for bounded Party identity search.
CREATE INDEX party_tenant_status_id
  ON party (tenant_id, status, id);

CREATE INDEX contact_point_tenant_kind_value
  ON contact_point (tenant_id, kind, value, party_id);
