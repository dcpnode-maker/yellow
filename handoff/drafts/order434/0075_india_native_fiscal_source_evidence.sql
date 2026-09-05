-- Order434 source-intake expansion (WORK IN PROGRESS).
-- This file is not the complete 0075 candidate: dependent timing and the exact
-- native valuation/applicability/tax/accounting/origin unions must be appended
-- before publication. 0076 must finish the source graph before issue is granted.
-- Preserve every legacy source column, preimage and externally supplied digest.
REVOKE ALL ON FUNCTION public.commit_india_native_fiscal_invoice(
  uuid,uuid,uuid,uuid,uuid,uuid,text,jsonb,uuid
) FROM PUBLIC,app_role,yellow_runtime;

ALTER TABLE public.india_gst_accommodation_service_provision_snapshot
  ADD COLUMN recording_actor_id uuid,
  ADD COLUMN recording_request_id uuid,
  ADD COLUMN request_key_hash text,
  ADD COLUMN request_hash text,
  ADD COLUMN recorded_at timestamptz,
  ADD COLUMN evidence_hash text,
  ADD CONSTRAINT india_service_recording_actor_fk
    FOREIGN KEY (tenant_id,recording_actor_id) REFERENCES public.app_user(tenant_id,id),
  ADD CONSTRAINT india_service_recording_shape_ck CHECK (
    pg_catalog.num_nonnulls(recording_actor_id,recording_request_id,
      request_key_hash,request_hash,recorded_at,evidence_hash)=0
    OR (pg_catalog.num_nonnulls(recording_actor_id,recording_request_id,
      request_key_hash,request_hash,recorded_at,evidence_hash)=6
      AND request_key_hash ~ '^[0-9a-f]{64}$'
      AND request_hash ~ '^[0-9a-f]{64}$'
      AND evidence_hash ~ '^[0-9a-f]{64}$'
      AND pg_catalog.isfinite(recorded_at))
  ),
  ADD CONSTRAINT india_service_recording_key_uq UNIQUE (tenant_id,request_key_hash),
  ADD CONSTRAINT india_service_recorded_identity_uq UNIQUE (
    tenant_id,id,property_node,reservation_lineage_id,hold_binding_id,
    attribution_id,reservation_id,segment_id,origin_quote_hash,snapshot_hash,
    currency,service_provision_date,service_provision_evidence_sha256,evidence_hash
  );

ALTER TABLE public.india_gst_accommodation_payment_receipt_snapshot
  ADD COLUMN recording_actor_id uuid,
  ADD COLUMN recording_request_id uuid,
  ADD COLUMN request_key_hash text,
  ADD COLUMN request_hash text,
  ADD COLUMN recorded_at timestamptz,
  ADD COLUMN evidence_hash text,
  ADD CONSTRAINT india_payment_recording_actor_fk
    FOREIGN KEY (tenant_id,recording_actor_id) REFERENCES public.app_user(tenant_id,id),
  ADD CONSTRAINT india_payment_recording_shape_ck CHECK (
    pg_catalog.num_nonnulls(recording_actor_id,recording_request_id,
      request_key_hash,request_hash,recorded_at,evidence_hash)=0
    OR (pg_catalog.num_nonnulls(recording_actor_id,recording_request_id,
      request_key_hash,request_hash,recorded_at,evidence_hash)=6
      AND request_key_hash ~ '^[0-9a-f]{64}$'
      AND request_hash ~ '^[0-9a-f]{64}$'
      AND evidence_hash ~ '^[0-9a-f]{64}$'
      AND pg_catalog.isfinite(recorded_at))
  ),
  ADD CONSTRAINT india_payment_recording_key_uq UNIQUE (tenant_id,request_key_hash);

CREATE TABLE public.india_gst_accommodation_ordinary_regime_evidence (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT pg_catalog.gen_random_uuid(),
  property_node uuid NOT NULL,
  reservation_id uuid NOT NULL,
  service_provision_snapshot_id uuid NOT NULL,
  reservation_lineage_id uuid NOT NULL,
  hold_binding_id uuid NOT NULL,
  attribution_id uuid NOT NULL,
  segment_id uuid NOT NULL,
  origin_quote_hash text NOT NULL CHECK (origin_quote_hash ~ '^[0-9a-f]{64}$'),
  snapshot_hash text NOT NULL CHECK (snapshot_hash ~ '^[0-9a-f]{64}$'),
  currency char(3) NOT NULL CHECK (currency='INR'),
  service_provision_date date NOT NULL CHECK (pg_catalog.isfinite(service_provision_date)),
  service_provision_evidence_sha256 text NOT NULL
    CHECK (service_provision_evidence_sha256 ~ '^[0-9a-f]{64}$'),
  service_evidence_hash text NOT NULL CHECK (service_evidence_hash ~ '^[0-9a-f]{64}$'),
  regime text NOT NULL CHECK (regime='ordinary_rule47_30_day'),
  ordinary_regime_source text NOT NULL
    CHECK (ordinary_regime_source='governed_rule47_ordinary_regime_record'),
  legal_basis text NOT NULL
    CHECK (legal_basis='CGST_RULE_47_ORDINARY_SERVICE_INVOICE_30_DAY_INPUT'),
  ordinary_regime_evidence_sha256 text NOT NULL
    CHECK (ordinary_regime_evidence_sha256 ~ '^[0-9a-f]{64}$'),
  recording_actor_id uuid NOT NULL,
  recording_request_id uuid NOT NULL,
  request_key_hash text NOT NULL CHECK (request_key_hash ~ '^[0-9a-f]{64}$'),
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  recorded_at timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp()
    CHECK (pg_catalog.isfinite(recorded_at)),
  evidence_hash text NOT NULL CHECK (evidence_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT india_ordinary_evidence_pk PRIMARY KEY (tenant_id,id),
  CONSTRAINT india_ordinary_evidence_service_uq
    UNIQUE (tenant_id,service_provision_snapshot_id),
  CONSTRAINT india_ordinary_evidence_key_uq UNIQUE (tenant_id,request_key_hash),
  CONSTRAINT india_ordinary_evidence_actor_fk
    FOREIGN KEY (tenant_id,recording_actor_id) REFERENCES public.app_user(tenant_id,id),
  CONSTRAINT india_ordinary_evidence_property_fk
    FOREIGN KEY (tenant_id,property_node) REFERENCES public.org_node(tenant_id,id),
  CONSTRAINT india_ordinary_evidence_service_fk FOREIGN KEY (
    tenant_id,service_provision_snapshot_id,property_node,reservation_lineage_id,
    hold_binding_id,attribution_id,reservation_id,segment_id,origin_quote_hash,
    snapshot_hash,currency,service_provision_date,service_provision_evidence_sha256,
    service_evidence_hash
  ) REFERENCES public.india_gst_accommodation_service_provision_snapshot (
    tenant_id,id,property_node,reservation_lineage_id,hold_binding_id,attribution_id,
    reservation_id,segment_id,origin_quote_hash,snapshot_hash,currency,
    service_provision_date,service_provision_evidence_sha256,evidence_hash
  )
);
CREATE INDEX india_ordinary_evidence_scope
  ON public.india_gst_accommodation_ordinary_regime_evidence
    (tenant_id,property_node,reservation_id,recorded_at,id);
ALTER TABLE public.india_gst_accommodation_ordinary_regime_evidence
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.india_gst_accommodation_ordinary_regime_evidence
  FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation
  ON public.india_gst_accommodation_ordinary_regime_evidence
  USING (tenant_id=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid)
  WITH CHECK (tenant_id=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid);
ALTER TABLE public.india_gst_accommodation_ordinary_regime_evidence OWNER TO yellow_owner;
REVOKE ALL ON TABLE public.india_gst_accommodation_ordinary_regime_evidence
  FROM PUBLIC,app_role,yellow_runtime;
GRANT SELECT ON TABLE public.india_gst_accommodation_ordinary_regime_evidence TO app_role;

-- Canonical JSON for these private server-owned preimages: object keys sorted
-- bytewise, compact separators, array order retained. This also replays the
-- existing Order240 attribution snapshot's sorted-key SHA256 without changing it.
CREATE FUNCTION public.india_native_source_canonical_json(p_value jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE STRICT
SET search_path=pg_catalog,public
AS $$
DECLARE v_result text;
BEGIN
  CASE pg_catalog.jsonb_typeof(p_value)
    WHEN 'object' THEN
      SELECT '{'||COALESCE(pg_catalog.string_agg(
        pg_catalog.to_jsonb(e.key)::text||':'||
        public.india_native_source_canonical_json(e.value),','
        ORDER BY e.key COLLATE "C"),'')||'}'
        INTO v_result FROM pg_catalog.jsonb_each(p_value) e;
    WHEN 'array' THEN
      SELECT '['||COALESCE(pg_catalog.string_agg(
        public.india_native_source_canonical_json(e.value),',' ORDER BY e.ordinality),'')||']'
        INTO v_result
        FROM pg_catalog.jsonb_array_elements(p_value) WITH ORDINALITY e(value,ordinality);
    ELSE v_result:=p_value::text;
  END CASE;
  RETURN v_result;
END;
$$;
ALTER FUNCTION public.india_native_source_canonical_json(jsonb) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.india_native_source_canonical_json(jsonb)
  FROM PUBLIC,app_role,yellow_runtime;

CREATE FUNCTION public.india_native_source_hash(p_value jsonb)
RETURNS text LANGUAGE sql IMMUTABLE STRICT
SET search_path=pg_catalog,public
AS $$
  SELECT pg_catalog.encode(public.digest(pg_catalog.convert_to(
    public.india_native_source_canonical_json(p_value),'UTF8'),'sha256'),'hex')
$$;
ALTER FUNCTION public.india_native_source_hash(jsonb) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.india_native_source_hash(jsonb) FROM PUBLIC,app_role,yellow_runtime;

CREATE FUNCTION public.prevent_india_native_intake_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public
AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='India accommodation source evidence is immutable';
END;
$$;
ALTER FUNCTION public.prevent_india_native_intake_mutation() OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.prevent_india_native_intake_mutation()
  FROM PUBLIC,app_role,yellow_runtime;
CREATE TRIGGER india_service_evidence_immutable BEFORE UPDATE OR DELETE
  ON public.india_gst_accommodation_service_provision_snapshot
  FOR EACH ROW EXECUTE FUNCTION public.prevent_india_native_intake_mutation();
CREATE TRIGGER india_payment_evidence_immutable BEFORE UPDATE OR DELETE
  ON public.india_gst_accommodation_payment_receipt_snapshot
  FOR EACH ROW EXECUTE FUNCTION public.prevent_india_native_intake_mutation();
CREATE TRIGGER india_ordinary_evidence_immutable BEFORE UPDATE OR DELETE
  ON public.india_gst_accommodation_ordinary_regime_evidence
  FOR EACH ROW EXECUTE FUNCTION public.prevent_india_native_intake_mutation();

-- Invoker-only private helper: the three governed SECURITY DEFINER entry points
-- supply yellow_owner. Lock every row carrying the current authorization before
-- any permanent replay or publication. Existing user_role has no expiry column;
-- the exact current grant and active actor/tenant are the supported authority.
CREATE FUNCTION public.lock_india_native_intake_authority(
  p_tenant uuid,p_property uuid,p_reservation uuid,p_request uuid,p_actor uuid,
  p_key text,p_operation text
) RETURNS date LANGUAGE plpgsql VOLATILE
SET search_path=pg_catalog,public
AS $$
DECLARE v_context uuid; v_date date;
BEGIN
  IF session_user<>'yellow_runtime'
     OR pg_catalog.current_setting('role',true) IS DISTINCT FROM 'app_role'
     OR current_user<>'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='source intake requires governed runtime authority';
  END IF;
  BEGIN
    v_context:=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='source intake tenant context is invalid';
  END;
  IF p_tenant IS NULL OR v_context IS NULL OR v_context<>p_tenant THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='source intake tenant context is invalid';
  END IF;
  IF p_property IS NULL OR p_reservation IS NULL OR p_request IS NULL OR p_actor IS NULL
     OR p_key IS NULL OR p_key COLLATE "C" !~ '^[!-~]{8,200}$'
     OR p_operation IS NULL OR p_operation NOT IN ('service','payment','ordinary','valuation') THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='source intake identity or idempotency key is invalid';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'india-native-intake-scope:'||p_tenant::text||':'||p_reservation::text,434));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'india-native-intake-request:'||p_tenant::text||':'||p_operation||':'||
    pg_catalog.encode(public.digest(p_key,'sha256'),'hex'),434));
  PERFORM 1 FROM public.tenant t WHERE t.id=p_tenant AND t.status='active' FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='source intake authority unavailable';
  END IF;
  SELECT (pg_catalog.transaction_timestamp() AT TIME ZONE property.timezone)::date
    INTO v_date
    FROM public.app_user actor
    JOIN public.user_role ur ON ur.tenant_id=actor.tenant_id AND ur.user_id=actor.id
    JOIN public.role role_row ON role_row.tenant_id=ur.tenant_id AND role_row.id=ur.role_id
    JOIN public.role_permission rp ON rp.role_id=role_row.id
      AND rp.permission_code='tax-fiscal.india-valuation:finalize'
    JOIN public.permission permission_row ON permission_row.code=rp.permission_code
    JOIN public.org_node grant_node ON grant_node.tenant_id=ur.tenant_id
      AND grant_node.id=ur.scope_node
    JOIN public.org_node property ON property.tenant_id=actor.tenant_id
      AND property.id=p_property AND property.kind='property' AND property.currency='INR'
      AND grant_node.path @> property.path
    WHERE actor.tenant_id=p_tenant AND actor.id=p_actor AND actor.status='active'
    ORDER BY role_row.id,grant_node.id
    FOR SHARE OF actor,ur,role_row,rp,permission_row,grant_node,property;
  IF NOT FOUND OR v_date IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='actor lacks property valuation authority';
  END IF;
  RETURN v_date;
