import type { GameBoard } from "@larpardy/shared/state";
import type {
  BoardPrivacy,
  BoardSearchSort,
  SearchBoard,
  SearchBoardPartial,
  UserBoard,
} from "@larpardy/shared/userBoards";
import type { FastifyInstance } from "fastify";
import fastifyPlugin from "fastify-plugin";
import { types, type PoolClient } from "pg";
import z from "zod";

type Awaitable<T> = T | Promise<T>;

const PAGE_SIZE = 20;

const SearchPaginationCursorSchema = z.object({
  id: z.uuidv4(),
  plays: z.int().min(0),
  favorites: z.int().min(0),
  similar: z.number(),
});
type SearchPaginationCursor = z.infer<typeof SearchPaginationCursorSchema>;

// TODO: we should probably be using a migration system!
const CREATE_TABLES_QUERY = `
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- https://stackoverflow.com/a/79938183
DO 'BEGIN
  CREATE TYPE BoardPrivacy AS ENUM (''public'', ''unlisted'', ''private'');
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;';

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT,
  last_login TIMESTAMPTZ DEFAULT NOW(),
  admin BOOLEAN DEFAULT false NOT NULL,
  restricted BOOLEAN DEFAULT false NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_usernames ON users USING gin (username gin_trgm_ops);

CREATE TABLE IF NOT EXISTS boards ( 
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
CREATE INDEX IF NOT EXISTS idx_board_titles ON boards USING gin (title gin_trgm_ops);

CREATE TABLE IF NOT EXISTS favorite_boards (
  id TEXT NOT NULL REFERENCES users(id),
  board UUID NOT NULL REFERENCES boards(id),
  CONSTRAINT UQ_user_board UNIQUE (id, board)
);
CREATE INDEX IF NOT EXISTS idx_favorite_boards ON favorite_boards (id);

CREATE TABLE IF NOT EXISTS board_plays (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  board UUID NOT NULL REFERENCES boards(id),
  by TEXT NOT NULL REFERENCES users(id),
  time TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_board_plays ON board_plays (board);
`;

function generateCursor(
  result: (SearchBoardPartial & { sml?: number })[],
): string {
  if (result.length < PAGE_SIZE) return "";

  const last = result.at(-1);

  if (last == null) return "";

  const data: SearchPaginationCursor = {
    id: last.id,
    plays: last.plays,
    favorites: last.favorites,
    similar: last.sml ?? -1,
  };

  return btoa(JSON.stringify(data));
}

class Database {
  constructor(private pg: FastifyInstance["pg"]) {}

  public async initDatabase() {
    await this.transaction(async (client) => {
      await client.query(CREATE_TABLES_QUERY);
      await client.query(
        `
        INSERT INTO users (id, admin)
        VALUES ($1, true)
        ON CONFLICT (id) DO UPDATE SET
          admin = true;
        `,
        [process.env.HOSTER_ID],
      );
    });
  }

  public async addUser(user: string, username: string) {
    await this.pg.query(
      `
      INSERT INTO users (id, username)
      VALUES ($1, $2)
      ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username,
        last_login = NOW();
      `,
      [user, username],
    );
  }

  public async isUserRestricted(user: string) {
    return ((
      await this.pg.query("SELECT restricted FROM users WHERE id = $1", [user])
    ).rows[0]?.restricted ?? false) as boolean;
  }

  public async putBoard(data: UserBoard, author: string, id?: string) {
    return await this.transaction(async (client) => {
      if (id) {
        const result = await client.query(
          `
          UPDATE boards
          SET
            title = $3,
            privacy = $4,
            board = $5,
            edited = NOW()
          WHERE id = $1 AND ((author = $2 AND deleted IS NULL AND restricted IS NULL) OR (SELECT admin FROM users WHERE id = $2)) -- AND NOT (SELECT restricted FROM users WHERE id = $2)
          RETURNING id;
        `,
          [id, author, data.title, data.privacy, JSON.stringify(data.board)],
        );
        return result.rows[0]?.id as string | undefined;
      } else {
        const result = await client.query(
          `
          INSERT INTO boards (author, title, privacy, board)
          VALUES ($1, $2, $3, $4)
          RETURNING id;
        `,
          [author, data.title, data.privacy, JSON.stringify(data.board)],
        );
        return result.rows[0].id as string;
      }
    });
  }

