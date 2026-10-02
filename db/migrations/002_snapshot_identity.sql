CREATE UNIQUE INDEX snapshot_content_identity ON raw_snapshot(source,entity_ico,period,report,sha256) NULLS NOT DISTINCT;
