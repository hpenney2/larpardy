import type { FastifyRedis } from "@fastify/redis";
import { StateType, type GameState } from "@larpardy/shared/state";
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

  async dropInstance(instance: string) {
    const prefix = rkey(KeyTypes.GAME, instance) + "*";
    let [cursor, keys] = await this.redis.scan(
      0,
      "MATCH",
      prefix,
      "COUNT",
      1000,
    );

    // this should NEVER happen with such a large count, but... can't be too sure?
    // proper implementation is probably a good idea lol
    while (cursor !== "0") {
      const [newCursor, newKeys] = await this.redis.scan(
        cursor,
        "MATCH",
        prefix,
        "COUNT",
        1000,
      );
      cursor = newCursor;
      keys = keys.concat(newKeys);
    }

    console.log("[state] unlinking", keys);

    return this.redis.unlink(keys);
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
