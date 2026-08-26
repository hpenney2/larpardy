import { DiscordAPIError, REST } from "@discordjs/rest";
import type { FastifyRedis } from "@fastify/redis";
import {
  DEFAULT_SETTINGS,
  StateType,
  type BoardClue,
  type GameBoard,
  type GameState,
  type Scores,
  type Settings,
} from "@larpardy/shared/state";
import { Routes, type APIActivityInstance } from "discord-api-types/v10";
import fastifyPlugin from "fastify-plugin";
import type { ClueDatabase } from "./jep.js";

// we could theoretically add a redis: Redis = this.redis parameter to CRUD methods, but generic types become a problem lol
// type Redis = RedisCommander<ClientContext>;

const enum KeyTypes {
  GAME = "game",
  PLAYERS = "players",
  READYPLAYERS = "readyPlayers",
  BOARD = "board",
  SCORE = "score",
  SETTINGS = "settings",
}

/** r(edis) key */
function rkey(...args: string[]): string {
  return args.join(":");
}

/** g(ame) key
 * (shortcut for rkey({@link KeyTypes.GAME}, ...))
 */
function gkey(...args: string[]) {
  return rkey(KeyTypes.GAME, ...args);
}

export class StateManager {
  constructor(private redis: FastifyRedis) {}

  protected async scan(match: string) {
    let [cursor, keys] = await this.redis.scan(
      0,
      "MATCH",
      match,
      "COUNT",
      1000,
    );

    while (cursor !== "0") {
      const [newCursor, newKeys] = await this.redis.scan(
        cursor,
        "MATCH",
        match,
        "COUNT",
        1000,
      );
      cursor = newCursor;
      keys = keys.concat(newKeys);
    }

    return keys;
  }

  protected async jsonSet(
    key: string,
    path: string,
    obj: Object,
    nx: boolean = false,
    xx: boolean = false,
  ) {
    if (nx && xx) {
      throw new Error("cannot have both NX and XX on JSON.SET");
    }
    return this.redis.call(
      "JSON.SET",
      key,
      path,
      JSON.stringify(obj),
      ...(nx ? ["NX"] : []),
      ...(xx ? ["XX"] : []),
    );
  }

  protected async jsonGet(key: string, path: string = "$"): Promise<Object> {
    return JSON.parse((await this.redis.call("JSON.GET", key, path)) as string);
  }

  getPlayers(instance: string): Promise<string[]> {
    return this.redis.smembers(rkey(KeyTypes.GAME, instance, KeyTypes.PLAYERS));
  }

  getPlayersLen(instance: string): Promise<number> {
    return this.redis.scard(gkey(instance, KeyTypes.PLAYERS));
  }

  async joinPlayer(instance: string, userId: string) {
    return this.redis.sadd(
      rkey(KeyTypes.GAME, instance, KeyTypes.PLAYERS),
      userId,
    );
  }

  async leavePlayer(instance: string, userId: string) {
    return this.redis
      .multi()
      .srem(rkey(KeyTypes.GAME, instance, KeyTypes.PLAYERS), userId)
      .srem(rkey(KeyTypes.GAME, instance, KeyTypes.READYPLAYERS), userId)
      .exec();
  }

  /** Returns whether or not all players are ready.
   * @param [autoClear=true] Clears the list of readied players when the final player is ready.
   */
  async readyForNext(
    instance: string,
    userId: string,
    autoClear: boolean = true,
  ): Promise<boolean> {
    const key = rkey(KeyTypes.GAME, instance, KeyTypes.READYPLAYERS);
    const players = rkey(KeyTypes.GAME, instance, KeyTypes.PLAYERS);
    const _readiedDiff = (await this.redis
      .multi()
      .sadd(key, userId)
      .sdiff(key, players)
      .exec())![1]?.[1] as string[]; // no WATCH; cannot be null

    // const readied = new Set(_readied);
    // const players = new Set(await this.getPlayers(instance));

    // const result = readied.size === players.size && players.isSubsetOf(readied);
    const result = _readiedDiff.length === 0;
    if (result && autoClear) {
      await this.redis.unlink(key);
    }

    return result;
  }

  async getReadyForNext(instance: string) {
    return this.redis.smembers(
      rkey(KeyTypes.GAME, instance, KeyTypes.READYPLAYERS),
    );
  }

  async unreadyForNext(instance: string, userId: string) {
    return this.redis.srem(
      rkey(KeyTypes.GAME, instance, KeyTypes.READYPLAYERS),
      userId,
    );
  }

  async setHostPlayer(instance: string, userId: string) {
    return this.redis.hset(gkey(instance), "host", userId);
  }

  async getHostPlayer(instance: string) {
    return this.redis.hget(gkey(instance), "host") as Promise<string>; // trust me bro :3
  }

  async getStateType(instance: string): Promise<StateType> {
    return parseInt((await this.redis.hget(gkey(instance), "state"))!);
  }

  async setStateType(instance: string, state: StateType) {
    return this.redis.hset(gkey(instance), "state", state);
  }

