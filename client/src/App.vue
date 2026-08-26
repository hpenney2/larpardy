<script setup lang="ts">
import { onMounted, ref, watchEffect } from "vue";
import { auth, discordSdk } from "@/discord";
import { type DiscordUsers } from "./shared.ts";
import { ActivityType } from "discord-api-types/v10";
import { StateType, StateFriendlyNames } from "@larpardy/shared/state";
import WaitModal from "./components/WaitModal.vue";
import LobbyScreen from "./components/LobbyScreen.vue";
import { socket, gameState } from "@/socket.ts";
import GameBoard from "./components/GameBoard.vue";
import AlertModal from "./components/AlertModal.vue";
import { Sounds } from "@larpardy/shared/sounds";

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

watchEffect(() => {
  if (gameState.state == null || users.value == null) return;

  discordSdk.commands.setActivity({
    activity: {
      type: ActivityType.Playing,
      party: { size: [users.value.participants.length, 10] },
      details: StateFriendlyNames[gameState.state.state],
      state: gameState.state.host === auth.user.id ? "Hosting" : "Playing",
    },
  });
});

// if we reconnect, let server know we are ready in case it doesn't know
socket.on("connect", () => {
  socket.emit("ready");
});

if (gameState.state == null) {
  socket.emit("ready");
}

// other socket listeners
const alertText = ref<string>();
socket.on("showAlert", (text) => {
  alertText.value = text;
  setTimeout(() => {
    alertText.value = undefined;
  }, 3000);
});

socket.on("playSound", (sound) => {
  const audio = new Audio(sound);

  switch (sound) {
    case Sounds.Correct:
      audio.volume = 0.25;
      break;
    case Sounds.Incorrect:
      audio.volume = 0.8;
      break;
  }

  audio.play();
});
</script>

<template>
  <template v-if="gameState.state != null">
    <Transition name="mainScreens">
      <main v-if="gameState.state.state == StateType.Lobby">
        <LobbyScreen :users="users" :users-talking="usersTalking"></LobbyScreen>
      </main>
      <main v-else>
        <GameBoard :users="users" :users-talking="usersTalking"></GameBoard>
      </main>
    </Transition>
  </template>

  <AlertModal v-if="alertText">{{ alertText }}</AlertModal>
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
  font-size: 0.5vw;
  opacity: 0.25;
  user-select: none;
}

#debug:hover {
  opacity: 0;
}
</style>