END;
$$;
ALTER FUNCTION public.lock_india_native_intake_authority(uuid,uuid,uuid,uuid,uuid,text,text)
  OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.lock_india_native_intake_authority(uuid,uuid,uuid,uuid,uuid,text,text)
  FROM PUBLIC,app_role,yellow_runtime;

-- Resolve and lock typed lineage before using any nested JSON. No caller
-- snapshot, amount or purported source graph participates in this lookup.
CREATE FUNCTION public.lock_india_native_intake_lineage(
  p_tenant uuid,p_property uuid,p_reservation uuid,p_lineage uuid
) RETURNS public.tax_attribution_reservation_binding LANGUAGE plpgsql VOLATILE
SET search_path=pg_catalog,public
AS $$
DECLARE
  v_lineage public.tax_attribution_reservation_binding%ROWTYPE;
  v_attribution public.tax_attribution_snapshot%ROWTYPE;
BEGIN
  SELECT lineage.* INTO v_lineage
    FROM public.tax_attribution_reservation_binding lineage
    JOIN public.tax_attribution_hold_binding hb
      ON hb.tenant_id=lineage.tenant_id AND hb.id=lineage.binding_id
      AND hb.property_node=lineage.property_node AND hb.hold_id=lineage.hold_id
      AND hb.attribution_id=lineage.attribution_id AND hb.sellable_unit_id=lineage.sellable_unit_id
      AND hb.period=lineage.period AND hb.origin_quote_hash=lineage.origin_quote_hash
      AND hb.snapshot_hash=lineage.snapshot_hash AND hb.currency=lineage.currency
    JOIN public.tax_attribution_snapshot attribution
      ON attribution.tenant_id=hb.tenant_id AND attribution.id=hb.attribution_id
      AND attribution.property_node=hb.property_node AND attribution.actor_id=hb.bound_by
      AND attribution.origin_kind='rate_quote' AND attribution.schema_version=1
      AND attribution.origin_quote_hash=hb.origin_quote_hash
      AND attribution.snapshot_hash=hb.snapshot_hash AND attribution.currency=hb.currency
    JOIN public.hold h ON h.tenant_id=lineage.tenant_id AND h.id=lineage.hold_id
      AND h.property_node=lineage.property_node AND h.sellable_unit_id=lineage.sellable_unit_id
      AND h.period=lineage.period AND h.kind='cart' AND h.status='consumed'
    JOIN public.reservation reservation
      ON reservation.tenant_id=lineage.tenant_id AND reservation.id=lineage.reservation_id
      AND reservation.property_node=lineage.property_node AND reservation.currency=lineage.currency
    JOIN public.reservation_segment segment
      ON segment.tenant_id=lineage.tenant_id AND segment.id=lineage.segment_id
      AND segment.reservation_id=lineage.reservation_id
      AND segment.sellable_unit_id=lineage.sellable_unit_id AND segment.period=lineage.period
    WHERE lineage.tenant_id=p_tenant AND lineage.id=p_lineage
      AND lineage.property_node=p_property AND lineage.reservation_id=p_reservation
      AND lineage.currency='INR'
    FOR SHARE OF lineage,hb,attribution,h,reservation,segment;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='complete accommodation attribution lineage unavailable';
  END IF;
  SELECT attribution.* INTO STRICT v_attribution
    FROM public.tax_attribution_snapshot attribution
    WHERE attribution.tenant_id=p_tenant AND attribution.id=v_lineage.attribution_id;
  IF v_attribution.snapshot->>'snapshotHash' IS DISTINCT FROM v_lineage.snapshot_hash
     OR v_attribution.snapshot->>'currency' IS DISTINCT FROM 'INR'
     OR v_attribution.snapshot->'origin'->>'quoteHash' IS DISTINCT FROM v_lineage.origin_quote_hash
     OR pg_catalog.jsonb_typeof(v_attribution.snapshot->'evaluation') IS DISTINCT FROM 'object'
     OR v_attribution.snapshot->'evaluation'->'schemaVersion' IS DISTINCT FROM '1'::jsonb
     OR v_attribution.snapshot->'evaluation'->>'country' IS DISTINCT FROM 'IN'
     OR pg_catalog.jsonb_typeof(v_attribution.snapshot->'evaluation'->'grandTotalMinor')
        IS DISTINCT FROM 'string'
     OR public.india_native_source_hash(v_attribution.snapshot-'snapshotHash')
        IS DISTINCT FROM v_lineage.snapshot_hash THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='canonical attribution snapshot identity is inconsistent';
  END IF;
  RETURN v_lineage;
END;
$$;
ALTER FUNCTION public.lock_india_native_intake_lineage(uuid,uuid,uuid,uuid) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.lock_india_native_intake_lineage(uuid,uuid,uuid,uuid)
  FROM PUBLIC,app_role,yellow_runtime;

CREATE FUNCTION public.record_india_gst_accommodation_service_provision(
  p_tenant uuid,p_property uuid,p_reservation uuid,p_lineage uuid,p_service_date date,
  p_external_sha text,p_request uuid,p_actor uuid,p_key text
) RETURNS TABLE(service_provision_snapshot_id uuid,
  service_provision_evidence_sha256 text,evidence_hash text,created boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD'
AS $$
DECLARE
  v_date date; v_key_hash text; v_request_hash text;
  v_lineage public.tax_attribution_reservation_binding%ROWTYPE;
  v_row public.india_gst_accommodation_service_provision_snapshot%ROWTYPE;
  v_payload jsonb;
BEGIN
  v_date:=public.lock_india_native_intake_authority(
    p_tenant,p_property,p_reservation,p_request,p_actor,p_key,'service');
  IF p_lineage IS NULL OR p_service_date IS NULL OR NOT pg_catalog.isfinite(p_service_date)
     OR p_service_date NOT BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'
     OR p_external_sha IS NULL OR p_external_sha !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='service provision evidence is invalid';
  END IF;
  v_key_hash:=pg_catalog.encode(public.digest(p_key,'sha256'),'hex');
  -- The audit request UUID is deliberately outside semantic request identity.
  v_request_hash:=public.india_native_source_hash(pg_catalog.jsonb_build_array(
    'india-native-service-request-v1',p_tenant,p_property,p_reservation,p_lineage,
    p_service_date,p_external_sha,p_actor));
  SELECT s.* INTO v_row FROM public.india_gst_accommodation_service_provision_snapshot s
    WHERE s.tenant_id=p_tenant AND s.request_key_hash=v_key_hash FOR SHARE;
  IF FOUND THEN
    IF v_row.request_hash IS DISTINCT FROM v_request_hash THEN
      RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='service request key has different actor or evidence';
    END IF;
    RETURN QUERY SELECT v_row.id,v_row.service_provision_evidence_sha256,v_row.evidence_hash,false;
    RETURN;
  END IF;
  v_lineage:=public.lock_india_native_intake_lineage(p_tenant,p_property,p_reservation,p_lineage);
  IF EXISTS(SELECT 1 FROM public.india_gst_accommodation_service_provision_snapshot s
      WHERE s.tenant_id=p_tenant AND s.reservation_lineage_id=p_lineage
        AND s.service_provision_date=p_service_date) THEN
    RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='service date already has immutable evidence';
  END IF;
  v_row.tenant_id:=p_tenant; v_row.id:=pg_catalog.gen_random_uuid();
  v_row.property_node:=p_property; v_row.reservation_lineage_id:=v_lineage.id;
  v_row.hold_binding_id:=v_lineage.binding_id; v_row.attribution_id:=v_lineage.attribution_id;
  v_row.reservation_id:=p_reservation; v_row.segment_id:=v_lineage.segment_id;
  v_row.origin_quote_hash:=v_lineage.origin_quote_hash; v_row.snapshot_hash:=v_lineage.snapshot_hash;
  v_row.currency:='INR'; v_row.service_provision_date:=p_service_date;
  v_row.service_provision_source:='governed_service_provision_record';
  v_row.service_provision_evidence_sha256:=p_external_sha;
  v_row.legal_rule:='CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY';
  v_row.recording_actor_id:=p_actor; v_row.recording_request_id:=p_request;
  v_row.request_key_hash:=v_key_hash; v_row.request_hash:=v_request_hash;
  v_row.recorded_at:=pg_catalog.transaction_timestamp();
  v_row.evidence_hash:=public.india_native_source_hash(pg_catalog.jsonb_build_array(
    'india-native-service-root-v1',pg_catalog.to_jsonb(v_row)-'evidence_hash',
    pg_catalog.to_jsonb(v_lineage)));
  INSERT INTO public.india_gst_accommodation_service_provision_snapshot SELECT (v_row).*;
  v_payload:=pg_catalog.jsonb_build_object('serviceProvisionSnapshotId',v_row.id,
    'reservationId',p_reservation,'attributionId',v_lineage.attribution_id,'evidenceHash',v_row.evidence_hash);
  INSERT INTO public.fact_log(tenant_id,entity_type,entity_id,fact_type,valid_from,business_date,actor_id,payload)
    VALUES(p_tenant,'india_gst_accommodation_service_provision_snapshot',v_row.id,
      'recorded',v_row.recorded_at,v_date,p_actor,v_payload);
  PERFORM pg_catalog.pg_advisory_xact_lock(6441674055002974568);
  INSERT INTO public.outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,
    event_type,event_version,actor_id,correlation_id,payload)
    VALUES(p_tenant,p_property,v_date,'india_gst_accommodation_service_provision_snapshot',
      v_row.id,'india_gst.accommodation_service_provision_recorded',1,p_actor,p_request,v_payload);
  RETURN QUERY SELECT v_row.id,v_row.service_provision_evidence_sha256,v_row.evidence_hash,true;
END;
$$;
ALTER FUNCTION public.record_india_gst_accommodation_service_provision(
  uuid,uuid,uuid,uuid,date,text,uuid,uuid,text) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.record_india_gst_accommodation_service_provision(
  uuid,uuid,uuid,uuid,date,text,uuid,uuid,text) FROM PUBLIC,app_role,yellow_runtime;
GRANT EXECUTE ON FUNCTION public.record_india_gst_accommodation_service_provision(
  uuid,uuid,uuid,uuid,date,text,uuid,uuid,text) TO app_role;