  public async getBoard(id: string, forUser: string = "-1") {
    return (
      await this.pg.query(
        `
        SELECT b.id, (users.id = $2) as owned, EXISTS (select id from favorite_boards where id = $2 and board = b.id) as favorited, COALESCE(users.username, '<unknown>') as author, b.title, b.created, b.edited, b.privacy, COUNT(distinct plays.id)::int as plays, COUNT(distinct fav.id)::int as favorites, b.restricted, b.board
        FROM boards as b
        LEFT JOIN board_plays AS plays ON b.id = plays.board
        LEFT JOIN favorite_boards AS fav ON b.id = fav.board
        LEFT JOIN users ON b.author = users.id
        WHERE b.id = $1 AND b.deleted IS NULL AND (b.restricted IS NULL OR (SELECT admin FROM users WHERE id = $2))
        GROUP BY b.id, users.id;
        `,
        [id, forUser],
      )
    ).rows[0] as SearchBoard | undefined;
  }

  public async setFavorite(board: string, user: string, value: boolean) {
    if (value) {
      await this.pg.query(
        `
          INSERT INTO favorite_boards (id, board)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING;
        `,
        [user, board],
      );
    } else {
      await this.pg.query(
        `
          DELETE FROM favorite_boards
          WHERE id = $1 AND board = $2;
        `,
        [user, board],
      );
    }
  }

