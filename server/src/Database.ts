import type { FastifyInstance } from "fastify";
import fastifyPlugin from "fastify-plugin";
import type { PoolClient } from "pg";

type Awaitable<T> = T | Promise<T>;

const CREATE_TABLES_QUERY = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  admin BOOLEAN DEFAULT false NOT NULL,
  restricted BOOLEAN DEFAULT false NOT NULL
);
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

  public async addUser(user: string) {
    await this.pg.query(
      `
      INSERT INTO users (id)
      VALUES ($1)
      ON CONFLICT DO NOTHING;
      `,
      [user],
    );
  }

  public async transaction(inner: (client: PoolClient) => Awaitable<void>) {
    const client = await this.pg.connect();
    try {
      await client.query("BEGIN");
      await inner(client);
      await client.query("COMMIT");
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

  fastify.decorate("db");
});

export default databasePlugin;
