-- Deploy larpardy:updates_log to pg

BEGIN;

CREATE TABLE updates_log(
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    title TEXT NOT NULL,
    content TEXT NOT NULL
);
CREATE INDEX idx_updates_when ON updates_log (updated_at);

COMMIT;
