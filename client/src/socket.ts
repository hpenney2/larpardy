import { markRaw, reactive } from "vue";
import { io, Socket } from "socket.io-client";
import { discordSdk, auth as discordAuth, setupPromise } from "./discord";
import type { GameState } from "@larpardy/shared/state";
import type { ClientToServerEvents, ServerToClientEvents } from "@larpardy/shared/socketTypes";

await setupPromise; // wait until SDK is ready

export type LSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export const gameState = reactive<{
  connected: boolean;
  state: GameState | null;
  ping: number;
  timeOffset: number;
}>({
  connected: false,
  state: null,
  ping: 0,
  timeOffset: 0,
});

export const socket: LSocket = markRaw(
  io(undefined, {
    path: "/api/connect",
    auth: { instanceId: discordSdk.instanceId, token: discordAuth.access_token },
    // retries: 5, // retries causes emits to not fire for some reason...
    autoConnect: false,
  }),
);

function syncTime() {
  socket.emit("ping", Date.now(), (clientTime, serverTime) => {
    const now = Date.now();
    const roundTrip = now - clientTime;
    const serverTimeAtArrival = serverTime + roundTrip / 2;
    const timeOffset = serverTimeAtArrival - now;

    gameState.ping = roundTrip;
    gameState.timeOffset = timeOffset;
  });
}

socket.on("connect", () => {
  gameState.connected = socket.connected;
  console.log("[socket.io] connected to server");
  syncTime();
});

socket.on("disconnect", () => {
  gameState.connected = socket.connected;
  console.log("[socket.io] disconnected from server");
});

// should we move this to App and just show the WaitModal so it's not so permenant?
// but what if it IS a permenant error??
socket.on("connect_error", (err) => {
  console.log("connect error :(", err.message, err.cause);
});

socket.onAny((event, ...value) => {
  console.debug(`[socket.io] heard ${event}`, value);
});

socket.onAnyOutgoing((event, ...value) => {
  console.debug(`[socket.io] sending ${event}`, value);
});

socket.on("stateUpdate", (newState, callback) => {
  gameState.state = newState;
  console.log("[new state]", newState);
  callback();
});

setInterval(() => {
  if (socket.connected) {
    syncTime();
  }
}, 1000);