CREATE FUNCTION public.record_india_gst_accommodation_payment_receipt(
  p_tenant uuid,p_property uuid,p_reservation uuid,p_service uuid,p_expected_amount bigint,
  p_books_date date,p_bank_date date,p_external_sha text,p_request uuid,p_actor uuid,p_key text
) RETURNS TABLE(payment_receipt_snapshot_id uuid,
  payment_receipt_evidence_sha256 text,evidence_hash text,created boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD'
AS $$
DECLARE
  v_date date; v_key_hash text; v_request_hash text; v_amount_text text; v_amount bigint;
  v_lineage public.tax_attribution_reservation_binding%ROWTYPE;
  v_service public.india_gst_accommodation_service_provision_snapshot%ROWTYPE;
  v_row public.india_gst_accommodation_payment_receipt_snapshot%ROWTYPE;
  v_payload jsonb;
BEGIN
  v_date:=public.lock_india_native_intake_authority(
    p_tenant,p_property,p_reservation,p_request,p_actor,p_key,'payment');
  IF p_service IS NULL OR p_expected_amount IS NULL OR p_expected_amount<=0
     OR p_books_date IS NULL OR p_bank_date IS NULL
     OR NOT pg_catalog.isfinite(p_books_date) OR NOT pg_catalog.isfinite(p_bank_date)
     OR p_books_date NOT BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'
     OR p_bank_date NOT BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'
     OR p_external_sha IS NULL OR p_external_sha !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='payment receipt evidence is invalid';
  END IF;
  v_key_hash:=pg_catalog.encode(public.digest(p_key,'sha256'),'hex');
  v_request_hash:=public.india_native_source_hash(pg_catalog.jsonb_build_array(
    'india-native-payment-request-v1',p_tenant,p_property,p_reservation,p_service,
    p_expected_amount::text,p_books_date,p_bank_date,p_external_sha,p_actor));
  SELECT s.* INTO v_row FROM public.india_gst_accommodation_payment_receipt_snapshot s
    WHERE s.tenant_id=p_tenant AND s.request_key_hash=v_key_hash FOR SHARE;
  IF FOUND THEN
    IF v_row.request_hash IS DISTINCT FROM v_request_hash THEN
      RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='payment request key has different actor or evidence';
    END IF;
    RETURN QUERY SELECT v_row.id,v_row.payment_receipt_evidence_sha256,v_row.evidence_hash,false;
    RETURN;
  END IF;
  SELECT s.* INTO v_service FROM public.india_gst_accommodation_service_provision_snapshot s
    WHERE s.tenant_id=p_tenant AND s.id=p_service AND s.property_node=p_property
      AND s.reservation_id=p_reservation AND s.currency='INR' AND s.evidence_hash IS NOT NULL
    FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='governed service provision source unavailable';
  END IF;
  v_lineage:=public.lock_india_native_intake_lineage(
    p_tenant,p_property,p_reservation,v_service.reservation_lineage_id);
  IF public.india_native_source_hash(pg_catalog.jsonb_build_array(
       'india-native-service-root-v1',pg_catalog.to_jsonb(v_service)-'evidence_hash',
       pg_catalog.to_jsonb(v_lineage))) IS DISTINCT FROM v_service.evidence_hash THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='service provision root hash is inconsistent';
  END IF;
  SELECT a.snapshot->'evaluation'->>'grandTotalMinor' INTO v_amount_text
    FROM public.tax_attribution_snapshot a
    WHERE a.tenant_id=p_tenant AND a.id=v_lineage.attribution_id;
  IF v_amount_text IS NULL OR v_amount_text !~ '^[1-9][0-9]{0,18}$' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='full-attribution amount is unavailable';
  END IF;
  BEGIN v_amount:=v_amount_text::bigint;
  EXCEPTION WHEN numeric_value_out_of_range THEN
    RAISE EXCEPTION USING ERRCODE='22003',MESSAGE='full-attribution amount exceeds signed int64';
  END;
  IF p_expected_amount<>v_amount THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='payment expected amount differs from canonical full attribution';
  END IF;
  IF EXISTS(SELECT 1 FROM public.india_gst_accommodation_payment_receipt_snapshot s
    WHERE s.tenant_id=p_tenant AND s.service_provision_snapshot_id=p_service) THEN
    RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='service already has immutable payment receipt evidence';
  END IF;
  v_row.tenant_id:=p_tenant; v_row.id:=pg_catalog.gen_random_uuid();
  v_row.service_provision_snapshot_id:=p_service; v_row.currency:='INR'; v_row.amount_minor:=v_amount;
  v_row.coverage_scope:='full_attribution'; v_row.supplier_books_entry_date:=p_books_date;
  v_row.supplier_bank_credit_date:=p_bank_date; v_row.payment_receipt_date:=LEAST(p_books_date,p_bank_date);
  v_row.payment_receipt_source:='governed_supplier_payment_receipt_record';
  v_row.payment_receipt_evidence_sha256:=p_external_sha;
  v_row.legal_rule:='CGST_ACT_13_2_EXPLANATION_II_PAYMENT_RECEIPT_DATE_INPUT_ONLY';
  v_row.recording_actor_id:=p_actor; v_row.recording_request_id:=p_request;
  v_row.request_key_hash:=v_key_hash; v_row.request_hash:=v_request_hash;
  v_row.recorded_at:=pg_catalog.transaction_timestamp();
  v_row.evidence_hash:=public.india_native_source_hash(pg_catalog.jsonb_build_array(
    'india-native-payment-root-v1',pg_catalog.to_jsonb(v_row)-'evidence_hash',
    pg_catalog.to_jsonb(v_service),pg_catalog.to_jsonb(v_lineage)));
  INSERT INTO public.india_gst_accommodation_payment_receipt_snapshot SELECT (v_row).*;
  v_payload:=pg_catalog.jsonb_build_object('paymentReceiptSnapshotId',v_row.id,
    'serviceProvisionSnapshotId',p_service,'reservationId',p_reservation,'evidenceHash',v_row.evidence_hash);
  INSERT INTO public.fact_log(tenant_id,entity_type,entity_id,fact_type,valid_from,business_date,actor_id,payload)
    VALUES(p_tenant,'india_gst_accommodation_payment_receipt_snapshot',v_row.id,
      'recorded',v_row.recorded_at,v_date,p_actor,v_payload);
  PERFORM pg_catalog.pg_advisory_xact_lock(6441674055002974568);
  INSERT INTO public.outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,
    event_type,event_version,actor_id,correlation_id,payload)
    VALUES(p_tenant,p_property,v_date,'india_gst_accommodation_payment_receipt_snapshot',
      v_row.id,'india_gst.accommodation_payment_receipt_recorded',1,p_actor,p_request,v_payload);
  RETURN QUERY SELECT v_row.id,v_row.payment_receipt_evidence_sha256,v_row.evidence_hash,true;
END;
$$;
ALTER FUNCTION public.record_india_gst_accommodation_payment_receipt(
  uuid,uuid,uuid,uuid,bigint,date,date,text,uuid,uuid,text) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.record_india_gst_accommodation_payment_receipt(
  uuid,uuid,uuid,uuid,bigint,date,date,text,uuid,uuid,text) FROM PUBLIC,app_role,yellow_runtime;
GRANT EXECUTE ON FUNCTION public.record_india_gst_accommodation_payment_receipt(
  uuid,uuid,uuid,uuid,bigint,date,date,text,uuid,uuid,text) TO app_role;

CREATE FUNCTION public.record_india_gst_accommodation_ordinary_regime_evidence(
  p_tenant uuid,p_property uuid,p_reservation uuid,p_service uuid,p_regime text,
  p_source text,p_legal_basis text,p_external_sha text,p_request uuid,p_actor uuid,p_key text
) RETURNS TABLE(ordinary_regime_evidence_id uuid,service_provision_snapshot_id uuid,
  evidence_hash text,created boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD'
AS $$
DECLARE
  v_date date; v_key_hash text; v_request_hash text;
  v_lineage public.tax_attribution_reservation_binding%ROWTYPE;
  v_service public.india_gst_accommodation_service_provision_snapshot%ROWTYPE;
  v_row public.india_gst_accommodation_ordinary_regime_evidence%ROWTYPE;
  v_payload jsonb;
BEGIN
  v_date:=public.lock_india_native_intake_authority(
    p_tenant,p_property,p_reservation,p_request,p_actor,p_key,'ordinary');
  IF p_service IS NULL OR p_regime IS DISTINCT FROM 'ordinary_rule47_30_day'
     OR p_source IS DISTINCT FROM 'governed_rule47_ordinary_regime_record'
     OR p_legal_basis IS DISTINCT FROM 'CGST_RULE_47_ORDINARY_SERVICE_INVOICE_30_DAY_INPUT'
     OR p_external_sha IS NULL OR p_external_sha !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='affirmative ordinary Rule47 evidence is required';
  END IF;
  v_key_hash:=pg_catalog.encode(public.digest(p_key,'sha256'),'hex');
  v_request_hash:=public.india_native_source_hash(pg_catalog.jsonb_build_array(
    'india-native-ordinary-request-v1',p_tenant,p_property,p_reservation,p_service,
    p_regime,p_source,p_legal_basis,p_external_sha,p_actor));
  SELECT s.* INTO v_row FROM public.india_gst_accommodation_ordinary_regime_evidence s
    WHERE s.tenant_id=p_tenant AND s.request_key_hash=v_key_hash FOR SHARE;
  IF FOUND THEN
    IF v_row.request_hash IS DISTINCT FROM v_request_hash THEN
      RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='ordinary request key has different actor or evidence';
    END IF;
    RETURN QUERY SELECT v_row.id,v_row.service_provision_snapshot_id,v_row.evidence_hash,false;
    RETURN;
  END IF;
  SELECT s.* INTO v_service FROM public.india_gst_accommodation_service_provision_snapshot s
    WHERE s.tenant_id=p_tenant AND s.id=p_service AND s.property_node=p_property
      AND s.reservation_id=p_reservation AND s.currency='INR' AND s.evidence_hash IS NOT NULL
    FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='governed service provision source unavailable';
  END IF;
  v_lineage:=public.lock_india_native_intake_lineage(
    p_tenant,p_property,p_reservation,v_service.reservation_lineage_id);
  IF public.india_native_source_hash(pg_catalog.jsonb_build_array(
       'india-native-service-root-v1',pg_catalog.to_jsonb(v_service)-'evidence_hash',
       pg_catalog.to_jsonb(v_lineage))) IS DISTINCT FROM v_service.evidence_hash THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='service provision root hash is inconsistent';
  END IF;
  IF EXISTS(SELECT 1 FROM public.india_gst_accommodation_ordinary_regime_evidence s
    WHERE s.tenant_id=p_tenant AND s.service_provision_snapshot_id=p_service) THEN
    RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='service already has immutable ordinary evidence';
  END IF;
  v_row.tenant_id:=p_tenant; v_row.id:=pg_catalog.gen_random_uuid();
  v_row.property_node:=p_property; v_row.reservation_id:=p_reservation;
  v_row.service_provision_snapshot_id:=p_service;
  v_row.reservation_lineage_id:=v_service.reservation_lineage_id;
  v_row.hold_binding_id:=v_service.hold_binding_id; v_row.attribution_id:=v_service.attribution_id;
  v_row.segment_id:=v_service.segment_id; v_row.origin_quote_hash:=v_service.origin_quote_hash;
  v_row.snapshot_hash:=v_service.snapshot_hash; v_row.currency:='INR';
  v_row.service_provision_date:=v_service.service_provision_date;
  v_row.service_provision_evidence_sha256:=v_service.service_provision_evidence_sha256;
  v_row.service_evidence_hash:=v_service.evidence_hash;
  v_row.regime:=p_regime; v_row.ordinary_regime_source:=p_source;
  v_row.legal_basis:=p_legal_basis; v_row.ordinary_regime_evidence_sha256:=p_external_sha;
  v_row.recording_actor_id:=p_actor; v_row.recording_request_id:=p_request;
  v_row.request_key_hash:=v_key_hash; v_row.request_hash:=v_request_hash;
  v_row.recorded_at:=pg_catalog.transaction_timestamp();
  v_row.evidence_hash:=public.india_native_source_hash(pg_catalog.jsonb_build_array(
    'india-native-ordinary-root-v1',pg_catalog.to_jsonb(v_row)-'evidence_hash',
    pg_catalog.to_jsonb(v_service),pg_catalog.to_jsonb(v_lineage)));
  INSERT INTO public.india_gst_accommodation_ordinary_regime_evidence SELECT (v_row).*;
  v_payload:=pg_catalog.jsonb_build_object('ordinaryRegimeEvidenceId',v_row.id,
    'serviceProvisionSnapshotId',p_service,'reservationId',p_reservation,
    'attributionId',v_service.attribution_id,'evidenceHash',v_row.evidence_hash);
  INSERT INTO public.fact_log(tenant_id,entity_type,entity_id,fact_type,valid_from,business_date,actor_id,payload)
    VALUES(p_tenant,'india_gst_accommodation_ordinary_regime_evidence',v_row.id,
      'recorded',v_row.recorded_at,v_date,p_actor,v_payload);
  PERFORM pg_catalog.pg_advisory_xact_lock(6441674055002974568);
  INSERT INTO public.outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,
    event_type,event_version,actor_id,correlation_id,payload)
    VALUES(p_tenant,p_property,v_date,'india_gst_accommodation_ordinary_regime_evidence',
      v_row.id,'india_gst.accommodation_ordinary_regime_recorded',1,p_actor,p_request,v_payload);
  RETURN QUERY SELECT v_row.id,v_row.service_provision_snapshot_id,v_row.evidence_hash,true;
END;
$$;
ALTER FUNCTION public.record_india_gst_accommodation_ordinary_regime_evidence(
  uuid,uuid,uuid,uuid,text,text,text,text,uuid,uuid,text) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.record_india_gst_accommodation_ordinary_regime_evidence(
  uuid,uuid,uuid,uuid,text,text,text,text,uuid,uuid,text) FROM PUBLIC,app_role,yellow_runtime;
GRANT EXECUTE ON FUNCTION public.record_india_gst_accommodation_ordinary_regime_evidence(
  uuid,uuid,uuid,uuid,text,text,text,text,uuid,uuid,text) TO app_role;

-- Native consideration valuation. Legacy0062 remains installed verbatim and
-- defaults to its exact external quoted-applicability branch.
-- Follow0018's bounded direct-deploy DDL pattern. Existing0062 tables FORCE
-- tenant RLS; FK validation must inspect every tenant without a tenant GUC.
-- Keep every policy/FORCE flag and ordinary validated FK unchanged. This role
-- interval only alters existing yellow_owner-owned tables; restore yellow_owner
-- before creating any capability. The migration runner wraps this in one Tx.
RESET ROLE;
DO $native_valuation_ddl_authority$
BEGIN
  IF session_user<>'yellow_deploy' OR current_user<>'yellow_deploy'
     OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles r
       WHERE r.rolname='yellow_deploy' AND r.rolcanlogin AND r.rolsuper) THEN
    RAISE EXCEPTION USING ERRCODE='42501',
      MESSAGE='native valuation constraint validation requires the direct deployment session';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_class c WHERE c.oid=ANY(ARRAY[
      'public.india_gst_accommodation_service_provision_snapshot'::regclass,
      'public.india_gst_accommodation_final_valuation'::regclass,
      'public.india_gst_accommodation_valuation_source'::regclass,
      'public.india_gst_accommodation_valuation_room_night'::regclass,
      'public.india_gst_accommodation_valuation_allocation'::regclass])
      AND c.relowner<>pg_catalog.to_regrole('yellow_owner')) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native valuation table ownership is inconsistent';
  END IF;
