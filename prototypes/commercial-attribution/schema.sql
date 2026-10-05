DROP SCHEMA IF EXISTS commercial_proto CASCADE;
CREATE SCHEMA commercial_proto;

CREATE TABLE commercial_proto.tenant_scope (tenant_id uuid PRIMARY KEY,code text NOT NULL UNIQUE);
CREATE TABLE commercial_proto.org_node (
 tenant_id uuid NOT NULL,id uuid NOT NULL,parent_id uuid,kind text NOT NULL CHECK(kind IN('chain','brand','region','property')),
 code text NOT NULL,name text NOT NULL,base_currency char(3),PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,code),
 FOREIGN KEY(tenant_id,parent_id) REFERENCES commercial_proto.org_node(tenant_id,id),
 CHECK(kind<>'property' OR base_currency IS NOT NULL));
CREATE TABLE commercial_proto.property_grant (
 tenant_id uuid NOT NULL,actor_id uuid NOT NULL,property_id uuid NOT NULL,PRIMARY KEY(tenant_id,actor_id,property_id),
 FOREIGN KEY(tenant_id,property_id) REFERENCES commercial_proto.org_node(tenant_id,id));
CREATE TABLE commercial_proto.taxonomy_version (
 tenant_id uuid NOT NULL,id uuid NOT NULL,version integer NOT NULL CHECK(version>0),effective daterange NOT NULL,
 recorded_at timestamptz NOT NULL,status text NOT NULL CHECK(status IN('draft','active','retired')),
 PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,version));
CREATE TABLE commercial_proto.demand_node (
 tenant_id uuid NOT NULL,version_id uuid NOT NULL,id uuid NOT NULL,parent_id uuid,kind text NOT NULL CHECK(kind IN('msg','ms')),
 code text NOT NULL,name text NOT NULL,PRIMARY KEY(tenant_id,version_id,id),UNIQUE(tenant_id,version_id,kind,code),
 FOREIGN KEY(tenant_id,version_id) REFERENCES commercial_proto.taxonomy_version(tenant_id,id),
 FOREIGN KEY(tenant_id,version_id,parent_id) REFERENCES commercial_proto.demand_node(tenant_id,version_id,id),
 CHECK((kind='msg' AND parent_id IS NULL) OR(kind='ms' AND parent_id IS NOT NULL)));
CREATE TABLE commercial_proto.inventory_date (
 tenant_id uuid NOT NULL,property_id uuid NOT NULL,business_date date NOT NULL,counting_basis text NOT NULL CHECK(counting_basis IN('room','bed')),
 rooms_available integer CHECK(rooms_available>=0),history_status text NOT NULL CHECK(history_status IN('known','missing','overlap_unsupported')),
 PRIMARY KEY(tenant_id,property_id,business_date,counting_basis),FOREIGN KEY(tenant_id,property_id) REFERENCES commercial_proto.org_node(tenant_id,id),
 CHECK((history_status='known' AND rooms_available IS NOT NULL) OR(history_status<>'known' AND rooms_available IS NULL)));

-- One header per conserved reservation/property/date hotel-night; physical/product legs are separate children.
CREATE TABLE commercial_proto.stay_attribution (
 tenant_id uuid NOT NULL,property_id uuid NOT NULL,reservation_id uuid NOT NULL,business_date date NOT NULL,
 taxonomy_version_id uuid,msg_id uuid,ms_id uuid,channel_code text,source_code text,company_party_id uuid,
 company_mapping text NOT NULL CHECK(company_mapping IN('explicit','unmapped','ambiguous')),group_kind text,booking_currency char(3) NOT NULL,
 PRIMARY KEY(tenant_id,property_id,reservation_id,business_date),FOREIGN KEY(tenant_id,property_id) REFERENCES commercial_proto.org_node(tenant_id,id),
 FOREIGN KEY(tenant_id,taxonomy_version_id) REFERENCES commercial_proto.taxonomy_version(tenant_id,id),
 FOREIGN KEY(tenant_id,taxonomy_version_id,msg_id) REFERENCES commercial_proto.demand_node(tenant_id,version_id,id),
 FOREIGN KEY(tenant_id,taxonomy_version_id,ms_id) REFERENCES commercial_proto.demand_node(tenant_id,version_id,id),
 CHECK((taxonomy_version_id IS NULL AND msg_id IS NULL AND ms_id IS NULL)OR(taxonomy_version_id IS NOT NULL AND msg_id IS NOT NULL AND ms_id IS NOT NULL)),
 CHECK((company_mapping='explicit' AND company_party_id IS NOT NULL)OR(company_mapping<>'explicit' AND company_party_id IS NULL)));
