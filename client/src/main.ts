import "./main.css";

import { createApp } from "vue";
import App from "./App.vue";
import AuthFail from "./components/AuthFail.vue";
import { setupPromise } from "./discord.ts";

async function main() {
  try {
    await setupPromise;

    const app = createApp(App);
    app.mount("#app");
  } catch (err) {
    console.error("error during auth!", JSON.stringify(err));
    createApp(AuthFail, { err: err }).mount("#app");
  }
}

main();