END $native_valuation_ddl_authority$;

ALTER TABLE public.india_gst_accommodation_service_provision_snapshot
  ADD CONSTRAINT india_service_native_valuation_identity_uq UNIQUE
    (tenant_id,id,property_node,reservation_id,attribution_id,reservation_lineage_id);

ALTER TABLE public.india_gst_accommodation_final_valuation
  ALTER COLUMN order341_evidence_hash DROP NOT NULL,
  ADD COLUMN basis_kind text NOT NULL DEFAULT 'external_quoted_applicability',
  ADD COLUMN native_service_provision_snapshot_id uuid,
  ADD COLUMN native_lineage_id uuid,
  ADD COLUMN native_consideration_basis_hash text,
  ADD COLUMN native_request_key_hash text,
  ADD COLUMN native_approval_basis_hash text,
  ADD COLUMN native_approval_actor_id uuid,
  ADD COLUMN native_approval_decided_at timestamptz,
  ADD COLUMN native_approval_valid_until timestamptz,
  ADD COLUMN native_approval_evidence_hash text,
  ADD COLUMN native_source_count integer,
  ADD COLUMN native_room_night_count integer,
  ADD COLUMN native_recording_xid xid8,
  ADD CONSTRAINT india_valuation_basis_identity_uq UNIQUE (tenant_id,id,basis_kind),
  ADD CONSTRAINT india_valuation_native_key_uq UNIQUE (tenant_id,native_request_key_hash),
  ADD CONSTRAINT india_valuation_native_service_fk FOREIGN KEY (
    tenant_id,native_service_provision_snapshot_id,property_node,reservation_id,
    attribution_id,native_lineage_id
  ) REFERENCES public.india_gst_accommodation_service_provision_snapshot (
    tenant_id,id,property_node,reservation_id,attribution_id,reservation_lineage_id
  ),
  ADD CONSTRAINT india_valuation_native_approval_actor_fk
    FOREIGN KEY (tenant_id,native_approval_actor_id) REFERENCES public.app_user(tenant_id,id),
  ADD CONSTRAINT india_valuation_predecessor_basis_fk
    FOREIGN KEY (tenant_id,supersedes_valuation_id,basis_kind)
      REFERENCES public.india_gst_accommodation_final_valuation(tenant_id,id,basis_kind),
  ADD CONSTRAINT india_valuation_basis_shape_ck CHECK (
    (basis_kind='external_quoted_applicability' AND order341_evidence_hash IS NOT NULL
      AND pg_catalog.num_nonnulls(native_service_provision_snapshot_id,native_lineage_id,
        native_consideration_basis_hash,native_request_key_hash,native_approval_basis_hash,
        native_approval_actor_id,native_approval_decided_at,native_approval_valid_until,
        native_approval_evidence_hash,native_source_count,native_room_night_count,native_recording_xid)=0)
    OR (basis_kind='native_consideration' AND order341_evidence_hash IS NULL
      AND native_service_provision_snapshot_id IS NOT NULL AND native_lineage_id IS NOT NULL
      AND native_consideration_basis_hash IS NOT NULL
      AND native_consideration_basis_hash ~ '^[0-9a-f]{64}$'
      AND native_request_key_hash IS NOT NULL AND native_request_key_hash ~ '^[0-9a-f]{64}$'
      AND native_approval_basis_hash IS NOT NULL AND native_approval_basis_hash ~ '^[0-9a-f]{64}$'
      AND native_source_count IS NOT NULL AND native_source_count BETWEEN 1 AND 500
      AND native_room_night_count IS NOT NULL AND native_room_night_count BETWEEN 1 AND 366
      AND native_recording_xid IS NOT NULL
      AND disposition='ordinary_final' AND transaction_value_minor>0 AND attested_by=actor_id
      AND ((approval_request_id IS NULL AND pg_catalog.num_nonnulls(
        native_approval_actor_id,native_approval_decided_at,native_approval_valid_until,
        native_approval_evidence_hash)=0)
        OR (approval_request_id IS NOT NULL AND pg_catalog.num_nonnulls(
          native_approval_actor_id,native_approval_decided_at,native_approval_valid_until,
          native_approval_evidence_hash)=4
          AND native_approval_actor_id<>actor_id
          AND pg_catalog.isfinite(native_approval_decided_at)
          AND pg_catalog.isfinite(native_approval_valid_until)
          AND native_approval_decided_at<=recorded_at
          AND native_approval_valid_until>recorded_at
          AND native_approval_evidence_hash ~ '^[0-9a-f]{64}$')))
  );

DO $native_children$
DECLARE t text; short_name text;
BEGIN
  FOR t,short_name IN SELECT * FROM (VALUES
    ('india_gst_accommodation_valuation_source','source'),
    ('india_gst_accommodation_valuation_room_night','night'),
    ('india_gst_accommodation_valuation_allocation','allocation')
  ) names(table_name,short_name) LOOP
    EXECUTE pg_catalog.format(
      'ALTER TABLE public.%I ADD COLUMN basis_kind text NOT NULL DEFAULT ''external_quoted_applicability'',
       ADD CONSTRAINT %I CHECK (basis_kind IN (''external_quoted_applicability'',''native_consideration'')),
       ADD CONSTRAINT %I FOREIGN KEY (tenant_id,valuation_id,basis_kind)
       REFERENCES public.india_gst_accommodation_final_valuation(tenant_id,id,basis_kind)',
      t,'india_valuation_'||short_name||'_basis_ck','india_valuation_'||short_name||'_basis_fk');
  END LOOP;
END $native_children$;
SET LOCAL ROLE yellow_owner;