CREATE TABLE commercial_proto.stay_leg_source (
 tenant_id uuid NOT NULL,property_id uuid NOT NULL,reservation_id uuid NOT NULL,business_date date NOT NULL,leg_no smallint NOT NULL,
 lifecycle_status text NOT NULL CHECK(lifecycle_status IN('reserved','in_house','departed','cancelled','no_show','early_departed')),
 occupied_evidence boolean NOT NULL,planned_evidence boolean NOT NULL,room_class_code text,unit_type_code text,allocation_weight numeric(12,9),
 PRIMARY KEY(tenant_id,property_id,reservation_id,business_date,leg_no),
 FOREIGN KEY(tenant_id,property_id,reservation_id,business_date) REFERENCES commercial_proto.stay_attribution(tenant_id,property_id,reservation_id,business_date),
 CHECK(NOT(occupied_evidence AND planned_evidence)),CHECK((occupied_evidence OR planned_evidence)=(allocation_weight IS NOT NULL)),
 CHECK(allocation_weight IS NULL OR(allocation_weight>0 AND allocation_weight<=1)),
 CHECK((allocation_weight IS NULL AND room_class_code IS NULL AND unit_type_code IS NULL)OR(allocation_weight IS NOT NULL AND room_class_code IS NOT NULL AND unit_type_code IS NOT NULL)));
CREATE TABLE commercial_proto.reservation_sharer (
 tenant_id uuid NOT NULL,property_id uuid NOT NULL,reservation_id uuid NOT NULL,party_id uuid NOT NULL,
 PRIMARY KEY(tenant_id,property_id,reservation_id,party_id));

CREATE TABLE commercial_proto.raw_posting_line (
 tenant_id uuid NOT NULL,posting_line_id uuid NOT NULL,journal_id uuid NOT NULL,property_id uuid NOT NULL,business_date date NOT NULL,
 account_role text NOT NULL CHECK(account_role IN('guest','revenue','tax_payable')),account_class text,amount_minor numeric(40,0) NOT NULL,
 currency char(3) NOT NULL,quantity numeric(12,3) NOT NULL DEFAULT 1,folio_id uuid,reverses_journal_id uuid,
 PRIMARY KEY(tenant_id,posting_line_id),FOREIGN KEY(tenant_id,property_id) REFERENCES commercial_proto.org_node(tenant_id,id),
 CHECK((account_role='revenue')=(account_class IS NOT NULL)));
-- Only classification is stored here. Signed amount/date/currency/property always come from raw_posting_line.
CREATE TABLE commercial_proto.revenue_attribution (
 tenant_id uuid NOT NULL,posting_line_id uuid NOT NULL,reservation_id uuid,association_status text NOT NULL CHECK(association_status IN('allocated','unallocated','ambiguous')),
 taxonomy_version_id uuid,msg_id uuid,ms_id uuid,channel_code text,source_code text,company_party_id uuid,
 company_mapping text NOT NULL CHECK(company_mapping IN('explicit','unmapped','ambiguous')),room_class_code text,unit_type_code text,
 PRIMARY KEY(tenant_id,posting_line_id),FOREIGN KEY(tenant_id,posting_line_id) REFERENCES commercial_proto.raw_posting_line(tenant_id,posting_line_id),
 FOREIGN KEY(tenant_id,taxonomy_version_id) REFERENCES commercial_proto.taxonomy_version(tenant_id,id),
 FOREIGN KEY(tenant_id,taxonomy_version_id,msg_id) REFERENCES commercial_proto.demand_node(tenant_id,version_id,id),
 FOREIGN KEY(tenant_id,taxonomy_version_id,ms_id) REFERENCES commercial_proto.demand_node(tenant_id,version_id,id),
 CHECK((taxonomy_version_id IS NULL AND msg_id IS NULL AND ms_id IS NULL)OR(taxonomy_version_id IS NOT NULL AND msg_id IS NOT NULL AND ms_id IS NOT NULL)),
 CHECK((company_mapping='explicit' AND company_party_id IS NOT NULL)OR(company_mapping<>'explicit' AND company_party_id IS NULL)));