  async incrScore(instance: string, userId: string, points: number) {
    return this.redis.hincrby(gkey(instance, KeyTypes.SCORE), userId, points);
  }

  async getScore(instance: string, userId: string) {
    return parseInt(
      (await this.redis.hget(gkey(instance, KeyTypes.SCORE), userId)) ?? "0",
    );
  }

  async getAllScores(instance: string) {
    const scores = await this.redis.hgetall(gkey(instance, KeyTypes.SCORE));
    const parsedScores: Scores = {};
    for (const [user, score] of Object.entries(scores)) {
      parsedScores[user] = parseInt(score);
    }

    return parsedScores;
  }

  async startGame(instance: string) {
    const host = await this.getHostPlayer(instance);
    const settings = await this.getSettings(instance);
    let players = await this.getPlayers(instance);

    if (!settings.isHostless) {
      players = players.filter((id) => id !== host);
    }

    let startingPlayer = players[Math.floor(Math.random() * players.length)];

    if (!startingPlayer) {
      throw new Error(
        `trying to start game, but no players the game? (${instance}`,
      );
    }

    return this.redis
      .multi()
      .hset(gkey(instance), "state", StateType.GameStartIntro)
      .hset(gkey(instance), "activePlayer", startingPlayer)
      .exec();
  }

  async getSettings(instance: string) {
    return (
      (await this.jsonGet(gkey(instance, KeyTypes.SETTINGS))) as Settings[]
    )[0]!;
  }

  async updateSettings(instance: string, settings: Settings) {
    return this.jsonSet(gkey(instance, KeyTypes.SETTINGS), "$", settings);
  }

  async setClueRevealed(
    instance: string,
    categoryIndex: number,
    clueIndex: number,
    revealed: boolean = true,
  ) {
    return this.jsonSet(
      gkey(instance, KeyTypes.BOARD),
      `$[${categoryIndex}].clues[${clueIndex}].revealed`,
      revealed,
    );
  }

  async setClueAnswered(
    instance: string,
    categoryIndex: number,
    clueIndex: number,
    answered: boolean = true,
  ) {
    return this.jsonSet(
      gkey(instance, KeyTypes.BOARD),
      `$[${categoryIndex}].clues[${clueIndex}].answered`,
      answered,
    );
  }

  async selectClue(instance: string, categoryIndex: number, clueValue: number) {
    await this.redis
      .multi()
      .hset(gkey(instance), "currentlyAnsweringCategory", categoryIndex)
      .hset(gkey(instance), "currentlyAnsweringClue", clueValue)
      // .hset(gkey(instance), "state", StateType.AnsweringClue)
      .exec();
    // await this.setClueRevealed(instance, categoryIndex, clueValue);
  }

  async getCanBuzzInAt(instance: string) {
    const value = await this.redis.hget(gkey(instance), "canBuzzInAt");
    return value != null ? parseInt(value) : null;
  }

  async setCanBuzzInAt(instance: string, timestamp: number) {
    return this.redis.hset(gkey(instance), "canBuzzInAt", timestamp);
  }

  async getBuzzedPlayer(instance: string) {
    return this.redis.hget(gkey(instance), "buzzedPlayer");
  }

  async setBuzzedPlayer(instance: string, userId: string) {
    return this.redis.hset(gkey(instance), "buzzedPlayer", userId);
  }

  async buzz(instance: string, userId: string) {
    return this.redis
      .multi()
      .hset(gkey(instance), "buzzedPlayer", userId)
      .hset(gkey(instance), "state", StateType.BuzzedIn)
      .hset(gkey(instance), "buzzedInAt", Date.now())
      .exec();
  }

  async setActivePlayer(instance: string, userId: string) {
    return this.redis.hset(gkey(instance), "activePlayer", userId);
  }

  async getActivePlayer(instance: string) {
    return this.redis.hget(gkey(instance), "activePlayer");
  }

  async nextPlayer(instance: string) {
    const [playersT, activeT] = (await this.redis
      .multi()
      .smembers(gkey(instance, KeyTypes.PLAYERS))
      .hget(gkey(instance), "activePlayer")
      .exec())!;

    if (playersT && activeT && playersT[0] == null && activeT[0] == null) {
      const players = playersT[1] as string[];
      const activePlayer = activeT[1] as string;
    }
  }

  async getState(instance: string): Promise<GameState> {
    const game: Partial<GameState> = await this.redis.hgetall(
      rkey(KeyTypes.GAME, instance),
    );

    if (Object.keys(game).length === 0) {
      throw new Error(`game "${instance}" does not exist`);
    }

    game.state = parseInt(game.state as unknown as string);

    // somes state is stored seperately
    const players = await this.getPlayers(instance);
    const readyPlayers = await this.getReadyForNext(instance);

    const settings = await this.getSettings(instance);

    const playerSet = new Set(players);
    const readyPlayerSet = new Set(readyPlayers);
    const isReadyForNext =
      readyPlayerSet.size === playerSet.size &&
      playerSet.isSubsetOf(readyPlayerSet) &&
      (settings.isHostless || readyPlayerSet.size > 1);

    const board = (
      (await this.jsonGet(gkey(instance, KeyTypes.BOARD))) as GameBoard[]
    )[0]!;
    // board.map((x) => {
    //   x.clues.sort((a, b) => a.value - b.value);
    // });

    const score = await this.getAllScores(instance);

    return {
      ...(game as GameState),
      players,
      readyForNextState: readyPlayers,
      isReadyForNext,
      board,
      score,
      settings,
    };
  }

