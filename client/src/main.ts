import "./main.css";

import { createApp } from "vue";
import App from "./App.vue";
import AuthFail from "./components/AuthFail.vue";
import { discordSdk, setupPromise } from "./discord.ts";
import { socket } from "./socket.ts";
import { Common } from "@discord/embedded-app-sdk";
import { addIcons, OhVueIcon } from "oh-vue-icons";
import { BiQuestionCircleFill } from "oh-vue-icons/icons";

function mountError(err: unknown) {
  createApp(AuthFail, { err }).mount("#app");
}

async function main() {
  try {
    await setupPromise;

    socket.connect();
  } catch (err) {
    console.error("error during auth!", JSON.stringify(err));
    mountError(err);
    return;
  }

  const app = createApp(App);

  addIcons(BiQuestionCircleFill);
  app.component("v-icon", OhVueIcon);

  app.mount("#app");
}

main();
