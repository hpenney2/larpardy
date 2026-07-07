import "./main.css";

import { createApp } from "vue";
import App from "./App.vue";
import AuthFail from "./components/AuthFail.vue";
import { io } from "socket.io-client";
import { discordSdk, setupPromise, auth as discordAuth } from "./discord.ts";

function mountError(err: unknown) {
  createApp(AuthFail, { err }).mount("#app");
}

async function main() {
  let socket;
  try {
    await setupPromise;

    socket = io(undefined, {
      path: "/api/connect",
      auth: { instanceId: discordSdk.instanceId, token: discordAuth.access_token },
    });

    socket.on("connect_error", (err) => {
      console.log("connect error :(", err.message, err.cause);

      app.unmount();
      mountError(err);
    });

    socket.onAny((event, value) => {
      console.debug(`[socket.io] heard ${event}`, value);
    });
  } catch (err) {
    console.error("error during auth!", JSON.stringify(err));
    mountError(err);
    return;
  }

  const app = createApp(App, { socket });
  app.mount("#app");
}

main();
