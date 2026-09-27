import type { BoardPrivacy, UserBoard } from "@larpardy/shared/userBoards";
import type { FastifyInstance } from "fastify";
import fastifyPlugin from "fastify-plugin";
import type { PoolClient } from "pg";

type Awaitable<T> = T | Promise<T>;

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
`;

class Database {
  constructor(private pg: FastifyInstance["pg"]) {}

  public async initDatabase() {
    await this.transaction(async (client) => {
      await client.query(CREATE_TABLES_QUERY);
      await client.query(
        `
        INSERT INTO users (id, admin)
        VALUES ($1, true)
        ON CONFLICT (id) DO NOTHING;
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
