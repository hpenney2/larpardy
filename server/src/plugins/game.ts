import { BUZZ_DELAY, StateType, type GameState } from "@larpardy/shared/state";
import type { FastifyInstance } from "fastify";

// time to wait for state update ack in milliseconds
const STATE_UPDATE_TIMEOUT = 5000;
const STATE_UPDATE_RETRIES = 3;

const READY_NOCLEAR_STATES = new Set<StateType>([StateType.Lobby]);

function filterClues(state: GameState, hostMode: boolean) {
  return state.board.map((category) => {
    category.clues = category.clues.map((clue) => {
      if (!clue.revealed) {
        clue.question = null;
      }
      if (!clue.revealed || (!clue.answered && !hostMode)) {
        clue.answer = null;
      }
      return clue;
    });

    return category;
  });
}

export default async function routes(
  fastify: FastifyInstance,
  options: Object,
) {
  const io = fastify.socketIO;
  const timeouts: NodeJS.Timeout[] = [];

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
      // strip questions and answers. NO CHEATING >:(
      state.board = filterClues(state, state.host === id);

      // FIXME: this could be a problem if a client is unresponsive for multiple state updates! (they might get stale data as the last message!)
      // we should only repeat the latest state update
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

    function sendAlert(text: string) {
      socket.emit("showAlert", text);
    }

    function broadcastAlert(text: string) {
      io.to(instance).emit("showAlert", text);
    }

    socket.on("disconnect", (reason) => {
      console.log("user disconnected :(", id, reason);
    });

    socket.onAny((event, ...value) => {
      if (event === "ping") return;
      console.debug(`[socket ${id}] >> ${event}`, value);
    });

    // ping and sync time
    socket.on("ping", (clientTime, callback) => {
      callback(clientTime, Date.now());
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
        state = await fastify.state.initOrJoin(instance, id, fastify.clueDb);
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
          for (const timeout of timeouts) {
            clearTimeout(timeout);
          }
          fastify.state.dropInstance(instance);
        } else {
          // these are async but we don't need to wait for them
          // (and actually doing that would be a bad idea;
          // this callback NEEDS to be sync or we get seemingly
          // undefined behavior with clients.size?)
          fastify.state
            .leavePlayer(instance, id)
            .then(() => fastify.state.getPlayersLen(instance))
            .then((playerCount) => {
              if (playerCount <= 0 && clients && clients.size > 0) {
                broadcastAlert(
                  "All players have left. The game will now reset.",
                );

                const clientSocket = io.sockets.sockets.get(
                  [...clients].filter((x) => x !== socket.id)[0]!,
                );

                if (!clientSocket) return false;

                return fastify.state
                  .resetInstance(
                    instance,
                    fastify.clueDb,
                    false,
                    clientSocket.data.discord.id,
                  )
                  .then(() => true);
              } else {
                return false;
              }
            })
            .then((reset) => {
              if (reset && clients) {
                for (const client of clients) {
                  const clientSocket = io.sockets.sockets.get(client);
                  if (clientSocket) {
                    fastify.state.joinPlayer(
                      instance,
                      clientSocket.data.discord.id,
                    );
                  }
                }
              }
            })
            .then(() => sendCurrentState());

          // TODO: this SHOULD reevaluate readyForNext because everyone else might already be ready!
          // (for example, a player whose internet dropped)
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
        const allReady = await fastify.state.readyForNext(
          instance,
          id,
          !READY_NOCLEAR_STATES.has(current),
        );

        if (allReady) {
          switch (current) {
            case StateType.GameStartIntro:
              await fastify.state.setStateType(
                instance,
                StateType.GameStartShowCategories,
              );
              break;
            case StateType.GameStartShowCategories:
              await fastify.state.setStateType(instance, StateType.SelectClue);
              break;
          }
        }

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
      const state = await fastify.state.getState(instance);
      if (state.host === id && state.isReadyForNext) {
        await fastify.state.startGame(instance);
        await sendCurrentState();
      }
    });

    socket.on("selectClue", async (cat, clue) => {
      const state = await fastify.state.getState(instance);

      if (
        state.state === StateType.SelectClue &&
        state.activePlayer === id &&
        state.board[0] != null &&
        cat <= state.board.length &&
        clue <= state.board[0].clues.length &&
        !state.board[cat]?.clues[clue]?.revealed
      ) {
        await fastify.state.selectClue(instance, cat, clue);
        await sendCurrentState();

        // TODO: having server-side timeouts like this could reaaally cause issues on restart
        // because this isn't in Redis and will be LOST.
        // how can we make this work when the server restarts?
        // either store timeouts by some kind of repeatable type in Redis, or make sure they *finish* before a restart
        // maybe even wait for games to finish before finishing a restart?
        timeouts.push(
          setTimeout(async () => {
            await fastify.state.setClueRevealed(instance, cat, clue);
            await fastify.state.setStateType(instance, StateType.AnsweringClue);
            await fastify.state.setCanBuzzInAt(
              instance,
              Date.now() + BUZZ_DELAY,
            ); // can buzz in after BUZZ_DELAY
            await sendCurrentState();
          }, 1500),
        );
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
