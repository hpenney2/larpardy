import "./main.css";

import { createApp } from "vue";
import App from "./App.vue";
import AuthFail from "./components/AuthFail.vue";
import { io } from "socket.io-client";
import { setupPromise } from "./discord.ts";

async function main() {
  try {
    await setupPromise;

    const socket = io(undefined, { path: "/api/connect" });
    const app = createApp(App, { socket });
    app.mount("#app");
  } catch (err) {
    console.error("error during auth!", JSON.stringify(err));
    createApp(AuthFail, { err }).mount("#app");
  }
}

main();
