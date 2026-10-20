-- Verify larpardy:init on pg

BEGIN;

SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'boardprivacy');

SELECT id, username, last_login, admin, restricted 
FROM users
WHERE FALSE;

SELECT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_usernames'
);

SELECT id, author, title, privacy, board, created, edited, deleted, restricted
FROM boards
WHERE FALSE;

SELECT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_board_titles'
);

SELECT id, board
FROM favorite_boards
WHERE FALSE;

SELECT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_favorite_boards'
);

SELECT board_plays
FROM board_plays
WHERE FALSE;

SELECT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_board_plays'
);

ROLLBACK;