CREATE FUNCTION public.prevent_native_valuation_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF OLD.basis_kind='native_consideration'
     OR (TG_OP='UPDATE' AND NEW.basis_kind='native_consideration') THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native consideration valuation is immutable';
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$$;
ALTER FUNCTION public.prevent_native_valuation_mutation() OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.prevent_native_valuation_mutation() FROM PUBLIC,app_role,yellow_runtime;
DO $native_guards$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['india_gst_accommodation_final_valuation',
    'india_gst_accommodation_valuation_source','india_gst_accommodation_valuation_room_night',
    'india_gst_accommodation_valuation_allocation'] LOOP
    EXECUTE pg_catalog.format('CREATE TRIGGER native_valuation_immutable BEFORE UPDATE OR DELETE
      ON public.%I FOR EACH ROW EXECUTE FUNCTION public.prevent_native_valuation_mutation()',t);
  END LOOP;
END $native_guards$;

-- Exact SQL counterpart of allocateSignedLargestRemainder: magnitude allocation,
-- descending integer remainder, ascending dense ordinal for ties, then sign.
-- Numeric is used only for exact widened integer products, never for stored money.
CREATE FUNCTION public.india_native_signed_allocations(p_amount bigint,p_weights bigint[])
RETURNS bigint[] LANGUAGE plpgsql IMMUTABLE STRICT
SET search_path=pg_catalog,public AS $$
DECLARE v_total numeric; v_result bigint[];
BEGIN
  IF p_amount=0 OR pg_catalog.array_ndims(p_weights) IS DISTINCT FROM 1
     OR pg_catalog.array_lower(p_weights,1) IS DISTINCT FROM 1
     OR pg_catalog.cardinality(p_weights) NOT BETWEEN 1 AND 366
     OR EXISTS(SELECT 1 FROM pg_catalog.unnest(p_weights) w WHERE w IS NULL OR w<=0) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='signed allocation input is invalid';
  END IF;
  SELECT pg_catalog.sum(w::numeric) INTO v_total FROM pg_catalog.unnest(p_weights) w;
  IF v_total>9223372036854775807::numeric THEN
    RAISE EXCEPTION USING ERRCODE='22003',MESSAGE='allocation weight total exceeds signed int64';
  END IF;
  WITH shares AS (
    SELECT ordinality,pg_catalog.div(pg_catalog.abs(p_amount::numeric)*weight,v_total) base,
      pg_catalog.mod(pg_catalog.abs(p_amount::numeric)*weight,v_total) remainder
    FROM pg_catalog.unnest(p_weights) WITH ORDINALITY w(weight,ordinality)
  ), ranked AS (
    SELECT *,pg_catalog.row_number() OVER (ORDER BY remainder DESC,ordinality) rank,
      pg_catalog.abs(p_amount::numeric)-pg_catalog.sum(base) OVER () residual FROM shares
  )
  SELECT pg_catalog.array_agg(((base+CASE WHEN rank<=residual THEN 1 ELSE 0 END)
    *CASE WHEN p_amount<0 THEN -1 ELSE 1 END)::bigint ORDER BY ordinality)
    INTO v_result FROM ranked;
  IF (SELECT pg_catalog.sum(a::numeric) FROM pg_catalog.unnest(v_result) a)
     IS DISTINCT FROM p_amount::numeric THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='signed allocation conservation failed';
  END IF;
  RETURN v_result;
END;
$$;
ALTER FUNCTION public.india_native_signed_allocations(bigint,bigint[]) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.india_native_signed_allocations(bigint,bigint[])
  FROM PUBLIC,app_role,yellow_runtime;

-- Unlike legacy0062, the native branch binds both sides of recorded ordinary
-- corrections. An original and its contra remain real financial evidence and
-- must net together. All historical transfer fragments remain in the closure.
CREATE FUNCTION public.india_native_consideration_roots(
  p_tenant uuid,p_folio uuid,p_account uuid
) RETURNS uuid[] LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
  SELECT COALESCE(pg_catalog.array_agg(root_id ORDER BY root_id),'{}'::uuid[])
  FROM (
    SELECT root.id root_id
    FROM public.posting_line root
    JOIN public.tx_code code ON code.code=root.tx_code AND code.grp IN ('revenue','adjustment')
    JOIN public.posting_line fragment ON fragment.tenant_id=root.tenant_id
      AND COALESCE(fragment.folio_transfer_root_line_id,fragment.id)=root.id
    WHERE root.tenant_id=p_tenant AND root.account_id=p_account
      AND root.folio_transfer_root_line_id IS NULL AND root.folio_id IS NOT NULL
    GROUP BY root.id
    HAVING pg_catalog.sum(fragment.amount_minor::numeric)
      FILTER (WHERE fragment.folio_id=p_folio)<>0
  ) roots
$$;
ALTER FUNCTION public.india_native_consideration_roots(uuid,uuid,uuid) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.india_native_consideration_roots(uuid,uuid,uuid)
  FROM PUBLIC,app_role,yellow_runtime;

CREATE FUNCTION public.india_native_consideration_accounts(
  p_tenant uuid,p_roots uuid[],p_guest uuid
) RETURNS uuid[] LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
  SELECT pg_catalog.array_agg(id ORDER BY id) FROM (
    SELECT p_guest id UNION
    SELECT line.account_id
    FROM public.posting_line root
    JOIN public.posting_line fragment ON fragment.tenant_id=root.tenant_id
      AND COALESCE(fragment.folio_transfer_root_line_id,fragment.id)=root.id
    JOIN public.posting_line line ON line.tenant_id=fragment.tenant_id
      AND line.journal_id=fragment.journal_id
    WHERE root.tenant_id=p_tenant AND root.id=ANY(p_roots)
  ) accounts
$$;
ALTER FUNCTION public.india_native_consideration_accounts(uuid,uuid[],uuid) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.india_native_consideration_accounts(uuid,uuid[],uuid)
  FROM PUBLIC,app_role,yellow_runtime;

-- Caller holds scope0; this helper obtains the complete financial prefix and
-- reconstructs typed source evidence itself. No caller account/root list is used.
CREATE FUNCTION public.lock_india_native_valuation_sources(
  p_tenant uuid,p_property uuid,p_reservation uuid,p_folio uuid
) RETURNS jsonb LANGUAGE plpgsql VOLATILE
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE
  v_folio public.folio%ROWTYPE; v_guest uuid; v_roots uuid[]; v_accounts uuid[];
  v_journals uuid[]; v_id uuid; v_root public.posting_line%ROWTYPE;
  v_header public.journal%ROWTYPE; v_peer public.posting_line%ROWTYPE;
  v_original public.posting_line%ROWTYPE; v_lines jsonb; v_fragments jsonb;
  v_transfer_graph jsonb; v_graph jsonb; v_sources jsonb:='[]'::jsonb;
  v_count integer; v_amount numeric; v_total numeric; v_active_folios integer;
  v_allocated uuid; v_companion uuid;
BEGIN
  SELECT f.* INTO v_folio FROM public.folio f
    WHERE f.tenant_id=p_tenant AND f.id=p_folio AND f.reservation_id=p_reservation;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native valuation folio unavailable'; END IF;
  v_guest:=v_folio.account_id;
  v_roots:=public.india_native_consideration_roots(p_tenant,p_folio,v_guest);
  IF pg_catalog.cardinality(v_roots) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='native consideration requires 1..500 complete roots';
  END IF;
  v_accounts:=public.india_native_consideration_accounts(p_tenant,v_roots,v_guest);
  -- Valuation locks up to500 consideration revenue accounts plus the shared
  -- guest account (501). The later issuance composition adds at most two
  -- component-payable accounts, making Order434's complete issuance bound503.
  -- This pre-issue writer does not select tax routes or lock their accounts.
  IF pg_catalog.cardinality(v_accounts)>501 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native consideration exceeds its exact account bound';
  END IF;
  PERFORM 1 FROM public.account a
    WHERE a.tenant_id=p_tenant AND a.id=ANY(v_accounts) ORDER BY a.id FOR UPDATE;
  SELECT f.* INTO v_folio FROM public.folio f
    WHERE f.tenant_id=p_tenant AND f.id=p_folio AND f.reservation_id=p_reservation
      AND f.account_id=v_guest AND f.status='open' FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.account a
    WHERE a.tenant_id=p_tenant AND a.id=v_guest AND a.property_node=p_property
      AND a.role='guest' AND a.status='open' AND a.currency='INR') THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='open INR guest folio unavailable';
  END IF;
  IF v_roots IS DISTINCT FROM public.india_native_consideration_roots(p_tenant,p_folio,v_guest)
     OR v_accounts IS DISTINCT FROM public.india_native_consideration_accounts(p_tenant,v_roots,v_guest) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='consideration membership changed during lock acquisition';
  END IF;
  FOREACH v_id IN ARRAY v_roots LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      p_tenant::text||':folio-transfer-root:'||v_id::text,188));
  END LOOP;
  SELECT pg_catalog.array_agg(id ORDER BY id) INTO v_journals FROM (
    SELECT root.journal_id id FROM public.posting_line root
      WHERE root.tenant_id=p_tenant AND root.id=ANY(v_roots)
    UNION SELECT j.reverses FROM public.posting_line root
      JOIN public.journal j ON j.tenant_id=root.tenant_id AND j.id=root.journal_id
      WHERE root.tenant_id=p_tenant AND root.id=ANY(v_roots) AND j.reverses IS NOT NULL
  ) ids;
  FOREACH v_id IN ARRAY v_journals LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_tenant::text||':'||v_id::text,0));
  END LOOP;
  FOREACH v_id IN ARRAY v_journals LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      p_tenant::text||':positive-tax-correction:'||v_id::text,266));
  END LOOP;
  FOREACH v_id IN ARRAY v_journals LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      p_tenant::text||':india-final-component-tax-correction:'||v_id::text,408));
  END LOOP;
  FOREACH v_id IN ARRAY v_journals LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      'india-final-component-tax-journal-reversal:'||p_tenant::text||':'||v_id::text,408));
  END LOOP;

  FOREACH v_id IN ARRAY v_roots LOOP
    SELECT r.* INTO STRICT v_root FROM public.posting_line r
      WHERE r.tenant_id=p_tenant AND r.id=v_id FOR SHARE;
    SELECT j.* INTO STRICT v_header FROM public.journal j
      WHERE j.tenant_id=p_tenant AND j.id=v_root.journal_id FOR SHARE;
    PERFORM 1 FROM public.posting_line l WHERE l.tenant_id=p_tenant
      AND l.journal_id=v_header.id ORDER BY l.seq FOR SHARE;
    IF v_root.seq<>1 OR v_root.account_id<>v_guest OR v_root.folio_id IS NULL
       OR v_root.currency<>'INR' OR v_root.tax_detail IS NOT NULL
       OR v_root.business_date<>v_header.business_date
       OR v_header.property_node<>p_property OR v_header.currency<>'INR'
       OR NOT ((v_header.kind='charge' AND v_header.reverses IS NULL
          AND v_header.source='{"interface":"financials.charge.post"}'::jsonb AND v_root.amount_minor>0)
         OR (v_header.kind='adjustment' AND v_header.reverses IS NOT NULL
          AND v_header.source='{"interface":"financials.charge.reverse"}'::jsonb AND v_root.amount_minor<0)) THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native source requires a governed untaxed charge or correction';
    END IF;
    SELECT pg_catalog.count(*) INTO v_count FROM public.posting_line l
      WHERE l.tenant_id=p_tenant AND l.journal_id=v_header.id;
    SELECT l.* INTO v_peer FROM public.posting_line l
      WHERE l.tenant_id=p_tenant AND l.journal_id=v_header.id AND l.seq=2;
    IF NOT FOUND OR v_count<>2 OR v_peer.folio_id IS NOT NULL
       OR v_peer.folio_transfer_root_line_id IS NOT NULL OR v_peer.account_id=v_guest
       OR v_peer.amount_minor::numeric<>-v_root.amount_minor::numeric
       OR v_peer.tx_code<>v_root.tx_code OR v_peer.description IS DISTINCT FROM v_root.description
       OR v_peer.quantity<>v_root.quantity OR v_peer.currency<>'INR'
       OR v_peer.business_date<>v_header.business_date OR v_peer.tax_detail IS NOT NULL
       OR NOT EXISTS(SELECT 1 FROM public.account a WHERE a.tenant_id=p_tenant
         AND a.id=v_peer.account_id AND a.role='revenue' AND a.property_node=p_property
         AND a.currency='INR') THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native source must contain exactly two balanced guest/revenue lines';
    END IF;
    IF EXISTS(SELECT 1 FROM public.tax_attribution_journal_binding b
        WHERE b.tenant_id=p_tenant AND b.journal_id=v_header.id)
       OR EXISTS(SELECT 1 FROM public.india_gst_accommodation_final_component_tax_journal_binding b
        WHERE b.tenant_id=p_tenant AND b.journal_id=v_header.id) THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='previously taxed sources cannot become native consideration';
    END IF;
    IF v_header.reverses IS NOT NULL THEN
      SELECT r.* INTO v_original FROM public.posting_line r JOIN public.journal j
        ON j.tenant_id=r.tenant_id AND j.id=r.journal_id
        WHERE r.tenant_id=p_tenant AND j.id=v_header.reverses AND r.seq=1
          AND j.kind='charge' AND j.reverses IS NULL
          AND j.source='{"interface":"financials.charge.post"}'::jsonb;
      IF NOT FOUND OR NOT v_original.id=ANY(v_roots)
         OR v_original.amount_minor::numeric<>-v_root.amount_minor::numeric
         OR v_original.account_id<>v_guest OR v_original.tx_code<>v_root.tx_code
         OR v_original.quantity<>v_root.quantity THEN
        RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native correction requires its exact original companion';
      END IF;
    ELSE
      FOR v_companion IN SELECT r.id FROM public.journal j JOIN public.posting_line r
        ON r.tenant_id=j.tenant_id AND r.journal_id=j.id AND r.seq=1
        WHERE j.tenant_id=p_tenant AND j.reverses=v_header.id LOOP
        IF NOT v_companion=ANY(v_roots) THEN
          RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native original requires complete correction companion closure';
        END IF;
      END LOOP;
    END IF;

    PERFORM 1 FROM public.posting_line fragment JOIN public.journal j
      ON j.tenant_id=fragment.tenant_id AND j.id=fragment.journal_id
      WHERE fragment.tenant_id=p_tenant AND fragment.folio_transfer_root_line_id=v_id
      ORDER BY j.id,fragment.seq FOR SHARE OF fragment,j;
    -- Validate all pairs in each participating transfer journal, including pairs
    -- belonging to another root; never truncate a multi-root transfer journal.
    IF EXISTS(
      SELECT 1 FROM public.posting_line l JOIN public.journal j
        ON j.tenant_id=l.tenant_id AND j.id=l.journal_id
      LEFT JOIN public.posting_line origin ON origin.tenant_id=l.tenant_id
        AND origin.id=l.folio_transfer_root_line_id
      WHERE l.tenant_id=p_tenant AND l.journal_id IN (
        SELECT f.journal_id FROM public.posting_line f
          WHERE f.tenant_id=p_tenant AND f.folio_transfer_root_line_id=v_id)
      GROUP BY j.id,j.kind,j.reverses,j.source,j.property_node,j.currency,
        l.folio_transfer_root_line_id,origin.id,origin.amount_minor
      HAVING j.kind<>'transfer' OR j.reverses IS NOT NULL
        OR j.source<>'{"interface":"financials.folio.transfer"}'::jsonb
        OR j.property_node<>p_property OR j.currency<>'INR' OR origin.id IS NULL
        OR pg_catalog.count(*)<>2 OR pg_catalog.count(DISTINCT l.folio_id)<>2
        OR pg_catalog.count(*) FILTER (WHERE l.amount_minor=origin.amount_minor)<>1
        OR pg_catalog.count(*) FILTER (WHERE l.amount_minor::numeric=-origin.amount_minor::numeric)<>1
        OR pg_catalog.bool_or(l.account_id<>v_guest OR l.folio_id IS NULL
          OR l.currency<>'INR' OR l.tax_detail IS NOT NULL OR l.business_date<>j.business_date
          OR l.tx_code<>origin.tx_code OR l.quantity<>origin.quantity
          OR l.description IS DISTINCT FROM origin.description)
    ) THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native source transfer journal has incomplete or unsupported pairs';
    END IF;
    SELECT pg_catalog.count(*) FILTER (WHERE amount<>0),
      (pg_catalog.array_agg(folio_id ORDER BY folio_id) FILTER (WHERE amount<>0))[1],
      pg_catalog.sum(amount),pg_catalog.sum(amount) FILTER (WHERE folio_id=p_folio)
      INTO v_active_folios,v_allocated,v_total,v_amount
      FROM (SELECT f.folio_id,pg_catalog.sum(f.amount_minor::numeric) amount
        FROM public.posting_line f WHERE f.tenant_id=p_tenant
          AND COALESCE(f.folio_transfer_root_line_id,f.id)=v_id GROUP BY f.folio_id) allocation;
    IF v_active_folios<>1 OR v_allocated IS DISTINCT FROM p_folio
       OR v_total IS DISTINCT FROM v_root.amount_minor::numeric
       OR v_amount IS DISTINCT FROM v_root.amount_minor::numeric THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native source is split, partial, or stale';
    END IF;
    SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(l) ORDER BY l.seq) INTO v_lines
      FROM public.posting_line l WHERE l.tenant_id=p_tenant AND l.journal_id=v_header.id;
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'line',pg_catalog.to_jsonb(f),'journal',pg_catalog.to_jsonb(j)) ORDER BY f.id)
      INTO v_fragments FROM public.posting_line f JOIN public.journal j
        ON j.tenant_id=f.tenant_id AND j.id=f.journal_id
      WHERE f.tenant_id=p_tenant AND COALESCE(f.folio_transfer_root_line_id,f.id)=v_id;
    SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'journal',pg_catalog.to_jsonb(j),'lines',(SELECT pg_catalog.jsonb_agg(
        pg_catalog.to_jsonb(l) ORDER BY l.seq) FROM public.posting_line l
        WHERE l.tenant_id=j.tenant_id AND l.journal_id=j.id)) ORDER BY j.id),'[]'::jsonb)
      INTO v_transfer_graph FROM public.journal j
      WHERE j.tenant_id=p_tenant AND j.id IN (SELECT f.journal_id FROM public.posting_line f
        WHERE f.tenant_id=p_tenant AND f.folio_transfer_root_line_id=v_id);
    v_graph:=pg_catalog.jsonb_build_object('postingRootId',v_id,'root',pg_catalog.to_jsonb(v_root),
      'journal',pg_catalog.to_jsonb(v_header),'lines',v_lines,'fragments',v_fragments,
      'transferJournals',v_transfer_graph,'currentFolioId',p_folio,
      'currentAmountMinor',v_amount::bigint::text,'txCode',v_root.tx_code);
    v_sources:=v_sources||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'postingRootId',v_id,'journalId',v_header.id,'currentAmountMinor',v_amount::bigint::text,
      'txCode',v_root.tx_code,'currentFragmentSetHash',public.india_native_source_hash(v_graph)));
  END LOOP;
  IF v_roots IS DISTINCT FROM public.india_native_consideration_roots(p_tenant,p_folio,v_guest)
     OR v_accounts IS DISTINCT FROM public.india_native_consideration_accounts(p_tenant,v_roots,v_guest) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native source set drifted after complete locking';
  END IF;
  RETURN pg_catalog.jsonb_build_object('accountId',v_guest,'accountIds',v_accounts,
    'rootIds',v_roots,'sources',v_sources);
END;
$$;
ALTER FUNCTION public.lock_india_native_valuation_sources(uuid,uuid,uuid,uuid) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.lock_india_native_valuation_sources(uuid,uuid,uuid,uuid)
  FROM PUBLIC,app_role,yellow_runtime;

