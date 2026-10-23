-- Verify larpardy:updates_log on pg

BEGIN;

SELECT id, updated_at, title, content FROM updates_log WHERE FALSE;
SELECT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_updates_when'
);

ROLLBACK;