  public async search(
    sort: BoardSearchSort,
    forUser: string,
    cursor?: string,
    query?: string,
  ): Promise<{
    results: SearchBoardPartial[];
    next: string;
  }> {
    if ((sort === "my_favorites" || sort === "my_boards") && !forUser) {
      throw Error("Cannot search for own data without a user.");
    } else if (sort === "relevance" && !query) {
      throw Error("Cannot sort by relevance without a search query.");
    }

    let cursorData: SearchPaginationCursor | undefined;
    if (cursor) {
      try {
        const decoded = JSON.parse(atob(cursor));
        cursorData = SearchPaginationCursorSchema.parse(decoded);
      } catch (err) {
        console.warn("Received invalid page cursor data.", err);
        throw Error("Invalid page cursor.");
      }
    }

    const queryIsID = z.uuid().safeParse(query).success;

    let result;
    switch (sort) {
      case "relevance":
        result = await this.pg.query(
          `
          SELECT b.id, (users.id = $2) as owned, EXISTS (select id from favorite_boards where id = $2 and board = b.id) as favorited, COALESCE(users.username, '<unknown>') as author, b.title, b.created, b.edited, b.privacy, COUNT(distinct plays.id)::int as plays, COUNT(distinct fav.id)::int as favorites, b.restricted, word_similarity($1::TEXT, b.title) as sml
          FROM boards as b
          LEFT JOIN board_plays AS plays ON b.id = plays.board
          LEFT JOIN favorite_boards AS fav ON b.id = fav.board
          LEFT JOIN users ON b.author = users.id
          WHERE (${queryIsID ? "(b.id = $1 AND (b.privacy <> 'private' OR (users.id = $2)))" : "$1 <% title AND (b.privacy = 'public' OR (users.id = $2))"}) 
                AND b.deleted IS NULL 
                AND (b.restricted IS NULL OR (SELECT admin FROM users WHERE id = $2))
          GROUP BY b.id, users.id
          HAVING ($5::REAL IS NULL OR $4::INT IS NULL OR $3::UUID IS NULL) OR (word_similarity($1::TEXT, b.title), COUNT(distinct plays.id)::int, b.id) < ($5, $4, $3)
          ORDER BY sml DESC, plays DESC, b.id DESC
          LIMIT 20;
          `,
          [
            query,
            forUser,
            cursorData?.id,
            cursorData?.plays,
            cursorData?.similar,
          ],
        );
        return {
          results: result.rows,
          next: generateCursor(result.rows),
        };
      case "plays":
        result = await this.pg.query(
          `
          SELECT b.id, (users.id = $2) as owned, EXISTS (select id from favorite_boards where id = $2 and board = b.id) as favorited, COALESCE(users.username, '<unknown>') as author, b.title, b.created, b.edited, b.privacy, COUNT(distinct plays.id)::int as plays, COUNT(distinct fav.id)::int as favorites, b.restricted
          FROM boards as b
          LEFT JOIN board_plays AS plays ON b.id = plays.board
          LEFT JOIN favorite_boards AS fav ON b.id = fav.board
          LEFT JOIN users ON b.author = users.id
          WHERE (${queryIsID ? "(b.id = $1 AND (b.privacy <> 'private' OR (users.id = $2)))" : "($1::TEXT IS NULL OR $1 = '' OR $1 <% title) AND (b.privacy = 'public' OR (users.id = $2))"}) AND b.deleted IS NULL AND (b.restricted IS NULL OR (SELECT admin FROM users WHERE id = $2))
          GROUP BY b.id, users.id
          HAVING ($4::INT IS NULL OR $3::UUID IS NULL) OR (COUNT(distinct plays.id)::int, b.id) < ($4, $3)
          ORDER BY plays DESC, b.id DESC
          LIMIT 20;
          `,
          [query, forUser, cursorData?.id, cursorData?.plays],
        );
        return {
          results: result.rows,
          next: generateCursor(result.rows),
        };
      case "favorites":
        result = await this.pg.query(
          `
          SELECT b.id, (users.id = $2) as owned, EXISTS (select id from favorite_boards where id = $2 and board = b.id) as favorited, COALESCE(users.username, '<unknown>') as author, b.title, b.created, b.edited, b.privacy, COUNT(distinct plays.id)::int as plays, COUNT(distinct fav.id)::int as favorites, b.restricted
          FROM boards as b
          LEFT JOIN board_plays AS plays ON b.id = plays.board
          LEFT JOIN favorite_boards AS fav ON b.id = fav.board
          LEFT JOIN users ON b.author = users.id
          WHERE (${queryIsID ? "(b.id = $1 AND (b.privacy <> 'private' OR (users.id = $2)))" : "($1::TEXT IS NULL OR $1 = '' OR $1 <% title) AND (b.privacy = 'public' OR (users.id = $2))"}) AND b.deleted IS NULL AND (b.restricted IS NULL OR (SELECT admin FROM users WHERE id = $2))
          GROUP BY b.id, users.id
          HAVING ($4::INT IS NULL OR $3::UUID IS NULL) OR (COUNT(distinct fav.id)::int, b.id) < ($4, $3)
          ORDER BY favorites DESC, b.id DESC
          LIMIT 20;
          `,
          [query, forUser, cursorData?.id, cursorData?.favorites],
        );
        return {
          results: result.rows,
          next: generateCursor(result.rows),
        };
      case "my_favorites":
        result = await this.pg.query(
          `
          SELECT b.id, (users.id = $2) as owned, EXISTS (select id from favorite_boards where id = $2 and board = b.id) as favorited, COALESCE(users.username, '<unknown>') as author, b.title, b.created, b.edited, b.privacy, COUNT(distinct plays.id)::int as plays, COUNT(distinct fav.id)::int as favorites, b.restricted ${query ? ", word_similarity($1::TEXT, b.title) as sml" : ""}
          FROM boards as b
          INNER JOIN favorite_boards AS fav ON b.id = fav.board
          LEFT JOIN board_plays AS plays ON b.id = plays.board
          LEFT JOIN users ON b.author = users.id
          WHERE (${queryIsID ? "(b.id = $1 AND (b.privacy <> 'private' OR (users.id = $2)))" : "($1::TEXT IS NULL OR $1 = '' OR $1 <% title) AND (b.privacy = 'public' OR (users.id = $2))"}) AND fav.id = $2 AND b.deleted IS NULL AND (b.restricted IS NULL OR (SELECT admin FROM users WHERE id = $2))
          GROUP BY b.id, users.id
          HAVING (${query ? "$5::REAL IS NULL OR" : ""} $4::INT IS NULL OR $3::UUID IS NULL) OR (${query ? "word_similarity($1::TEXT, b.title)," : ""} COUNT(distinct plays.id)::int, b.id) < (${query ? "$5," : ""} $4, $3)
          ORDER BY ${query ? "word_similarity($1::TEXT, b.title) DESC," : ""} plays DESC, b.id DESC
          LIMIT 20;
          `,
          query
            ? [
                query,
                forUser,
                cursorData?.id,
                cursorData?.plays,
                cursorData?.similar,
              ]
            : [query, forUser, cursorData?.id, cursorData?.plays],
        );
        return {
          results: result.rows,
          next: generateCursor(result.rows),
        };
      case "my_boards":
        result = await this.pg.query(
          `
          SELECT b.id, (users.id = $2) as owned, EXISTS (select id from favorite_boards where id = $2 and board = b.id) as favorited, COALESCE(users.username, '<unknown>') as author, b.title, b.created, b.edited, b.privacy, COUNT(distinct plays.id)::int as plays, COUNT(distinct fav.id)::int as favorites, b.restricted ${query ? ", word_similarity($1::TEXT, b.title) as sml" : ""}
          FROM boards as b
          LEFT JOIN favorite_boards AS fav ON b.id = fav.board
          LEFT JOIN board_plays AS plays ON b.id = plays.board
          LEFT JOIN users ON b.author = users.id
          WHERE (${queryIsID ? "(b.id = $1 AND (b.privacy <> 'private' OR (users.id = $2)))" : "($1::TEXT IS NULL OR $1 = '' OR $1 <% title) AND (b.privacy = 'public' OR (users.id = $2))"}) AND b.author = $2 AND b.deleted IS NULL AND (b.restricted IS NULL OR (SELECT admin FROM users WHERE id = $2))
          GROUP BY b.id, users.id
          HAVING (${query ? "$5::REAL IS NULL OR" : ""} $4::INT IS NULL OR $3::UUID IS NULL) OR (${query ? "word_similarity($1::TEXT, b.title)," : ""} COUNT(distinct plays.id)::int, b.id) < (${query ? "$5," : ""} $4, $3)
          ORDER BY ${query ? "word_similarity($1::TEXT, b.title) DESC," : ""} plays DESC, b.id DESC
          LIMIT 20;
          `,
          query
            ? [
                query,
                forUser,
                cursorData?.id,
                cursorData?.plays,
                cursorData?.similar,
              ]
            : [query, forUser, cursorData?.id, cursorData?.plays],
        );
        return {
          results: result.rows,
          next: generateCursor(result.rows),
        };
      default:
        throw Error("Invalid sort method for search.");
    }
  }

  public async transaction<T>(
    inner: (client: PoolClient) => Awaitable<T>,
  ): Promise<T> {
    const client = await this.pg.connect();
    try {
      await client.query("BEGIN");
      const result = await inner(client);
      await client.query("COMMIT");

      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}

declare module "fastify" {
  interface FastifyInstance {
    db: Database;
  }
}

const databasePlugin = fastifyPlugin(async function (fastify, _) {
  const db = new Database(fastify.pg);
  await db.initDatabase();

  fastify.decorate("db", db);
});

export default databasePlugin;