CREATE FUNCTION public.record_india_gst_native_accommodation_valuation(
  p_tenant uuid,p_property uuid,p_reservation uuid,p_folio uuid,p_buyer uuid,p_service uuid,
  p_request uuid,p_actor uuid,p_key text,p_expected uuid,p_expected_hash text,p_approval uuid,
  p_relationship text,p_consideration text,p_section152 text,p_section153 text,
  p_source_completeness text,p_attestation_source text,p_attestation_reference text,
  p_source_ids uuid[],p_source_kinds text[],p_source_additions text[],p_source_discounts text[],
  p_source_evidence_sources text[],p_source_evidence_references text[]
) RETURNS TABLE(valuation_id uuid,generation integer,disposition text,
  transaction_value_minor bigint,evidence_hash text,native_consideration_basis_hash text,created boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE
  v_context uuid; v_n integer; v_i integer; v_j integer; v_nights integer;
  v_key_hash text; v_request_hash text; v_request_sources jsonb; v_ordinary jsonb;
  v_current public.india_gst_accommodation_final_valuation%ROWTYPE;
  v_service public.india_gst_accommodation_service_provision_snapshot%ROWTYPE;
  v_lineage public.tax_attribution_reservation_binding%ROWTYPE;
  v_attribution public.tax_attribution_snapshot%ROWTYPE;
  v_reservation public.reservation%ROWTYPE; v_folio public.folio%ROWTYPE;
  v_approval public.approval_request%ROWTYPE;
  v_source_graph jsonb; v_source jsonb; v_input_source jsonb; v_night jsonb;
  v_basis_sources jsonb:='[]'::jsonb; v_basis_nights jsonb:='[]'::jsonb;
  v_basis jsonb; v_payload jsonb; v_allocation bigint[]; v_weights bigint[]:='{}';
  v_dates date[]:='{}'; v_night_totals numeric[]; v_total numeric:=0; v_weight_total numeric:=0;
  v_amount bigint; v_weight bigint; v_night_date date; v_ids uuid[];
  v_source_hash text; v_relationship_hash text; v_approval_basis_hash text;
  v_approval_hash text; v_basis_hash text; v_evidence_hash text; v_class_hash text; v_eligibility_hash text;
  v_ordinary_hashes text[]; v_candidates uuid[]; v_group_party uuid;
  v_generation integer:=0; v_id uuid:=pg_catalog.gen_random_uuid();
  v_recorded timestamptz:=pg_catalog.transaction_timestamp(); v_business_date date;
BEGIN
  IF session_user<>'yellow_runtime'
     OR pg_catalog.current_setting('role',true) IS DISTINCT FROM 'app_role'
     OR current_user<>'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='native valuation requires governed runtime authority';
  END IF;
  BEGIN v_context:=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='native valuation tenant context is invalid';
  END;
  IF p_tenant IS NULL OR v_context IS NULL OR p_tenant<>v_context THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='native valuation tenant context is invalid';
  END IF;
  IF p_property IS NULL OR p_reservation IS NULL OR p_folio IS NULL OR p_buyer IS NULL
     OR p_service IS NULL OR p_request IS NULL OR p_actor IS NULL OR p_key IS NULL
     OR p_key COLLATE "C" !~ '^[!-~]{8,200}$'
     OR (p_expected IS NULL)<>(p_expected_hash IS NULL)
     OR (p_expected_hash IS NOT NULL AND p_expected_hash !~ '^[0-9a-f]{64}$')
     OR p_relationship IS DISTINCT FROM 'unrelated_not_distinct'
     OR p_consideration IS DISTINCT FROM 'money_only'
     OR p_section152 IS DISTINCT FROM 'all_additions_enumerated'
     OR p_section153 IS DISTINCT FROM 'all_discounts_eligible'
     OR p_source_completeness IS DISTINCT FROM 'all_sources_classified'
     OR p_attestation_source IS NULL OR p_attestation_source !~ '^[a-z][a-z0-9_.:-]{2,63}$'
     OR p_attestation_reference IS NULL OR pg_catalog.length(p_attestation_reference) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='native valuation requires exact ordinary Section15 evidence';
  END IF;
  v_n:=pg_catalog.cardinality(p_source_ids);
  IF v_n IS NULL OR v_n NOT BETWEEN 1 AND 500
     OR pg_catalog.array_ndims(p_source_ids) IS DISTINCT FROM 1
     OR pg_catalog.array_lower(p_source_ids,1) IS DISTINCT FROM 1
     OR pg_catalog.array_ndims(p_source_kinds) IS DISTINCT FROM 1
     OR pg_catalog.array_ndims(p_source_additions) IS DISTINCT FROM 1
     OR pg_catalog.array_ndims(p_source_discounts) IS DISTINCT FROM 1
     OR pg_catalog.array_ndims(p_source_evidence_sources) IS DISTINCT FROM 1
     OR pg_catalog.array_ndims(p_source_evidence_references) IS DISTINCT FROM 1
     OR pg_catalog.array_lower(p_source_kinds,1) IS DISTINCT FROM 1
     OR pg_catalog.array_lower(p_source_additions,1) IS DISTINCT FROM 1
     OR pg_catalog.array_lower(p_source_discounts,1) IS DISTINCT FROM 1
     OR pg_catalog.array_lower(p_source_evidence_sources,1) IS DISTINCT FROM 1
     OR pg_catalog.array_lower(p_source_evidence_references,1) IS DISTINCT FROM 1
     OR pg_catalog.cardinality(p_source_kinds) IS DISTINCT FROM v_n
     OR pg_catalog.cardinality(p_source_additions) IS DISTINCT FROM v_n
     OR pg_catalog.cardinality(p_source_discounts) IS DISTINCT FROM v_n
     OR pg_catalog.cardinality(p_source_evidence_sources) IS DISTINCT FROM v_n
     OR pg_catalog.cardinality(p_source_evidence_references) IS DISTINCT FROM v_n
     OR (SELECT pg_catalog.count(DISTINCT id) FROM pg_catalog.unnest(p_source_ids) id)<>v_n THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='native source arrays require 1..500 unique complete tuples';
  END IF;
  FOR v_i IN 1..v_n LOOP
    IF p_source_kinds[v_i] IS NULL
       OR p_source_kinds[v_i] NOT IN ('room_consideration','package_consideration','promotion_discount',
         'fee_consideration','section15_2_addition','section15_3_discount')
       OR p_source_additions[v_i] IS NULL OR p_source_discounts[v_i] IS NULL
       OR ((p_source_kinds[v_i]='section15_2_addition')<>(p_source_additions[v_i] IN (
         'tax_duty_cess_fee_charge_excluding_gst','supplier_liability_paid_by_recipient',
         'incidental_expense','interest_late_fee_penalty','non_government_price_linked_subsidy')))
       OR (p_source_kinds[v_i]<>'section15_2_addition' AND p_source_additions[v_i]<>'')
       OR ((p_source_kinds[v_i]='section15_3_discount')<>(p_source_discounts[v_i] IN (
         'eligible_pre_supply_recorded','eligible_post_supply_linked_itc_reversed')))
       OR (p_source_kinds[v_i]<>'section15_3_discount' AND p_source_discounts[v_i]<>'')
       OR p_source_evidence_sources[v_i] IS NULL
       OR p_source_evidence_sources[v_i] !~ '^[a-z][a-z0-9_.:-]{2,63}$'
       OR p_source_evidence_references[v_i] IS NULL
       OR pg_catalog.length(p_source_evidence_references[v_i]) NOT BETWEEN 1 AND 200 THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='native source classification is incomplete or unsupported';
    END IF;
  END LOOP;
  SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'postingRootId',p_source_ids[i],'sourceKind',p_source_kinds[i],
    'additionSubtype',NULLIF(p_source_additions[i],''),'discountEligibility',NULLIF(p_source_discounts[i],''),
    'evidenceSource',p_source_evidence_sources[i],'evidenceReference',p_source_evidence_references[i])
    ORDER BY p_source_ids[i]),pg_catalog.array_agg(p_source_ids[i] ORDER BY p_source_ids[i])
    INTO v_request_sources,v_ids FROM pg_catalog.generate_series(1,v_n) i;
  v_ordinary:=pg_catalog.jsonb_build_object('relationshipConclusion',p_relationship,
    'considerationConclusion',p_consideration,'section152Conclusion',p_section152,
    'section153Conclusion',p_section153,'sourceCompletenessConclusion',p_source_completeness,
    'evidenceSource',p_attestation_source,'evidenceReference',p_attestation_reference);
  v_request_hash:=public.india_native_source_hash(pg_catalog.jsonb_build_object(
    'kind','india-native-valuation-request-v1','tenantId',p_tenant,'propertyNode',p_property,
    'reservationId',p_reservation,'folioId',p_folio,'buyerPartyId',p_buyer,
    'serviceProvisionSnapshotId',p_service,'actorId',p_actor,
    'expectedCurrentValuationId',p_expected,'expectedCurrentEvidenceHash',p_expected_hash,
    'approvalRequestId',p_approval,'sources',v_request_sources,'ordinaryAttestation',v_ordinary));
  v_key_hash:=pg_catalog.encode(public.digest(p_key,'sha256'),'hex');
  -- Source intake and valuation each use their own transaction. Refuse a caller
  -- transaction that already published rather than acquire financial locks after
  -- the global publication lock. Actual backend locks, never a caller GUC.
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_locks l WHERE l.pid=pg_catalog.pg_backend_pid()
    AND l.locktype='advisory' AND l.granted AND l.objsubid=1
    AND l.classid=((6441674055002974568::bigint>>32)&4294967295)::oid
    AND l.objid=(6441674055002974568::bigint&4294967295)::oid) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native valuation requires a transaction without prior publication';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_tenant::text||p_reservation::text||p_folio::text,0));
  -- Permanent exact replay needs current authority, but never rewrites the
  -- original actor or reinterprets its immutable receipt through a newer source.
  SELECT val.* INTO v_current FROM public.india_gst_accommodation_final_valuation val
    WHERE val.tenant_id=p_tenant AND val.native_request_key_hash=v_key_hash;
  IF FOUND THEN
    v_business_date:=public.lock_india_native_intake_authority(
      p_tenant,p_property,p_reservation,p_request,p_actor,p_key,'valuation');
    IF v_current.request_hash IS DISTINCT FROM v_request_hash THEN
      RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='native valuation request key has different actor or evidence';
    END IF;
    RETURN QUERY SELECT v_current.id,v_current.generation,v_current.disposition,
      v_current.transaction_value_minor,v_current.evidence_hash,v_current.native_consideration_basis_hash,false;
    RETURN;
  END IF;

  v_source_graph:=public.lock_india_native_valuation_sources(p_tenant,p_property,p_reservation,p_folio);
  v_business_date:=public.lock_india_native_intake_authority(
    p_tenant,p_property,p_reservation,p_request,p_actor,p_key,'valuation');
  -- A same key in another scope can have committed while financial locks waited.
  SELECT val.* INTO v_current FROM public.india_gst_accommodation_final_valuation val
    WHERE val.tenant_id=p_tenant AND val.native_request_key_hash=v_key_hash;
  IF FOUND THEN
    IF v_current.request_hash IS DISTINCT FROM v_request_hash THEN
      RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='native valuation request key has different actor or evidence';
    END IF;
    RETURN QUERY SELECT v_current.id,v_current.generation,v_current.disposition,
      v_current.transaction_value_minor,v_current.evidence_hash,v_current.native_consideration_basis_hash,false;
    RETURN;
  END IF;
  IF v_source_graph->'rootIds' IS DISTINCT FROM pg_catalog.to_jsonb(v_ids) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='requested roots are not the complete native consideration set';
  END IF;
  SELECT f.* INTO STRICT v_folio FROM public.folio f WHERE f.tenant_id=p_tenant AND f.id=p_folio;
  SELECT r.* INTO v_reservation FROM public.reservation r WHERE r.tenant_id=p_tenant
    AND r.id=p_reservation AND r.property_node=p_property AND r.currency='INR' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native reservation scope unavailable'; END IF;
  SELECT s.* INTO v_service FROM public.india_gst_accommodation_service_provision_snapshot s
    WHERE s.tenant_id=p_tenant AND s.id=p_service AND s.property_node=p_property
      AND s.reservation_id=p_reservation AND s.evidence_hash IS NOT NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native valuation requires governed service evidence'; END IF;
  v_lineage:=public.lock_india_native_intake_lineage(
    p_tenant,p_property,p_reservation,v_service.reservation_lineage_id);
  IF public.india_native_source_hash(pg_catalog.jsonb_build_array(
    'india-native-service-root-v1',pg_catalog.to_jsonb(v_service)-'evidence_hash',
    pg_catalog.to_jsonb(v_lineage))) IS DISTINCT FROM v_service.evidence_hash THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native service evidence is inconsistent';
  END IF;
  SELECT a.* INTO STRICT v_attribution FROM public.tax_attribution_snapshot a
    WHERE a.tenant_id=p_tenant AND a.id=v_lineage.attribution_id;
  IF v_attribution.snapshot->'evaluation'->>'priceDisplay' IS DISTINCT FROM 'tax_exclusive'
     OR v_attribution.snapshot->'revenueLine'->>'lineId' IS DISTINCT FROM 'room'
     OR v_attribution.snapshot->'revenueLine'->>'revenueGroup' IS DISTINCT FROM 'room_revenue'
     OR pg_catalog.jsonb_typeof(v_attribution.snapshot->'revenueLine'->'roomNights') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native consideration requires a canonical tax-exclusive room quote';
  END IF;
  v_nights:=pg_catalog.jsonb_array_length(v_attribution.snapshot->'revenueLine'->'roomNights');
  IF v_nights NOT BETWEEN 1 AND 366
     OR v_attribution.snapshot->'revenueLine'->>'nights' IS DISTINCT FROM v_nights::text THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='native quote requires 1..366 dense room nights';
  END IF;
  FOR v_i IN 0..v_nights-1 LOOP
    v_night:=v_attribution.snapshot->'revenueLine'->'roomNights'->v_i;
    IF pg_catalog.jsonb_typeof(v_night) IS DISTINCT FROM 'object'
       OR NOT v_night ?& ARRAY['index','businessDate','amountMinor']
       OR v_night-ARRAY['index','businessDate','amountMinor']<>'{}'::jsonb
       OR v_night->>'index' IS DISTINCT FROM v_i::text
       OR pg_catalog.jsonb_typeof(v_night->'amountMinor') IS DISTINCT FROM 'string'
       OR v_night->>'amountMinor' !~ '^[1-9][0-9]{0,18}$'
       OR v_night->>'businessDate' IS NULL OR v_night->>'businessDate' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='native quoted room-night identity is invalid';
    END IF;
    BEGIN
      v_weight:=(v_night->>'amountMinor')::bigint; v_night_date:=(v_night->>'businessDate')::date;
    EXCEPTION WHEN numeric_value_out_of_range THEN
      RAISE EXCEPTION USING ERRCODE='22003',MESSAGE='quoted weight exceeds signed int64';
    WHEN invalid_datetime_format OR datetime_field_overflow THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='quoted room-night date is invalid';
    END;
    IF v_night_date NOT BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'
       OR v_night_date::text IS DISTINCT FROM v_night->>'businessDate'
       OR (v_i>0 AND v_night_date<>v_dates[v_i]+1) THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='quoted room-night dates must be consecutive canonical dates';
    END IF;
    v_weights:=pg_catalog.array_append(v_weights,v_weight);
    v_dates:=pg_catalog.array_append(v_dates,v_night_date); v_weight_total:=v_weight_total+v_weight;
  END LOOP;
  IF v_weight_total>9223372036854775807::numeric
     OR v_weight_total::text IS DISTINCT FROM v_attribution.snapshot->'revenueLine'->>'inputAmountMinor'
     OR v_weight_total::text IS DISTINCT FROM v_attribution.snapshot->'evaluation'->>'inputTotalMinor' THEN
    RAISE EXCEPTION USING ERRCODE='22003',MESSAGE='quoted weights do not reconcile within signed int64';
  END IF;
  v_night_totals:=pg_catalog.array_fill(0::numeric,ARRAY[v_nights]);

  PERFORM 1 FROM public.party p WHERE p.tenant_id=p_tenant AND p.id=p_buyer AND p.status='active'
    AND EXISTS(SELECT 1 FROM public.party_role pr
      WHERE pr.tenant_id=p_tenant AND pr.party_id=p.id AND pr.role IN ('guest','company')) FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native valuation legal buyer unavailable'; END IF;
  PERFORM 1 FROM public.party_role pr WHERE pr.tenant_id=p_tenant AND pr.party_id=p_buyer
    AND pr.role IN ('guest','company') ORDER BY pr.role FOR SHARE;
  SELECT rg.account_party INTO v_group_party FROM public.reservation_group rg
    WHERE rg.tenant_id=p_tenant AND rg.id=v_reservation.group_id FOR SHARE;
  SELECT COALESCE(pg_catalog.array_agg(DISTINCT candidate ORDER BY candidate)
    FILTER (WHERE candidate IS NOT NULL),'{}'::uuid[]) INTO v_candidates FROM pg_catalog.unnest(ARRAY[
      v_reservation.primary_party,v_reservation.booker_party,
      (SELECT a.party_id FROM public.account a WHERE a.tenant_id=p_tenant AND a.id=v_folio.account_id),
      v_group_party]) candidate;
  SELECT pg_catalog.encode(public.digest(COALESCE(pg_catalog.string_agg(candidate::text,','
    ORDER BY candidate),''),'sha256'),'hex') INTO v_relationship_hash
    FROM pg_catalog.unnest(v_candidates) candidate;
  PERFORM 1 FROM public.party_relationship rel WHERE rel.tenant_id=p_tenant
    AND (rel.from_party=p_buyer OR rel.to_party=p_buyer)
    ORDER BY rel.from_party,rel.to_party,rel.kind FOR SHARE;
  IF FOUND THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='ordinary Section15 relationship assertion contradicts recorded relationships';
  END IF;
  v_approval_basis_hash:=public.india_native_source_hash(pg_catalog.jsonb_build_array(
    'india-native-valuation-approval-basis-v1',p_tenant,p_property,p_reservation,p_folio,p_buyer,
    v_service.id,v_service.evidence_hash,v_lineage.snapshot_hash,v_request_hash,v_relationship_hash));
  IF NOT p_buyer=ANY(v_candidates) THEN
    SELECT ar.* INTO v_approval FROM public.approval_request ar
      JOIN public.app_user decider ON decider.tenant_id=ar.tenant_id
        AND decider.id=ar.decided_by AND decider.status='active'
      WHERE ar.tenant_id=p_tenant AND ar.id=p_approval
        AND ar.kind='india_gst_legal_buyer_override' AND ar.subject_type='folio' AND ar.subject_id=p_folio
        AND ar.status='approved' AND ar.requested_by=p_actor AND ar.decided_by<>p_actor
        AND ar.decided_at IS NOT NULL AND ar.valid_until IS NOT NULL
        AND ar.decided_at<=v_recorded AND ar.decided_at<ar.valid_until AND ar.valid_until>v_recorded
        AND ar.payload=pg_catalog.jsonb_build_object('propertyNode',p_property::text,
          'reservationId',p_reservation::text,'folioId',p_folio::text,'windowNo',v_folio.window_no,
          'buyerPartyId',p_buyer::text,'relationshipSetHash',v_relationship_hash,'requestHash',v_request_hash,
          'basisKind','native_consideration','serviceProvisionSnapshotId',p_service::text,
          'nativeApprovalBasisHash',v_approval_basis_hash)
      FOR SHARE OF ar,decider;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='exact current different-user native buyer approval unavailable'; END IF;
    v_approval_hash:=public.india_native_source_hash(pg_catalog.jsonb_build_array(
      'india-native-valuation-approval-v1',pg_catalog.to_jsonb(v_approval)));
  ELSIF p_approval IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='related buyer must not consume override approval';
  END IF;
  IF p_expected IS NOT NULL THEN
    SELECT val.* INTO v_current FROM public.india_gst_accommodation_final_valuation val
      WHERE val.tenant_id=p_tenant AND val.id=p_expected AND val.evidence_hash=p_expected_hash
        AND val.basis_kind='native_consideration' AND val.property_node=p_property
        AND val.reservation_id=p_reservation AND val.folio_id=p_folio
        AND val.native_service_provision_snapshot_id=p_service
        AND NOT EXISTS(SELECT 1 FROM public.india_gst_accommodation_final_valuation successor
          WHERE successor.tenant_id=val.tenant_id AND successor.supersedes_valuation_id=val.id)
      FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='expected native valuation head is stale'; END IF;
    v_generation:=v_current.generation+1;
  ELSIF EXISTS(SELECT 1 FROM public.india_gst_accommodation_final_valuation val
    WHERE val.tenant_id=p_tenant AND val.reservation_id=p_reservation AND val.folio_id=p_folio) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='initial native valuation scope already exists';
  END IF;
  -- Finalized applicability or issued fiscal sources are not silently relabelled
  -- into a new pre-invoice valuation. Later corrections need their own command.
  IF EXISTS(SELECT 1 FROM public.india_gst_accommodation_quoted_rate_applicability a
      WHERE a.tenant_id=p_tenant AND a.reservation_id=p_reservation AND a.folio_id=p_folio)
     OR EXISTS(SELECT 1 FROM public.india_gst_native_fiscal_document_origin o
      WHERE o.tenant_id=p_tenant AND o.reservation_id=p_reservation AND o.folio_id=p_folio) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native consideration scope has already entered fiscal completion';
  END IF;
  FOR v_i IN 0..v_n-1 LOOP
    v_input_source:=v_request_sources->v_i;
    v_source:=v_source_graph->'sources'->v_i;
    IF v_input_source->>'postingRootId' IS DISTINCT FROM v_source->>'postingRootId' THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native source tuple ordering is inconsistent';
    END IF;
    v_amount:=(v_source->>'currentAmountMinor')::bigint;
    IF ((v_input_source->>'sourceKind') IN ('promotion_discount','section15_3_discount'))<>(v_amount<0) THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='native source classification sign conflicts';
    END IF;
    IF p_expected IS NOT NULL AND EXISTS(
      SELECT 1 FROM public.india_gst_accommodation_valuation_source old
      WHERE old.tenant_id=p_tenant AND old.valuation_id=p_expected
        AND old.posting_root_id=(v_source->>'postingRootId')::uuid
        AND (old.source_kind IS DISTINCT FROM v_input_source->>'sourceKind'
          OR old.addition_subtype IS DISTINCT FROM v_input_source->>'additionSubtype'
          OR old.discount_eligibility IS DISTINCT FROM v_input_source->>'discountEligibility'
          OR old.evidence_source IS DISTINCT FROM v_input_source->>'evidenceSource'
          OR old.evidence_reference IS DISTINCT FROM v_input_source->>'evidenceReference')) THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native generation cannot reclassify an existing root';
    END IF;
    v_allocation:=public.india_native_signed_allocations(v_amount,v_weights);
    v_class_hash:=public.india_native_source_hash(pg_catalog.jsonb_build_array(
      'india-native-valuation-classification-v1',v_input_source,p_actor));
    v_eligibility_hash:=CASE WHEN v_input_source->>'sourceKind'='section15_3_discount'
      THEN public.india_native_source_hash(pg_catalog.jsonb_build_array(
        'india-native-valuation-discount-v1',v_input_source,p_actor)) END;
    v_basis_sources:=v_basis_sources||pg_catalog.jsonb_build_array(v_input_source||
      pg_catalog.jsonb_build_object('currentAmountMinor',v_amount::text,'currency','INR',
        'txCode',v_source->>'txCode','currentFragmentSetHash',v_source->>'currentFragmentSetHash',
        'classificationEvidenceHash',v_class_hash,'eligibilityEvidenceHash',v_eligibility_hash,
        'attestedBy',p_actor,'allocations',(SELECT pg_catalog.jsonb_agg(a::text ORDER BY ord)
          FROM pg_catalog.unnest(v_allocation) WITH ORDINALITY allocations(a,ord))));
    v_total:=v_total+v_amount;
    FOR v_j IN 1..v_nights LOOP v_night_totals[v_j]:=v_night_totals[v_j]+v_allocation[v_j]; END LOOP;
  END LOOP;
  IF v_total NOT BETWEEN 1 AND 9223372036854775807::numeric THEN
    RAISE EXCEPTION USING ERRCODE='22003',MESSAGE='native consideration total must be positive signed int64';
  END IF;
  FOR v_j IN 1..v_nights LOOP
    IF v_night_totals[v_j] NOT BETWEEN 1 AND 9223372036854775807::numeric THEN
      RAISE EXCEPTION USING ERRCODE='22003',MESSAGE='every native room-night value must be positive signed int64';
    END IF;
    v_basis_nights:=v_basis_nights||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'ordinal',v_j-1,'businessDate',v_dates[v_j],'quotedWeightMinor',v_weights[v_j]::text,
      'transactionValueMinor',v_night_totals[v_j]::bigint::text));
  END LOOP;
  SELECT pg_catalog.encode(public.digest(pg_catalog.string_agg(id::text,',' ORDER BY id),'sha256'),'hex')
    INTO v_source_hash FROM pg_catalog.unnest(v_ids) id;
  v_ordinary_hashes:=ARRAY[
    public.india_native_source_hash(pg_catalog.jsonb_build_array('relationship',p_relationship,p_attestation_source,p_attestation_reference,p_actor)),
    public.india_native_source_hash(pg_catalog.jsonb_build_array('consideration',p_consideration,p_attestation_source,p_attestation_reference,p_actor)),
    public.india_native_source_hash(pg_catalog.jsonb_build_array('section152',p_section152,p_attestation_source,p_attestation_reference,p_actor)),
    public.india_native_source_hash(pg_catalog.jsonb_build_array('section153',p_section153,p_attestation_source,p_attestation_reference,p_actor)),
    public.india_native_source_hash(pg_catalog.jsonb_build_array('source-completeness',p_source_completeness,p_attestation_source,p_attestation_reference,p_actor))];
  v_basis:=pg_catalog.jsonb_build_object('kind','india-native-consideration-basis-v1',
    'tenantId',p_tenant,'propertyNode',p_property,'reservationId',p_reservation,'folioId',p_folio,
    'folioAccountId',v_folio.account_id,'windowNo',v_folio.window_no,'buyerPartyId',p_buyer,
    'serviceProvisionSnapshotId',p_service,'serviceEvidenceHash',v_service.evidence_hash,
    'lineage',pg_catalog.to_jsonb(v_lineage),'attributionSnapshotHash',v_attribution.snapshot_hash,
    'sourceSetHash',v_source_hash,'sources',v_basis_sources,'roomNights',v_basis_nights,
    'ordinaryAttestation',v_ordinary,'ordinaryEvidenceHashes',v_ordinary_hashes,
    'relationshipSetHash',v_relationship_hash,'nativeApprovalBasisHash',v_approval_basis_hash,
    'approvalRequestId',p_approval,'approvalEvidenceHash',v_approval_hash,
    'approvalActorId',v_approval.decided_by,'approvalDecidedAt',v_approval.decided_at,
    'approvalValidUntil',v_approval.valid_until,'currency','INR','transactionValueMinor',v_total::bigint::text);
  v_basis_hash:=public.india_native_source_hash(v_basis);
  v_evidence_hash:=public.india_native_source_hash(pg_catalog.jsonb_build_array(
    'india-native-valuation-root-v1',v_id,p_tenant,p_request,p_actor,v_key_hash,v_request_hash,
    v_basis_hash,v_generation,p_expected,p_expected_hash,v_recorded));
  INSERT INTO public.india_gst_accommodation_final_valuation(
    tenant_id,id,property_node,reservation_id,folio_id,folio_account_id,window_no,buyer_party_id,
    attribution_id,request_id,generation,disposition,currency,transaction_value_minor,source_set_hash,
    order341_evidence_hash,request_hash,evidence_hash,ordinary_evidence_hashes,manual_reasons,
    relationship_conclusion,consideration_conclusion,section15_2_conclusion,section15_3_conclusion,
    source_completeness_conclusion,attestation_evidence_source,attestation_evidence_reference,
    relationship_set_hash,attested_by,attested_at,approval_request_id,supersedes_valuation_id,actor_id,recorded_at,
    basis_kind,native_service_provision_snapshot_id,native_lineage_id,native_consideration_basis_hash,
    native_request_key_hash,native_approval_basis_hash,native_approval_actor_id,native_approval_decided_at,
    native_approval_valid_until,native_approval_evidence_hash,native_source_count,native_room_night_count,native_recording_xid)
  VALUES(p_tenant,v_id,p_property,p_reservation,p_folio,v_folio.account_id,v_folio.window_no,p_buyer,
    v_lineage.attribution_id,p_request,v_generation,'ordinary_final','INR',v_total::bigint,v_source_hash,
    NULL,v_request_hash,v_evidence_hash,v_ordinary_hashes,'{}',p_relationship,p_consideration,p_section152,p_section153,
    p_source_completeness,p_attestation_source,p_attestation_reference,v_relationship_hash,p_actor,v_recorded,
    p_approval,p_expected,p_actor,v_recorded,'native_consideration',p_service,v_lineage.id,v_basis_hash,
    v_key_hash,v_approval_basis_hash,v_approval.decided_by,v_approval.decided_at,v_approval.valid_until,
    v_approval_hash,v_n,v_nights,pg_catalog.pg_current_xact_id());
  INSERT INTO public.india_gst_accommodation_valuation_source(
    tenant_id,valuation_id,posting_root_id,source_kind,current_amount_minor,currency,tx_code,
    current_fragment_set_hash,classification_evidence_hash,eligibility_evidence_hash,addition_subtype,
    discount_eligibility,evidence_source,evidence_reference,attested_by,attested_at,basis_kind)
  SELECT p_tenant,v_id,(s->>'postingRootId')::uuid,s->>'sourceKind',(s->>'currentAmountMinor')::bigint,
    'INR',s->>'txCode',s->>'currentFragmentSetHash',s->>'classificationEvidenceHash',
    s->>'eligibilityEvidenceHash',s->>'additionSubtype',s->>'discountEligibility',
    s->>'evidenceSource',s->>'evidenceReference',p_actor,v_recorded,'native_consideration'
    FROM pg_catalog.jsonb_array_elements(v_basis_sources) s;
  INSERT INTO public.india_gst_accommodation_valuation_room_night(
    tenant_id,valuation_id,ordinal,business_date,quoted_weight_minor,transaction_value_minor,currency,basis_kind)
  SELECT p_tenant,v_id,(n->>'ordinal')::integer,(n->>'businessDate')::date,
    (n->>'quotedWeightMinor')::bigint,(n->>'transactionValueMinor')::bigint,'INR','native_consideration'
    FROM pg_catalog.jsonb_array_elements(v_basis_nights) n;
  INSERT INTO public.india_gst_accommodation_valuation_allocation(
    tenant_id,valuation_id,posting_root_id,ordinal,amount_minor,currency,basis_kind)
  SELECT p_tenant,v_id,(s->>'postingRootId')::uuid,(a.ordinality-1)::integer,
    a.amount::bigint,'INR','native_consideration'
    FROM pg_catalog.jsonb_array_elements(v_basis_sources) s
    CROSS JOIN LATERAL pg_catalog.jsonb_array_elements_text(s->'allocations')
      WITH ORDINALITY a(amount,ordinality) WHERE a.amount::bigint<>0;
  v_payload:=pg_catalog.jsonb_build_object('valuationId',v_id,'reservationId',p_reservation,
    'folioId',p_folio,'windowNo',v_folio.window_no,'buyerPartyId',p_buyer,'generation',v_generation,
    'disposition','ordinary_final','evidenceHash',v_evidence_hash);
  INSERT INTO public.fact_log(tenant_id,entity_type,entity_id,fact_type,valid_from,business_date,actor_id,payload,supersedes)
    VALUES(p_tenant,'india_gst_accommodation_final_valuation',v_id,'recorded',v_recorded,
      v_business_date,p_actor,pg_catalog.jsonb_build_object('valuationId',v_id,
        'disposition','ordinary_final','evidenceHash',v_evidence_hash),
      (SELECT f.id FROM public.fact_log f WHERE f.tenant_id=p_tenant
        AND f.entity_type='india_gst_accommodation_final_valuation' AND f.entity_id=p_expected
        ORDER BY f.recorded_at DESC LIMIT 1));
  PERFORM pg_catalog.pg_advisory_xact_lock(6441674055002974568);
  INSERT INTO public.outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,
    event_type,event_version,actor_id,correlation_id,payload)
    VALUES(p_tenant,p_property,v_business_date,'india_gst_accommodation_final_valuation',v_id,
      'india_gst.accommodation_final_valuation_recorded',1,p_actor,p_request,v_payload);
  RETURN QUERY SELECT v_id,v_generation,'ordinary_final'::text,v_total::bigint,
    v_evidence_hash,v_basis_hash,true;
