CREATE TABLE access_attempt (
 bucket text PRIMARY KEY,
 started_at timestamptz NOT NULL DEFAULT now(),
 attempts integer NOT NULL CHECK (attempts > 0)
);
