-- Deploy larpardy:init to pg

BEGIN;

CREATE EXTENSION pg_trgm;

CREATE TYPE BoardPrivacy AS ENUM ('public', 'unlisted', 'private');

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT,
  last_login TIMESTAMPTZ DEFAULT NOW(),
  admin BOOLEAN DEFAULT false NOT NULL,
  restricted BOOLEAN DEFAULT false NOT NULL
);
CREATE INDEX idx_usernames ON users USING gin (username gin_trgm_ops);

CREATE TABLE boards ( 
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author TEXT NOT NULL REFERENCES users(id),  -- ON DELETE CASCADE,
  title TEXT NOT NULL,
  privacy BoardPrivacy DEFAULT 'public' NOT NULL,
  board JSONB NOT NULL,
  created TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  edited TIMESTAMPTZ,
  deleted TIMESTAMPTZ,
  restricted TIMESTAMPTZ
);
CREATE INDEX idx_board_titles ON boards USING gin (title gin_trgm_ops);

CREATE TABLE favorite_boards (
  id TEXT NOT NULL REFERENCES users(id),
  board UUID NOT NULL REFERENCES boards(id),
  CONSTRAINT UQ_user_board UNIQUE (id, board)
);
CREATE INDEX idx_favorite_boards ON favorite_boards (id);

CREATE TABLE board_plays (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  board UUID NOT NULL REFERENCES boards(id),
  by TEXT NOT NULL REFERENCES users(id),
  time TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX idx_board_plays ON board_plays (board);

COMMIT;
