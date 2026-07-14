<script setup lang="ts">
import { onMounted, ref } from "vue";
import { discordSdk } from "@/discord";
import { type DiscordUsers } from "./shared.ts";
import { ActivityType } from "discord-api-types/v10";
import { StateType } from "@larpardy/shared/state";
import WaitModal from "./components/WaitModal.vue";
import LobbyScreen from "./components/LobbyScreen.vue";
import { socket, gameState } from "@/socket.ts";
import GameBoard from "./components/GameBoard.vue";

const devMode = import.meta.env.DEV;

const users = ref<DiscordUsers>();
const usersTalking = ref(new Set<string>());

onMounted(async () => {
  users.value = await discordSdk.commands.getInstanceConnectedParticipants();
});

discordSdk.subscribe("ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE", (newUsers) => {
  users.value = newUsers;
});

discordSdk.subscribe(
  "SPEAKING_START",
  ({ user_id }) => {
    usersTalking.value.add(user_id);
  },
  { channel_id: discordSdk.channelId },
);

discordSdk.subscribe(
  "SPEAKING_STOP",
  ({ user_id }) => {
    usersTalking.value.delete(user_id);
  },
  { channel_id: discordSdk.channelId },
);

discordSdk.commands.setActivity({
  activity: {
    type: ActivityType.Playing,
    // party: { id: "test123!", size: [420, 421] },
    details: "Who's that?",
    state: "Hosting",
  },
});

// if we reconnect, let server know we are ready in case it doesn't know
socket.on("connect", () => {
  socket.emit("ready");
});

if (gameState.state == null) {
  socket.emit("ready");
}
</script>

<template>
  <template v-if="gameState.state != null && gameState.connected">
    <Transition name="mainScreens">
      <main v-if="gameState.state.state == StateType.Lobby">
        <LobbyScreen :users="users" :users-talking="usersTalking"></LobbyScreen>
      </main>
      <main v-else>
        <GameBoard></GameBoard>
      </main>
    </Transition>
  </template>

  <WaitModal v-if="gameState.state == null || !gameState.connected"></WaitModal>
  <p id="debug" v-if="devMode">debug: {{ gameState }}</p>
</template>

<style scoped>
main {
  position: absolute;
  width: 100%;
  height: 100%;
}

.mainScreens-enter-active,
.mainScreens-leave-active {
  transition: opacity 0.25s ease;
}

.mainScreens-enter-from,
.mainScreens-leave-to {
  opacity: 0;
}

#debug {
  position: fixed;
  top: 0;
  left: 0;
  max-width: 100vw;
  opacity: 0.5;
  user-select: none;
}

#debug:hover {
  opacity: 0;
}
</style>
