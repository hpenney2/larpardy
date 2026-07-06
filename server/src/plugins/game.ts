import type { GameState } from "@larpardy/shared/state";
import type { FastifyInstance } from "fastify";

export default async function routes(
  fastify: FastifyInstance,
  options: Object,
) {
  const io = fastify.socketIO;

  io.on("connection", async (socket) => {
    console.log("user connected!", socket.id, socket.data.discord);

    const id = socket.data.discord.id;
    const instance = socket.data.instanceId;

    /** send updated state to clients */
    function stateUpdated(state: GameState) {
      io.to(instance).emit("stateUpdate", state);
    }

    socket.on("disconnect", () => {
      console.log("user disconnected :(", id);
    });

    let isReady = false;
    socket.on("ready", async () => {
      if (isReady) return;
      isReady = true;

      console.log("readying client", id);

      let state: GameState;
      try {
        state = await fastify.state.initOrJoin(instance, id);
      } catch (error) {
        console.error(
          `[!!!] Error occured while trying to allow client (${id}) to join instance ${instance}.`,
          error,
        );
        socket.disconnect();
        return;
      }

      socket.on("disconnecting", async () => {
        await fastify.state.leavePlayer(instance, id);
        stateUpdated(await fastify.state.getState(instance));
      });

      await socket.join(instance);
      console.log(socket.rooms);
      stateUpdated(state);
    });

    // kick out clients that don't fully connect in 1 minute
    setTimeout(() => {
      if (!isReady) {
        socket.disconnect();
      }
    }, 60000);
  });
}
