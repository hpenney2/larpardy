-- Revert larpardy:updates_log from pg

BEGIN;

DROP TABLE updates_log CASCADE;

COMMIT;
