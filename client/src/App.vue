<script setup lang="ts">
import { onMounted, ref } from "vue";
import { discordSdk } from "@/discord";
import DiscordAvatar from "./components/DiscordAvatar.vue";
import type { Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@larpardy/shared/socketTypes";
import { PROJ_NAME } from "./shared.ts";

const { socket } = defineProps<{ socket: Socket<ServerToClientEvents, ClientToServerEvents> }>();

const users =
  ref<Awaited<ReturnType<typeof discordSdk.commands.getInstanceConnectedParticipants>>>();

onMounted(async () => {
  users.value = await discordSdk.commands.getInstanceConnectedParticipants();
});

discordSdk.subscribe("ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE", (newUsers) => {
  users.value = newUsers;
});
</script>

<template>
  <main>
    <h1>{{ PROJ_NAME }}</h1>
    <div v-for="user in users?.participants" :key="user.id">
      <p>{{ user.global_name }} ({{ user.username }})</p>
      <DiscordAvatar :user="user"></DiscordAvatar>
    </div>
  </main>
</template>

<style scoped>
main {
  text-align: center;
}
</style>
