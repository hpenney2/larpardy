<script setup lang="ts">
import { onMounted, ref } from "vue";
import { discordSdk } from "@/discord";
import DiscordAvatar from "./components/DiscordAvatar.vue";
import type { Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@larpardy/shared/socketTypes";
import { PROJ_NAME } from "./shared.ts";
import { ActivityType } from "discord-api-types/v10";
import type { GameState } from "@larpardy/shared/state";
import WaitModal from "./components/WaitModal.vue";

const { socket } = defineProps<{ socket: Socket<ServerToClientEvents, ClientToServerEvents> }>();

const users =
  ref<Awaited<ReturnType<typeof discordSdk.commands.getInstanceConnectedParticipants>>>();

const usersTalking = ref(new Set<string>());

const gameState = ref<GameState>();
socket.on("stateUpdate", (newState, callback) => {
  gameState.value = newState;
  console.log("[new state]", newState);
  callback();
});

const socketConnected = ref(false);

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
socketConnected.value = socket.connected;
  socket.emit("ready");
});
socket.on("disconnect", () => {
  socketConnected.value = socket.connected;
});

if (gameState.value === undefined) {
  socket.emit("ready");
}
</script>

<template>
  <WaitModal v-if="gameState === undefined || !socketConnected"></WaitModal>

  <main v-if="gameState !== undefined">
    <h1>{{ PROJ_NAME }}</h1>
    <div v-for="user in users?.participants" :key="user.id">
      <p>{{ user.global_name }} ({{ user.username }})</p>
      <DiscordAvatar
        :user="user"
        :speaking="usersTalking.has(user.id)"
        :size="64"
        class="avatar"
        :class="{ loading: !gameState?.players.includes(user.id) }"
      ></DiscordAvatar>
    </div>
  </main>
</template>

<style scoped>
main {
  text-align: center;
}

main * {
  margin-left: auto;
  margin-right: auto;
}

.avatar.loading::after {
  content: "...";
  display: block;
  align-content: center;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  text-align: center;
  backdrop-filter: brightness(50%);

  animation: wait 2s linear infinite;
}
</style>
