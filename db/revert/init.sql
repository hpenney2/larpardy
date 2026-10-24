-- Revert larpardy:init from pg

BEGIN;

DROP TYPE BoardPrivacy CASCADE;

DROP INDEX idx_usernames CASCADE;
DROP TABLE users CASCADE;

DROP INDEX idx_board_titles CASCADE;
DROP TABLE boards CASCADE;

DROP INDEX idx_favorite_boards CASCADE;
DROP TABLE favorite_boards CASCADE;

DROP INDEX idx_board_plays CASCADE;
DROP TABLE board_plays CASCADE;

DROP EXTENSION pg_trgm;

COMMIT;