  async initGame(instance: string, hostId: string, clueDb: ClueDatabase) {
    const key = rkey(KeyTypes.GAME, instance);
    const players = rkey(key, KeyTypes.PLAYERS);
    const boardKey = rkey(key, KeyTypes.BOARD);
    const settingsKey = rkey(key, KeyTypes.SETTINGS);

    const board: GameBoard = clueDb
      .getRandomCategoriesAndClues(6, 5)
      .map((category) => {
        const newClues: BoardClue[] = [];
        for (const [i, clue] of category.clues.entries()) {
          newClues.push({
            ...clue,
            value: (i + 1) * 200,
            revealed: false,
            answered: false,
          });
        }

        return { ...category, clues: newClues };
      });

    const success = await this.redis
      .multi()
      .watch(key, players, boardKey) // should players be in this list?
      .hsetex(key, "FNX", "FIELDS", 2, "host", hostId, "state", StateType.Lobby)
      .sadd(players, hostId)
      .call("JSON.SET", boardKey, "$", JSON.stringify(board))
      .call("JSON.SET", settingsKey, "$", JSON.stringify(DEFAULT_SETTINGS))
      .exec();

    // TODO: should this error out instead?
    if (success === null) {
      console.warn(
        `[!] Init of game failed, somewhere else might be trying to do it at the same time! (redis returned null; ${key}). Assuming that it must already exist.`,
      );
      const added = await this.redis.sadd(players, hostId);
      console.warn(`(added ${added} item(s) to players)`);
    }

    return this.getState(instance);
  }

  async initOrJoin(instance: string, userId: string, clueDb: ClueDatabase) {
    const game = rkey(KeyTypes.GAME, instance);
    if (await this.redis.exists(game)) {
      if ((await this.getStateType(instance)) <= StateType.Lobby)
        await this.joinPlayer(instance, userId);

      return await this.getState(instance);
    } else {
      return await this.initGame(instance, userId, clueDb);
    }
  }

  async dropInstance(instance: string) {
    const prefix = rkey(KeyTypes.GAME, instance) + "*";
    let keys = await this.scan(prefix);

    console.log("[state] unlinking", keys);

    return this.redis.unlink(keys);
  }

  async resetInstance(
    instance: string,
    clueDb: ClueDatabase,
    keepPlayers: boolean,
    newHost?: string,
  ) {
    if (!keepPlayers && !newHost) {
      throw Error(
        "if not keeping players during reset, a new host player must be given",
      );
    }

    const players = keepPlayers ? await this.getPlayers(instance) : null;
    const existingHost = await this.getHostPlayer(instance);
    await this.dropInstance(instance);
    await this.initGame(instance, newHost ?? existingHost, clueDb);

    if (keepPlayers) {
      for (const player of players!) {
        await this.joinPlayer(instance, player);
      }
    }
  }

  async dropStaleKeys() {
    const keys = await this.scan(KeyTypes.GAME + ":*");

    let rest = new REST({ version: "10" }).setToken(
      process.env.DISCORD_BOT_TOKEN,
    );
    rest.options.rejectOnRateLimit;

    const timeStart = performance.now();

    const stale: string[] = [];
    await Promise.all(
      keys.map(async (key) => {
        const instanceId = key.split(":")[1];
        if (instanceId == null) {
          console.warn(
            `[stalechk] couldn't get instance ID from key ${key}? it will be kept`,
          );
          return;
        }

        try {
          await rest.get(
            Routes.applicationActivityInstance(
              process.env.VITE_DISCORD_CLIENT_ID,
              instanceId,
            ),
          );
        } catch (err) {
          if (err instanceof DiscordAPIError && err.status === 404) {
            console.log(`[stalechk] ${err} (${instanceId})`);
            stale.push(key);
          } else {
            console.warn(
              `[stalechk] unknown error for instance ID ${instanceId}: ${err}`,
            );
          }
        }
      }),
    );

    const timeEnd = performance.now();

    console.log(
      `[stalechk] found ${stale.length} out of ${keys.length} keys to be stale (took ${Math.round(timeEnd - timeStart)}ms)`,
    );

    if (stale.length > 0) {
      await this.redis.unlink(stale);
    }
    console.log(`[stalechk] unlinked ${stale.length} keys`);
  }
}

declare module "fastify" {
  interface FastifyInstance {
    state: StateManager;
  }
}

const statePlugin = fastifyPlugin(async function (fastify, _) {
  fastify.decorate("state", new StateManager(fastify.redis));
});

export default statePlugin;