END;
$$;
ALTER FUNCTION public.record_india_gst_native_accommodation_valuation(
  uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid,text,uuid,
  text,text,text,text,text,text,text,uuid[],text[],text[],text[],text[],text[]) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.record_india_gst_native_accommodation_valuation(
  uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid,text,uuid,
  text,text,text,text,text,text,text,uuid[],text[],text[],text[],text[],text[])
  FROM PUBLIC,app_role,yellow_runtime;
GRANT EXECUTE ON FUNCTION public.record_india_gst_native_accommodation_valuation(
  uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid,text,uuid,
  text,text,text,text,text,text,text,uuid[],text[],text[],text[],text[],text[]) TO app_role;

-- Native children can only be born with the native aggregate in the same real
-- PostgreSQL transaction. Old external writers and rows retain their behavior.
CREATE FUNCTION public.guard_native_valuation_child_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.basis_kind='native_consideration' AND NOT EXISTS(
    SELECT 1 FROM public.india_gst_accommodation_final_valuation v
    WHERE v.tenant_id=NEW.tenant_id AND v.id=NEW.valuation_id
      AND v.basis_kind='native_consideration' AND v.native_recording_xid=pg_catalog.pg_current_xact_id()
  ) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native valuation children require their aggregate recording transaction';
  END IF;
  RETURN NEW;
