import type { FastifyInstance } from "fastify";

export default async function routes(
  fastify: FastifyInstance,
  options: Object,
) {
  fastify.socketIO.on("connection", (socket) => {
    console.log("user connected!", socket.id);
    socket.on("disconnect", () => {
      console.log("user disconnected :(", socket.id);
    });
  });
}
