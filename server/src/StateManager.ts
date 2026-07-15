import { DiscordAPIError, REST } from "@discordjs/rest";
import type { FastifyRedis } from "@fastify/redis";
import { StateType, type GameState } from "@larpardy/shared/state";
import { Routes, type APIActivityInstance } from "discord-api-types/v10";
import fastifyPlugin from "fastify-plugin";

// we could theoretically add a redis: Redis = this.redis parameter to CRUD methods, but generic types become a problem lol
// type Redis = RedisCommander<ClientContext>;

const enum KeyTypes {
  GAME = "game",
  PLAYERS = "players",
  READYPLAYERS = "readyPlayers",
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
    return this.redis.hset(gkey(instance), "state", StateType.GameStartIntro);
  }

  async getState(instance: string): Promise<GameState> {
    const game: Partial<GameState> = await this.redis.hgetall(
      rkey(KeyTypes.GAME, instance),
    );

    if (Object.keys(game).length === 0) {
      throw new Error(`game "${instance}" does not exist`);
    }

    game.state = parseInt(game.state as unknown as string);

    // players are stored seperately
    const players = await this.getPlayers(instance);
    const readyPlayers = await this.getReadyForNext(instance);

    const playerSet = new Set(players);
    const readyPlayerSet = new Set(readyPlayers);
    const isReadyForNext =
      readyPlayerSet.size === playerSet.size &&
      playerSet.isSubsetOf(readyPlayerSet);

    return {
      ...(game as GameState),
      players,
      readyForNextState: readyPlayers,
      isReadyForNext,
    };
  }

  async initGame(instance: string, hostId: string) {
    const key = rkey(KeyTypes.GAME, instance);
    const players = rkey(key, KeyTypes.PLAYERS);

    const success = await this.redis
      .multi()
      .watch(key, players) // should players be in this list?
      .hsetex(key, "FNX", "FIELDS", 2, "host", hostId, "state", StateType.Lobby)
      .sadd(players, hostId)
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
