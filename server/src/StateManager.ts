import type { FastifyRedis } from "@fastify/redis";
import { StateType, type GameState } from "@larpardy/shared/state";
import fastifyPlugin from "fastify-plugin";

// we could theoretically add a redis: Redis = this.redis parameter to CRUD methods, but generic types become a problem lol
// type Redis = RedisCommander<ClientContext>;

const enum KeyTypes {
  GAME = "game",
  PLAYERS = "players",
}

/** r(edis) key */
function rkey(...args: string[]): string {
  return args.join(":");
}

export class StageManager {
  constructor(private redis: FastifyRedis) {}

  getPlayers(instance: string): Promise<string[]> {
    return this.redis.smembers(rkey(KeyTypes.GAME, instance, KeyTypes.PLAYERS));
  }

  joinPlayer(instance: string, userId: string) {
    return this.redis.sadd(
      rkey(KeyTypes.GAME, instance, KeyTypes.PLAYERS),
      userId,
    );
  }

  leavePlayer(instance: string, userId: string) {
    return this.redis.srem(
      rkey(KeyTypes.GAME, instance, KeyTypes.PLAYERS),
      userId,
    );
  }

  async getState(instance: string): Promise<GameState> {
    const key = KeyTypes.GAME + instance;
    const game: Partial<GameState> = await this.redis.hgetall(
      rkey(KeyTypes.GAME, instance),
    );

    if (Object.keys(game).length === 0) {
      throw new Error(`game "${instance}" does not exist`);
    }

    // players are stored seperately
    const players = await this.getPlayers(instance);

    return { ...(game as GameState), players };
  }

  async initGame(instance: string, hostId: string) {
    const key = rkey(KeyTypes.GAME, instance);
    const players = rkey(key, KeyTypes.PLAYERS);

    const success = await this.redis
      .multi()
      .watch(key, players) // should players be in this list?
      .hsetnx(key, "host", hostId)
      .hsetnx(key, "state", StateType.Lobby)
      .sadd(players, hostId)
      .exec();

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

  private async dropInstance(instance: string) {
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
      const [newCursor, newKeys] = await this.redis.scan(cursor);
      cursor = newCursor;
      keys = keys.concat(newKeys);
    }

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
