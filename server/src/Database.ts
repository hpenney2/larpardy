import type { GameBoard } from "@larpardy/shared/state";
import type {
  BoardPrivacy,
  BoardSearchSort,
  SearchBoard,
  SearchBoardPartial,
  User,
  UserBoard,
} from "@larpardy/shared/userBoards";
import type { UpdateLog } from "@larpardy/shared/types";
import type { FastifyInstance } from "fastify";
import fastifyPlugin from "fastify-plugin";
import { type PoolClient } from "pg";
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
    const result = await this.pg.query(
      `
      INSERT INTO users (id, username)
      VALUES ($1, $2)
      ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username,
        last_login = NOW()
      RETURNING OLD.last_login as prev_login, EXISTS (SELECT 1 FROM updates_log WHERE OLD.last_login IS NULL OR updated_at <= NOW() AND updated_at > OLD.last_login) as new_updates;
      `,
      [user, username],
    );

    return result.rows[0] as { prev_login: Date | null; new_updates: boolean };
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

  public async recordPlay(board: string, user: string) {
    await this.pg.query(
      `
      INSERT INTO board_plays (board, by)
      SELECT $1, $2
      WHERE NOT EXISTS (
        SELECT 1 FROM board_plays WHERE time >= NOW() - INTERVAL '10 minutes'
      );
      `,
      [board, user],
    );
  }

  public async search(
    sort: BoardSearchSort,
    forUser: string,
    moderating: boolean,
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
          WHERE (${queryIsID ? "(b.id = $1::UUID AND (b.privacy <> 'private' OR (users.id = $2) OR $6))" : "$1 <% title AND (b.privacy = 'public' OR (users.id = $2) OR $6)"}) 
                AND b.deleted IS NULL 
                AND (b.restricted IS NULL OR $6)
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
            moderating,
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
          WHERE (${queryIsID ? "(b.id = $1::UUID AND (b.privacy <> 'private' OR (users.id = $2) OR $5))" : "($1::TEXT IS NULL OR $1 = '' OR $1 <% title) AND (b.privacy = 'public' OR (users.id = $2) OR $5)"}) 
                AND b.deleted IS NULL 
                AND (b.restricted IS NULL OR $5)
          GROUP BY b.id, users.id
          HAVING ($4::INT IS NULL OR $3::UUID IS NULL) OR (COUNT(distinct plays.id)::int, b.id) < ($4, $3)
          ORDER BY plays DESC, b.id DESC
          LIMIT 20;
          `,
          [query, forUser, cursorData?.id, cursorData?.plays, moderating],
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
          WHERE (${queryIsID ? "(b.id = $1::UUID AND (b.privacy <> 'private' OR (users.id = $2) OR $5))" : "($1::TEXT IS NULL OR $1 = '' OR $1 <% title) AND (b.privacy = 'public' OR (users.id = $2) OR $5)"})
                AND b.deleted IS NULL 
                AND (b.restricted IS NULL OR $5)
          GROUP BY b.id, users.id
          HAVING ($4::INT IS NULL OR $3::UUID IS NULL) OR (COUNT(distinct fav.id)::int, b.id) < ($4, $3)
          ORDER BY favorites DESC, b.id DESC
          LIMIT 20;
          `,
          [query, forUser, cursorData?.id, cursorData?.favorites, moderating],
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
          WHERE (${queryIsID ? "(b.id = $1::UUID AND (b.privacy <> 'private' OR (users.id = $2) OR $3))" : "($1::TEXT IS NULL OR $1 = '' OR $1 <% title) AND (b.privacy = 'public' OR (users.id = $2) OR $3)"}) 
                AND fav.id = $2 
                AND b.deleted IS NULL 
                AND (b.restricted IS NULL OR $3)
          GROUP BY b.id, users.id
          HAVING (${query ? "$6::REAL IS NULL OR" : ""} $5::INT IS NULL OR $4::UUID IS NULL) OR (${query ? "word_similarity($1::TEXT, b.title)," : ""} COUNT(distinct plays.id)::int, b.id) < (${query ? "$6," : ""} $5, $4)
          ORDER BY ${query ? "word_similarity($1::TEXT, b.title) DESC," : ""} plays DESC, b.id DESC
          LIMIT 20;
          `,
          query
            ? [
                query,
                forUser,
                moderating,

                cursorData?.id,
                cursorData?.plays,
                cursorData?.similar,
              ]
            : [query, forUser, moderating, cursorData?.id, cursorData?.plays],
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
          WHERE (${queryIsID ? "(b.id = $1::UUID AND (b.privacy <> 'private' OR (users.id = $2) OR $3))" : "($1::TEXT IS NULL OR $1 = '' OR $1 <% title) AND (b.privacy = 'public' OR (users.id = $2) OR $3)"}) 
                AND b.author = $2 
                AND b.deleted IS NULL 
                AND (b.restricted IS NULL OR $3)
          GROUP BY b.id, users.id
          HAVING (${query ? "$6::REAL IS NULL OR" : ""} $5::INT IS NULL OR $4::UUID IS NULL) OR (${query ? "word_similarity($1::TEXT, b.title)," : ""} COUNT(distinct plays.id)::int, b.id) < (${query ? "$6," : ""} $5, $4)
          ORDER BY ${query ? "word_similarity($1::TEXT, b.title) DESC," : ""} plays DESC, b.id DESC
          LIMIT 20;
          `,
          query
            ? [
                query,
                forUser,
                moderating,

                cursorData?.id,
                cursorData?.plays,
                cursorData?.similar,
              ]
            : [query, forUser, moderating, cursorData?.id, cursorData?.plays],
        );
        return {
          results: result.rows,
          next: generateCursor(result.rows),
        };
      default:
        throw Error("Invalid sort method for search.");
    }
  }

  public async getUser(user: string) {
    const result = await this.pg.query<User>(
      `SELECT * FROM users WHERE id = $1;`,
      [user],
    );

    return result.rows[0];
  }

  public async getBoardAuthor(board: string) {
    const result = await this.pg.query<User>(
      `
      SELECT users.* 
      FROM users
      JOIN boards ON boards.id = $1
      WHERE users.id = boards.author;`,
      [board],
    );

    return result.rows[0];
  }

  public async setUserRestricted(user: string, restrict: boolean) {
    const result = await this.pg.query(
      `
      UPDATE users
      SET
        restricted = $2
      WHERE id = $1;
      `,
      [user, restrict],
    );

    return { success: result.rowCount != null && result.rowCount > 0 };
  }

  public async setBoardRestricted(
    board: string,
    restrict: boolean,
  ): Promise<{ success: boolean; date: Date | null }> {
    if (restrict) {
      const result = await this.pg.query(
        `
        UPDATE boards
        SET
          restricted = NOW()
        WHERE id = $1
        RETURNING restricted;
        `,
        [board],
      );
      return {
        success: result.rowCount != null && result.rowCount > 0,
        date: result.rows[0]?.restricted,
      };
    } else {
      const result = await this.pg.query(
        `
        UPDATE boards
        SET
          restricted = NULL
        WHERE id = $1;
        `,
        [board],
      );
      return {
        success: result.rowCount != null && result.rowCount > 0,
        date: null,
      };
    }
  }

  public async deleteBoard(board: string, checkAuthor?: string) {
    const result = await this.pg.query(
      `
      UPDATE boards
      SET
        deleted = NOW()
      WHERE id = $1 AND deleted IS NULL AND ($2::TEXT IS NULL OR author = $2);
      `,
      [board, checkAuthor],
    );
    return result.rowCount != null && result.rowCount > 0;
  }

  public async createUpdateLog(title: string, body: string, time: Date) {
    await this.pg.query(
      `
      INSERT INTO updates_log (title, content, updated_at)
      VALUES ($1, $2, $3);
      `,
      [title, body, time],
    );
  }

  public async getUpdateLogs(all: boolean = false) {
    const result = await this.pg.query(
      `
      SELECT id, title, content, updated_at
      FROM updates_log
      WHERE $1 OR updated_at <= NOW()
      ORDER BY updated_at DESC
      LIMIT 50;
      `,
      [all],
    );

    return result.rows as UpdateLog[];
  }

  public async getUpdateLog(id: string) {
    const result = await this.pg.query(
      `
      SELECT id, title, content, updated_at
      FROM updates_log
      WHERE id = $1;
      `,
      [id],
    );

    return result.rows[0] as UpdateLog | undefined;
  }

  public async editUpdateLog(
    id: string,
    title: string,
    body: string,
    time: Date,
  ) {
    const result = await this.pg.query(
      `
      UPDATE updates_log
      SET
        title = $1,
        content = $2,
        updated_at = $3
      WHERE id = $4;
      `,
      [title, body, time, id],
    );
    return result.rowCount != null && result.rowCount > 0;
  }

  public async deleteUpdateLog(id: string) {
    const result = await this.pg.query(
      `
      DELETE FROM updates_log
      WHERE id = $1;
      `,
      [id],
    );
    return result.rowCount != null && result.rowCount > 0;
  }

  public async isAdmin(user: string) {
    const result = await this.pg.query<{ admin: boolean }>(
      `SELECT admin FROM users WHERE id = $1;`,
      [user],
    );

    return result.rows[0]?.admin;
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