CREATE TABLE commercial_proto.alternate_set_membership (
 tenant_id uuid NOT NULL,set_version uuid NOT NULL,set_code text NOT NULL,property_id uuid NOT NULL,
 PRIMARY KEY(tenant_id,set_version,set_code,property_id),FOREIGN KEY(tenant_id,property_id) REFERENCES commercial_proto.org_node(tenant_id,id));

CREATE UNLOGGED TABLE commercial_proto.benchmark_night (
 tenant_id uuid NOT NULL,property_id uuid NOT NULL,business_date date NOT NULL,reservation_id bigint NOT NULL,
 msg_key smallint NOT NULL,ms_key smallint NOT NULL,channel_key smallint NOT NULL,source_key smallint NOT NULL,
 company_key smallint NOT NULL,room_class_key smallint NOT NULL,unit_type_key smallint NOT NULL,room_nights smallint NOT NULL CHECK(room_nights=1));
CREATE INDEX benchmark_night_rollup ON commercial_proto.benchmark_night(tenant_id,property_id,business_date,msg_key,ms_key);
CREATE INDEX benchmark_night_leaf ON commercial_proto.benchmark_night(tenant_id,property_id,business_date,reservation_id);
-- Disposable daily projection candidate. Its source remains benchmark_night and every
-- scope is rebuilt from that source; this is evidence for a later migration decision,
-- never an independently writable production truth.
CREATE UNLOGGED TABLE commercial_proto.benchmark_rollup (
 tenant_id uuid NOT NULL,property_id uuid NOT NULL,business_date date NOT NULL,
 scope text NOT NULL CHECK(scope IN('hotel','organization','chain','brand','region','msg','ms','channel','source','company','room_class','unit_type')),
 dimension_key text NOT NULL,room_nights bigint NOT NULL CHECK(room_nights>=0),
 PRIMARY KEY(tenant_id,property_id,business_date,scope,dimension_key));
CREATE INDEX benchmark_rollup_scope ON commercial_proto.benchmark_rollup(tenant_id,property_id,scope,business_date,dimension_key)INCLUDE(room_nights);

CREATE OR REPLACE FUNCTION commercial_proto.assert_demand_parent() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE k text;BEGIN IF NEW.kind='msg'THEN RETURN NEW;END IF;SELECT kind INTO k FROM commercial_proto.demand_node
WHERE tenant_id=NEW.tenant_id AND version_id=NEW.version_id AND id=NEW.parent_id;
IF k IS DISTINCT FROM'msg'THEN RAISE EXCEPTION'MS parent must be MSG';END IF;RETURN NEW;END$$;
CREATE TRIGGER demand_parent_guard BEFORE INSERT OR UPDATE ON commercial_proto.demand_node FOR EACH ROW EXECUTE FUNCTION commercial_proto.assert_demand_parent();
CREATE OR REPLACE FUNCTION commercial_proto.assert_attribution_pair() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p uuid;BEGIN IF NEW.taxonomy_version_id IS NULL THEN RETURN NEW;END IF;SELECT parent_id INTO p FROM commercial_proto.demand_node
WHERE tenant_id=NEW.tenant_id AND version_id=NEW.taxonomy_version_id AND id=NEW.ms_id AND kind='ms';
IF p IS DISTINCT FROM NEW.msg_id THEN RAISE EXCEPTION'MS does not belong to MSG';END IF;RETURN NEW;END$$;
CREATE TRIGGER stay_pair_guard BEFORE INSERT OR UPDATE ON commercial_proto.stay_attribution FOR EACH ROW EXECUTE FUNCTION commercial_proto.assert_attribution_pair();
CREATE TRIGGER revenue_pair_guard BEFORE INSERT OR UPDATE ON commercial_proto.revenue_attribution FOR EACH ROW EXECUTE FUNCTION commercial_proto.assert_attribution_pair();

