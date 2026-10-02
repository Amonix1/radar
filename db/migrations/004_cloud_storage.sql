CREATE TABLE raw_archive (
 sha256 char(64) PRIMARY KEY CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 byte_length bigint NOT NULL CHECK(byte_length > 0),
 storage_uri text NOT NULL UNIQUE,
 archived_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER protect_raw_archive BEFORE UPDATE OR DELETE ON raw_archive
 FOR EACH ROW EXECUTE FUNCTION immutable_raw();
CREATE TABLE scheduled_sync (
 scheduled_at timestamptz PRIMARY KEY,
 invocation_id text NOT NULL,
 status text NOT NULL CHECK(status IN ('running','success','failed')),
 attempts integer NOT NULL DEFAULT 1,
 started_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz,
 sync_run_id bigint REFERENCES sync_run
);
