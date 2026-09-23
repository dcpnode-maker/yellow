-- Financial ownership references must agree on tenant identity at the database edge.
-- The original single-column keys remain for compatibility; these candidate keys
-- support composite tenant-coherent foreign keys without changing entity identity.
ALTER TABLE org_node
  ADD CONSTRAINT org_node_tenant_id_id_uq UNIQUE (tenant_id, id);

ALTER TABLE party
  ADD CONSTRAINT party_tenant_id_id_uq UNIQUE (tenant_id, id);

ALTER TABLE reservation
  ADD CONSTRAINT reservation_tenant_id_id_uq UNIQUE (tenant_id, id);

ALTER TABLE account
  ADD CONSTRAINT account_tenant_id_id_uq UNIQUE (tenant_id, id),
  ADD CONSTRAINT account_tenant_property_fk
    FOREIGN KEY (tenant_id, property_node) REFERENCES org_node (tenant_id, id),
  ADD CONSTRAINT account_tenant_party_fk
    FOREIGN KEY (tenant_id, party_id) REFERENCES party (tenant_id, id);

ALTER TABLE folio
  ADD CONSTRAINT folio_tenant_account_fk
    FOREIGN KEY (tenant_id, account_id) REFERENCES account (tenant_id, id),
  ADD CONSTRAINT folio_tenant_reservation_fk
    FOREIGN KEY (tenant_id, reservation_id) REFERENCES reservation (tenant_id, id),
  ADD CONSTRAINT folio_reservation_window_uq
    UNIQUE (tenant_id, reservation_id, window_no);