END;
$$;
ALTER FUNCTION public.guard_native_valuation_child_insert() OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.guard_native_valuation_child_insert() FROM PUBLIC,app_role,yellow_runtime;
DO $native_children$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['india_gst_accommodation_valuation_source',
    'india_gst_accommodation_valuation_room_night','india_gst_accommodation_valuation_allocation'] LOOP
    EXECUTE pg_catalog.format('CREATE TRIGGER native_valuation_child_birth BEFORE INSERT ON public.%I
      FOR EACH ROW EXECUTE FUNCTION public.guard_native_valuation_child_insert()',t);
  END LOOP;
END $native_children$;

CREATE FUNCTION public.assert_native_valuation_conservation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
DECLARE v_weights bigint[]; v_source record; v_actual bigint[]; v_count integer;
BEGIN
  IF NEW.basis_kind<>'native_consideration' THEN RETURN NULL; END IF;
  PERFORM pg_catalog.set_config('app.tenant_id',NEW.tenant_id::text,true);
  IF (SELECT pg_catalog.count(*) FROM public.india_gst_accommodation_valuation_source s
      WHERE s.tenant_id=NEW.tenant_id AND s.valuation_id=NEW.id)<>NEW.native_source_count
    OR (SELECT pg_catalog.sum(s.current_amount_minor::numeric)
      FROM public.india_gst_accommodation_valuation_source s
      WHERE s.tenant_id=NEW.tenant_id AND s.valuation_id=NEW.id) IS DISTINCT FROM NEW.transaction_value_minor::numeric
    OR (SELECT pg_catalog.sum(n.transaction_value_minor::numeric)
      FROM public.india_gst_accommodation_valuation_room_night n
      WHERE n.tenant_id=NEW.tenant_id AND n.valuation_id=NEW.id) IS DISTINCT FROM NEW.transaction_value_minor::numeric
    OR EXISTS(SELECT 1 FROM public.india_gst_accommodation_valuation_source s
      WHERE s.tenant_id=NEW.tenant_id AND s.valuation_id=NEW.id
        AND (s.attested_by<>NEW.actor_id OR s.attested_at<>NEW.recorded_at)) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native valuation source conservation or actor binding failed';
  END IF;
  SELECT pg_catalog.count(*),pg_catalog.array_agg(n.quoted_weight_minor ORDER BY n.ordinal)
    INTO v_count,v_weights FROM public.india_gst_accommodation_valuation_room_night n
    WHERE n.tenant_id=NEW.tenant_id AND n.valuation_id=NEW.id;
  IF v_count<>NEW.native_room_night_count OR EXISTS(
    SELECT 1 FROM public.india_gst_accommodation_valuation_room_night n
    WHERE n.tenant_id=NEW.tenant_id AND n.valuation_id=NEW.id
      AND (n.ordinal>=v_count OR n.transaction_value_minor IS NULL OR n.transaction_value_minor<=0
        OR n.transaction_value_minor::numeric IS DISTINCT FROM
          (SELECT COALESCE(pg_catalog.sum(a.amount_minor::numeric),0)
           FROM public.india_gst_accommodation_valuation_allocation a
           WHERE a.tenant_id=n.tenant_id AND a.valuation_id=n.valuation_id AND a.ordinal=n.ordinal))
  ) THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native valuation room-night conservation failed'; END IF;
  FOR v_source IN SELECT s.* FROM public.india_gst_accommodation_valuation_source s
    WHERE s.tenant_id=NEW.tenant_id AND s.valuation_id=NEW.id ORDER BY s.posting_root_id LOOP
    SELECT pg_catalog.array_agg(COALESCE(a.amount_minor,0) ORDER BY n.ordinal) INTO v_actual
      FROM public.india_gst_accommodation_valuation_room_night n
      LEFT JOIN public.india_gst_accommodation_valuation_allocation a
        ON a.tenant_id=n.tenant_id AND a.valuation_id=n.valuation_id AND a.ordinal=n.ordinal
        AND a.posting_root_id=v_source.posting_root_id
      WHERE n.tenant_id=NEW.tenant_id AND n.valuation_id=NEW.id;
    IF v_actual IS DISTINCT FROM public.india_native_signed_allocations(v_source.current_amount_minor,v_weights) THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native valuation signed-largest-remainder proof failed';
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;
ALTER FUNCTION public.assert_native_valuation_conservation() OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.assert_native_valuation_conservation() FROM PUBLIC,app_role,yellow_runtime;
CREATE CONSTRAINT TRIGGER native_valuation_conservation AFTER INSERT
  ON public.india_gst_accommodation_final_valuation DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.assert_native_valuation_conservation();
