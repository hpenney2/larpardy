import fastifyPlugin from "fastify-plugin";
import { DatabaseSync, type SQLTagStore } from "node:sqlite";

export interface Category {
  category_id: number;
  name: string;
}

export interface Clue {
  question: string;
  answer: string;
}

export class ClueDatabase {
  private sql: DatabaseSync;
  private sqlStore: SQLTagStore;

  constructor(public readonly path: string | Buffer | URL) {
    this.sql = new DatabaseSync(path, { readOnly: true });

    // this lets use cache and use parameters a lot easier, and still with no SQL injection!
    // see https://nodejs.org/api/sqlite.html#databasecreatetagstoremaxsize
    this.sqlStore = this.sql.createTagStore();
  }

  /** Returns a random list of {@link count} categories that have a minimum of {@link minClues} clues. */
  public getRandomCategories(count: number, minClues: number) {
    return this.sqlStore.all`
      SELECT category.*
      FROM category
      INNER JOIN clue ON clue.category_id = category.category_id 
      GROUP BY category.category_id
      HAVING COUNT(clue.category_id) >= ${minClues}
      ORDER BY RANDOM()
      LIMIT ${count};` as unknown as Category[];
  }

  /** Returns a random list of {@link countCategories} categories and {@link countClues} clues from each category. */
  public getRandomCategoriesAndClues(
    countCategories: number,
    countClues: number,
  ) {
    const categories = this.getRandomCategories(countCategories, countClues);
    const clues = categories.map((cat) => {
      return {
        name: cat.name,
        clues: this.sqlStore.all`
        SELECT clue.question, clue.answer 
        FROM category
        INNER JOIN clue ON clue.category_id = category.category_id 
        WHERE category.category_id = ${cat.category_id}
        ORDER BY RANDOM()
        LIMIT ${countClues};` as unknown as Clue[],
      };
    });

    return clues;
  }
}

declare module "fastify" {
  interface FastifyInstance {
    clueDb: ClueDatabase;
  }
}

const cluePlugin = fastifyPlugin<{ path: string | Buffer | URL }>(
  function (fastify, options) {
    let db: ClueDatabase;

    try {
      db = new ClueDatabase(options.path);
    } catch (err) {
      throw new Error(
        `Couldn't create clue database. Make sure that the path "${options.path}" actually exists."`,
        { cause: err },
      );
    }

    fastify.decorate("clueDb", db);
  },
);

export default cluePlugin;
