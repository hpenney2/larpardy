import { InfluxDBClient, Point } from "@influxdata/influxdb3-client";
import type { FastifyInstance } from "fastify";
import fastifyPlugin from "fastify-plugin";

export class StatsDatabase {
  private client?: InfluxDBClient;

  constructor(
    private fastify: FastifyInstance,
    enabled: boolean,
    influxHost?: string,
    influxDatabase?: string,
    influxToken?: string,
  ) {
    if (enabled && influxHost && influxDatabase && influxToken) {
      this.client = new InfluxDBClient({
        host: influxHost,
        database: influxDatabase,
        token: influxToken,
      });
    } else {
      console.warn("Statistics tracking has been disabled.");
    }
  }

  public write(data: Point) {
    return this.client
      ?.write(data)
      .catch((err) =>
        console.warn("[!] An error occurred while writing statistics.", err),
      );
  }

  public update() {
    // TODO: this only works with one server instance! if we move to, say, using the Redis adapter (seems fitting, right?), we'll need to change this a little bit

    return this.client
      ?.write(
        Point.measurement("games")
          .setUintegerField(
            "instances",
            this.fastify.socketIO.sockets.adapter.rooms.size -
              this.fastify.socketIO.sockets.adapter.sids.size,
          )
          .setUintegerField(
            "connected",
            this.fastify.socketIO.sockets.adapter.sids.size,
          ),
      )
      .catch((err) =>
        console.warn("[!] An error occurred while writing statistics.", err),
      );
  }

  public close() {
    return this.client?.close();
  }
}

declare module "fastify" {
  interface FastifyInstance {
    stats: StatsDatabase;
  }
}

const statsPlugin = fastifyPlugin<{
  enabled: boolean;
  influxHost?: string;
  influxDatabase?: string;
  influxToken?: string;
}>(function (fastify, options) {
  let db: StatsDatabase;

  db = new StatsDatabase(
    fastify,
    options.enabled,
    options.influxHost,
    options.influxDatabase,
    options.influxToken,
  );

  fastify.decorate("stats", db);

  if (options.enabled) {
    // update every 60 seconds, just in case!
    const autoUpdate = setInterval(() => db.update(), 60000);

    fastify.addHook("preClose", (done) => {
      clearInterval(autoUpdate);
      done();
    });

    fastify.addHook("onClose", async (instance) => {
      await instance.stats.close();
    });
  }
});

export default statsPlugin;