CREATE OR REPLACE FUNCTION commercial_proto.assert_stay_conservation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s record;a numeric;p numeric;ac int;pc int;BEGIN s:=CASE WHEN TG_OP='DELETE'THEN OLD ELSE NEW END;
SELECT COALESCE(sum(allocation_weight)FILTER(WHERE occupied_evidence),0),COALESCE(sum(allocation_weight)FILTER(WHERE planned_evidence),0),
count(*)FILTER(WHERE occupied_evidence),count(*)FILTER(WHERE planned_evidence) INTO a,p,ac,pc FROM commercial_proto.stay_leg_source
WHERE tenant_id=s.tenant_id AND property_id=s.property_id AND reservation_id=s.reservation_id AND business_date=s.business_date;
IF ac>0 AND a<>1 THEN RAISE EXCEPTION'actual allocation weights must sum to one; got %',a;END IF;
IF pc>0 AND p<>1 THEN RAISE EXCEPTION'planned allocation weights must sum to one; got %',p;END IF;RETURN NULL;END$$;
CREATE CONSTRAINT TRIGGER stay_header_conservation AFTER INSERT OR UPDATE ON commercial_proto.stay_attribution DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION commercial_proto.assert_stay_conservation();
CREATE CONSTRAINT TRIGGER stay_leg_conservation AFTER INSERT OR UPDATE OR DELETE ON commercial_proto.stay_leg_source DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION commercial_proto.assert_stay_conservation();
CREATE OR REPLACE FUNCTION commercial_proto.immutable_stay_leg_key() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF(OLD.tenant_id,OLD.property_id,OLD.reservation_id,OLD.business_date,OLD.leg_no)IS DISTINCT FROM(NEW.tenant_id,NEW.property_id,NEW.reservation_id,NEW.business_date,NEW.leg_no)
THEN RAISE EXCEPTION'stay leg identity is immutable';END IF;RETURN NEW;END$$;
CREATE TRIGGER stay_leg_key_guard BEFORE UPDATE ON commercial_proto.stay_leg_source FOR EACH ROW EXECUTE FUNCTION commercial_proto.immutable_stay_leg_key();

CREATE OR REPLACE FUNCTION commercial_proto.assert_revenue_attribution() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s record;r text;n int;BEGIN s:=CASE WHEN TG_OP='DELETE'THEN OLD ELSE NEW END;SELECT account_role INTO r FROM commercial_proto.raw_posting_line
WHERE tenant_id=s.tenant_id AND posting_line_id=s.posting_line_id;SELECT count(*)INTO n FROM commercial_proto.revenue_attribution WHERE tenant_id=s.tenant_id AND posting_line_id=s.posting_line_id;
IF r='revenue'AND n<>1 THEN RAISE EXCEPTION'eligible revenue line requires exactly one attribution';END IF;
IF r IS DISTINCT FROM'revenue'AND n<>0 THEN RAISE EXCEPTION'non-revenue line cannot have revenue attribution';END IF;RETURN NULL;END$$;
CREATE CONSTRAINT TRIGGER raw_revenue_guard AFTER INSERT OR UPDATE OR DELETE ON commercial_proto.raw_posting_line DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION commercial_proto.assert_revenue_attribution();
CREATE CONSTRAINT TRIGGER revenue_mapping_guard AFTER INSERT OR UPDATE OR DELETE ON commercial_proto.revenue_attribution DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION commercial_proto.assert_revenue_attribution();
CREATE OR REPLACE FUNCTION commercial_proto.immutable_revenue_mapping_key() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF(OLD.tenant_id,OLD.posting_line_id)IS DISTINCT FROM(NEW.tenant_id,NEW.posting_line_id)
THEN RAISE EXCEPTION'revenue attribution identity is immutable';END IF;RETURN NEW;END$$;
CREATE TRIGGER revenue_mapping_key_guard BEFORE UPDATE ON commercial_proto.revenue_attribution FOR EACH ROW EXECUTE FUNCTION commercial_proto.immutable_revenue_mapping_key();

