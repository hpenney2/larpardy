// CREDIT :: from https://github.com/ducktors/fastify-socket.io/issues/180#issuecomment-3426353709

import fastifyPlugin from "fastify-plugin";
import { Server, type ServerOptions } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../../shared/socketTypes.mts";

// Extend Fastify's TypeScript types
declare module "fastify" {
  interface FastifyInstance {
    socketIO: Server<ClientToServerEvents, ServerToClientEvents>;
  }
}

// Define plugin options
export type SocketIOOptions = Partial<ServerOptions> & {
  preClose?: (done: Function) => void;
};

// Define plugin
const fastifySocketIO = fastifyPlugin<SocketIOOptions>(
  async function (fastify, options) {
    // Create Socket.IO instance attached to Fastify's native HTTP server
    const socketIO = new Server(fastify.server, options);

    // Decorate Fastify instance so you can use fastify.socketIO
    fastify.decorate("socketIO", socketIO);

    // Handle server pre-close (disconnect clients before shutdown)
    fastify.addHook("preClose", (done) => {
      if (options.preClose) {
        return options.preClose(done);
      }
      fastify.socketIO.local.disconnectSockets(true);
      done();
    });

    // Handle full close (close Socket.IO server)
    fastify.addHook("onClose", (instance, done) => {
      instance.socketIO.close();
      done();
    });
  },
  { name: "socket-io" },
);

export default fastifySocketIO;
