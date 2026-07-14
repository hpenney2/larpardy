import { StateType, type GameState } from "@larpardy/shared/state";
import type { FastifyInstance } from "fastify";

// time to wait for state update ack in milliseconds
const STATE_UPDATE_TIMEOUT = 5000;
const STATE_UPDATE_RETRIES = 3;

const READY_NOCLEAR_STATES = new Set<StateType>([StateType.Lobby]);

export default async function routes(
  fastify: FastifyInstance,
  options: Object,
) {
  const io = fastify.socketIO;

  async function socketFromId(user: string) {
    return (await io.fetchSockets())
      .filter((sock) => sock.data.discord.id === user)
      .map((sock) => sock.id)
      .pop();
  }

  io.on("connection", async (socket) => {
    console.log("user connected!", socket.id, socket.data.discord);

    const id = socket.data.discord.id;
    const instance = socket.data.instanceId;

    /** send updated state to clients */
    function stateUpdated(
      state: GameState,
      retries: number = STATE_UPDATE_RETRIES,
    ) {
      io.timeout(STATE_UPDATE_TIMEOUT)
        .to(instance)
        .emit("stateUpdate", state, (err) => {
          if (err) {
            console.warn("ack error updating state (timeout):", err);
            if (retries > 1) {
              sendCurrentState(retries - 1); // in case the state we had is stale now
            } else {
              console.warn(
                `[!] all state update retries expended on instance ${instance}. unresponsive client?`,
              );
            }
          }
        });
    }

    async function sendCurrentState(retries: number = STATE_UPDATE_RETRIES) {
      stateUpdated(await fastify.state.getState(instance), retries);
    }

    socket.on("disconnect", (reason) => {
      console.log("user disconnected :(", id, reason);
    });

    socket.onAny((event, ...value) => {
      console.debug(`[socket ${id}] >> ${event}`, value);
    });

    let isReady = false;
    let isReadying = false;
    socket.on("ready", async () => {
      if (isReadying) return;
      if (isReady) {
        console.log(`${id} sent ready again? resending current state`);
        await sendCurrentState();
        return;
      }
      isReadying = true;

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

      socket.on("disconnecting", () => {
        console.log("disconnecting...", id);

        const clients = io.sockets.adapter.rooms.get(instance);

        // we're the last client!
        if (clients && clients.size === 1) {
          console.log(`cleaning up room for ${instance}`);
          fastify.state.dropInstance(instance);
        } else {
          // these are async but we don't need to wait for them
          // (and actually doing that would be a bad idea;
          // this callback NEEDS to be sync or we get seemingly
          // undefined behavior with clients.size?)
          fastify.state
            .leavePlayer(instance, id)
            .then(() => sendCurrentState());
        }
      });

      await socket.join(instance);
      console.log(socket.rooms);
      stateUpdated(state);

      isReady = true;
      isReadying = false;
    });

    socket.on("readyForNext", async (current) => {
      if (current === (await fastify.state.getStateType(instance))) {
        await fastify.state.readyForNext(
          instance,
          id,
          !READY_NOCLEAR_STATES.has(current),
        );
        await sendCurrentState();
      }
    });

    socket.on("unreadyForNext", async () => {
      if (
        READY_NOCLEAR_STATES.has(
          (await fastify.state.getStateType(instance)) as StateType,
        )
      ) {
        await fastify.state.unreadyForNext(instance, id);
        await sendCurrentState();
      }
    });

    socket.on("startGame", async () => {
      console.log("start req!");
      const state = await fastify.state.getState(instance);
      console.log(
        `start req by ${id}.`,
        state,
        state.host === id,
        state.isReadyForNext,
      );
      if (state.host === id && state.isReadyForNext) {
        await fastify.state.startGame(instance);
        await sendCurrentState();
      }
    });

    // kick out clients that don't fully connect in 1 minute
    setTimeout(() => {
      if (!isReady) {
        socket.disconnect();
      }
    }, 60000);

    // clients will send "ready" when they reconnect. this can cause a race condition instead
    // if (!socket.recovered) {
    //   await sendCurrentState();
    // }
  });
}
