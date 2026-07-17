import { DiscordAPIError, REST } from "@discordjs/rest";
import type { FastifyRedis } from "@fastify/redis";
import {
  StateType,
  type GameBoard,
  type GameState,
} from "@larpardy/shared/state";
import { Routes, type APIActivityInstance } from "discord-api-types/v10";
import fastifyPlugin from "fastify-plugin";

// we could theoretically add a redis: Redis = this.redis parameter to CRUD methods, but generic types become a problem lol
// type Redis = RedisCommander<ClientContext>;

const enum KeyTypes {
  GAME = "game",
  PLAYERS = "players",
  READYPLAYERS = "readyPlayers",
  BOARD = "board",
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

export class StageManager {
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

  async getHostPlayer(instance: string) {
    return this.redis.hget(gkey(instance), "host") as Promise<string>; // trust me bro :3
  }

  async getStateType(instance: string): Promise<StateType> {
    return parseInt((await this.redis.hget(gkey(instance), "state"))!);
  }

  async setStateType(instance: string, state: StateType) {
    return this.redis.hset(gkey(instance), "state", state);
  }

  async startGame(instance: string) {
    return this.redis
      .multi()
      .hset(gkey(instance), "state", StateType.GameStartIntro)
      .exec();
  }

  async setClueAnswered(
    instance: string,
    categoryIndex: number,
    clueValue: number,
    answered: boolean = true,
  ) {
    return this.jsonSet(
      gkey(instance, KeyTypes.BOARD),
      `$[${categoryIndex}].clues[?(@.value == ${clueValue})].answered`,
      answered,
    );
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

    const playerSet = new Set(players);
    const readyPlayerSet = new Set(readyPlayers);
    const isReadyForNext =
      readyPlayerSet.size === playerSet.size &&
      playerSet.isSubsetOf(readyPlayerSet);

    const board = (
      (await this.jsonGet(gkey(instance, KeyTypes.BOARD))) as GameBoard[]
    )[0]!;
    // board.map((x) => {
    //   x.clues.sort((a, b) => a.value - b.value);
    // });

    console.log(board);

    return {
      ...(game as GameState),
      players,
      readyForNextState: readyPlayers,
      isReadyForNext,
      board,
    };
  }

  async initGame(instance: string, hostId: string) {
    const key = rkey(KeyTypes.GAME, instance);
    const players = rkey(key, KeyTypes.PLAYERS);
    const boardKey = rkey(key, KeyTypes.BOARD);

    // TODO: STRICTLY for testing. This should be replaced by an actual random mechanism.
    const testClues = [
      {
        value: 200,
        question:
          "This is the world's most revered doctor in the TV show by the same name",
        answer: "Who is Dr. House?",
        answered: false,
      },
      {
        value: 400,
        question: "This is a test",
        answer: "What is a test question?",
        answered: false,
      },
      {
        value: 600,
        question: "That weird little green cyclops from the Pixar movie",
        answer: "Who is Mike Wazowski?",
        answered: false,
      },
      {
        value: 800,
        question: "AAAAAAAAA",
        answer: "What is screaming?",
        answered: false,
      },
      {
        value: 1000,
        question:
          "This is a REALLLLLYYYYYYYYYYYYY long Q&A. Like, REALLY long. If I had to say, I don't think I've EVER seen a longer question in my entire whole life. Wowwie!",
        answer: "Pleases stop",
        answered: false,
      },
    ];
    const board: GameBoard = [
      {
        name: "Dr. House",
        clues: testClues,
      },
      {
        name: "Joe!",
        clues: testClues.map((x) => {
          return {
            ...x,
            question: x.question + " joe",
            answer: x.answer + " joe",
          };
        }),
      },
      {
        name: "Please send help",
        clues: testClues.map((x) => {
          return {
            ...x,
            question: x.question + " HELP",
            answer: x.answer + " HELP",
          };
        }),
      },
      {
        name: "Boring Test Category Name 4",
        clues: testClues.map((x) => {
          return {
            ...x,
            question: x.question + " ASDASDAD",
            answer: x.answer + " ASDASDAD",
          };
        }),
      },
      {
        name: "Don't you know? Haven't you heard? Excuse me, SIR! Uhhh... yeah. Something like that. This is pretty long, isn't it?",
        clues: testClues.map((x) => {
          return {
            ...x,
            question: x.question + " INURWALLS1",
            answer: x.answer + " INURWALLS1",
          };
        }),
      },
    ];

    const success = await this.redis
      .multi()
      .watch(key, players, boardKey) // should players be in this list?
      .hsetex(key, "FNX", "FIELDS", 2, "host", hostId, "state", StateType.Lobby)
      .sadd(players, hostId)
      .call("JSON.SET", boardKey, "$", JSON.stringify(board))
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

  async initOrJoin(instance: string, userId: string) {
    const game = rkey(KeyTypes.GAME, instance);
    if (await this.redis.exists(game)) {
      await this.joinPlayer(instance, userId);
      return await this.getState(instance);
    } else {
      return await this.initGame(instance, userId);
    }
  }

  async dropInstance(instance: string) {
    const prefix = rkey(KeyTypes.GAME, instance) + "*";
    let keys = await this.scan(prefix);

    console.log("[state] unlinking", keys);

    return this.redis.unlink(keys);
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
    state: StageManager;
  }
}

const statePlugin = fastifyPlugin(async function (fastify, _) {
  fastify.decorate("state", new StageManager(fastify.redis));
});

export default statePlugin;
