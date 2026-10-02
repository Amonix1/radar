CREATE TABLE schema_migration(version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE entity(ico char(8) PRIMARY KEY, name text NOT NULL);
INSERT INTO entity VALUES ('00266027','Město Litvínov');
CREATE TABLE raw_snapshot (
 id bigserial PRIMARY KEY, source text NOT NULL, source_url text NOT NULL, entity_ico char(8) REFERENCES entity,
 period date, report text NOT NULL, imported_at timestamptz NOT NULL DEFAULT now(),
 sha256 char(64) NOT NULL, payload text NOT NULL, visibility text NOT NULL DEFAULT 'public' CHECK(visibility IN ('public','internal')),
 UNIQUE(source, entity_ico, period, report, sha256)
);
CREATE FUNCTION immutable_raw() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'RAW snapshots are immutable'; END; $$;
CREATE TRIGGER protect_raw BEFORE UPDATE OR DELETE ON raw_snapshot FOR EACH ROW EXECUTE FUNCTION immutable_raw();
CREATE TABLE dimension_code (
 snapshot_id bigint REFERENCES raw_snapshot, kind text NOT NULL, code text NOT NULL, valid_from date NOT NULL, valid_to date NOT NULL,
 name text NOT NULL, group_name text, class_name text, consolidation boolean NOT NULL DEFAULT false,
 PRIMARY KEY(snapshot_id,kind,code,valid_from)
);
CREATE TABLE budget_fact (
 snapshot_id bigint REFERENCES raw_snapshot, row_number integer NOT NULL,
 paragraph char(4) NOT NULL, item char(4) NOT NULL, flow text NOT NULL CHECK(flow IN ('income','expense','financing')),
 class_code char(1) NOT NULL, purpose text, department text, org text, project text, partner text, instrument text, spatial text,
 paragraph_name text NOT NULL, item_name text NOT NULL, sector text NOT NULL,
 consolidated_out boolean NOT NULL,
 approved_cents bigint NOT NULL, amended_cents bigint NOT NULL, actual_cents bigint NOT NULL,
 original_values jsonb NOT NULL,
 PRIMARY KEY(snapshot_id,row_number)
);
CREATE INDEX fact_drill ON budget_fact(snapshot_id,flow,paragraph,item);
CREATE TABLE account_fact (
 snapshot_id bigint REFERENCES raw_snapshot, section text NOT NULL, code text NOT NULL, account text NOT NULL DEFAULT '',
 amount_cents bigint NOT NULL, original_values jsonb NOT NULL, PRIMARY KEY(snapshot_id,section,code,account)
);
CREATE TABLE validation_result (
 id bigserial PRIMARY KEY, snapshot_id bigint REFERENCES raw_snapshot, check_name text NOT NULL,
 passed boolean NOT NULL, details jsonb NOT NULL
);
CREATE TABLE active_statement (
 entity_ico char(8) REFERENCES entity, period date NOT NULL, family text NOT NULL, snapshot_id bigint REFERENCES raw_snapshot,
 PRIMARY KEY(entity_ico,period,family)
);
CREATE TABLE metric_aggregate (
 snapshot_id bigint REFERENCES raw_snapshot, metric text NOT NULL, approved_cents bigint, amended_cents bigint, actual_cents bigint,
 PRIMARY KEY(snapshot_id,metric)
);
CREATE TABLE external_observation (
 snapshot_id bigint REFERENCES raw_snapshot, entity_ico char(8) REFERENCES entity, year integer NOT NULL,
 kind text NOT NULL CHECK(kind IN ('population','cpi')), value numeric NOT NULL, PRIMARY KEY(snapshot_id,entity_ico,year,kind)
);
CREATE TABLE sync_run (
 id bigserial PRIMARY KEY, started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
 status text NOT NULL DEFAULT 'running', imported integer NOT NULL DEFAULT 0, skipped integer NOT NULL DEFAULT 0, errors jsonb NOT NULL DEFAULT '[]'
);
CREATE VIEW public_budget_fact AS SELECT f.*,s.period,s.entity_ico,s.imported_at,s.source_url,s.report
 FROM budget_fact f JOIN raw_snapshot s ON s.id=f.snapshot_id
 JOIN active_statement a ON a.snapshot_id=s.id AND a.family='budget'
 WHERE s.visibility='public';
CREATE VIEW public_metrics AS SELECT m.*,s.period,s.entity_ico,s.imported_at,s.source_url,s.report
 FROM metric_aggregate m JOIN raw_snapshot s ON s.id=m.snapshot_id
 JOIN active_statement a ON a.snapshot_id=s.id AND a.family='budget'
 WHERE s.visibility='public';