ALTER TABLE commercial_proto.tenant_scope ENABLE ROW LEVEL SECURITY;ALTER TABLE commercial_proto.tenant_scope FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON commercial_proto.tenant_scope USING(tenant_id=current_setting('app.tenant_id',true)::uuid);
DO $$DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['taxonomy_version','demand_node']LOOP
EXECUTE format('ALTER TABLE commercial_proto.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE commercial_proto.%I FORCE ROW LEVEL SECURITY',t);
EXECUTE format('CREATE POLICY tenant_isolation ON commercial_proto.%I USING(tenant_id=current_setting(''app.tenant_id'',true)::uuid)',t);END LOOP;END $$;
ALTER TABLE commercial_proto.property_grant ENABLE ROW LEVEL SECURITY;ALTER TABLE commercial_proto.property_grant FORCE ROW LEVEL SECURITY;
CREATE POLICY actor_grant_isolation ON commercial_proto.property_grant USING(tenant_id=current_setting('app.tenant_id',true)::uuid AND actor_id=NULLIF(current_setting('app.actor_id',true),'')::uuid AND property_id=NULLIF(current_setting('app.property_id',true),'')::uuid);
ALTER TABLE commercial_proto.org_node ENABLE ROW LEVEL SECURITY;ALTER TABLE commercial_proto.org_node FORCE ROW LEVEL SECURITY;
CREATE POLICY org_scope ON commercial_proto.org_node USING(tenant_id=current_setting('app.tenant_id',true)::uuid AND(kind<>'property'OR(id=NULLIF(current_setting('app.property_id',true),'')::uuid AND EXISTS(
SELECT 1 FROM commercial_proto.property_grant g WHERE g.tenant_id=org_node.tenant_id AND g.property_id=org_node.id AND g.actor_id=NULLIF(current_setting('app.actor_id',true),'')::uuid))));
DO $$DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['inventory_date','stay_attribution','stay_leg_source','reservation_sharer','raw_posting_line','alternate_set_membership','benchmark_night','benchmark_rollup']LOOP
EXECUTE format('ALTER TABLE commercial_proto.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE commercial_proto.%I FORCE ROW LEVEL SECURITY',t);
EXECUTE format('CREATE POLICY property_scope ON commercial_proto.%I USING(tenant_id=current_setting(''app.tenant_id'',true)::uuid AND property_id=NULLIF(current_setting(''app.property_id'',true),'''')::uuid AND EXISTS(SELECT 1 FROM commercial_proto.property_grant g WHERE g.tenant_id=current_setting(''app.tenant_id'',true)::uuid AND g.property_id=NULLIF(current_setting(''app.property_id'',true),'''')::uuid AND g.actor_id=NULLIF(current_setting(''app.actor_id'',true),'''')::uuid))',t);END LOOP;END $$;
ALTER TABLE commercial_proto.revenue_attribution ENABLE ROW LEVEL SECURITY;ALTER TABLE commercial_proto.revenue_attribution FORCE ROW LEVEL SECURITY;
CREATE POLICY property_scope ON commercial_proto.revenue_attribution USING(
 tenant_id=current_setting('app.tenant_id',true)::uuid AND EXISTS(
 SELECT 1 FROM commercial_proto.raw_posting_line r JOIN commercial_proto.property_grant g
 ON g.tenant_id=r.tenant_id AND g.property_id=r.property_id
 WHERE r.tenant_id=revenue_attribution.tenant_id AND r.posting_line_id=revenue_attribution.posting_line_id AND r.property_id=NULLIF(current_setting('app.property_id',true),'')::uuid
 AND g.actor_id=NULLIF(current_setting('app.actor_id',true),'')::uuid));
GRANT USAGE ON SCHEMA commercial_proto TO app_role;GRANT SELECT ON ALL TABLES IN SCHEMA commercial_proto TO app_role;
