<script setup lang="ts">
import { onMounted, ref } from "vue";
import { discordSdk } from "@/discord";
import DiscordAvatar from "./components/DiscordAvatar.vue";
import type { Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@shared/socketTypes.ts";

const { socket } = defineProps<{ socket: Socket<ServerToClientEvents, ClientToServerEvents> }>();

const users =
  ref<Awaited<ReturnType<typeof discordSdk.commands.getActivityInstanceConnectedParticipants>>>();

onMounted(async () => {
  users.value = await discordSdk.commands.getActivityInstanceConnectedParticipants();
});

discordSdk.subscribe("ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE", (newUsers) => {
  users.value = newUsers;
});
</script>

<template>
  <h1>You did it!</h1>
  <p>
    Visit <a href="https://vuejs.org/" target="_blank" rel="noopener">vuejs.org</a> to read the
    documentation
  </p>
  <img
    src="https://1521015095738499083.discordsays.com/tenor/MvPZleT_pWcAAAAd/tenor.gif"
    width="50%"
    alt=""
  />
  <div v-for="user in users?.participants" :key="user.id">
    <p>{{ user.global_name }} ({{ user.username }})</p>
    <DiscordAvatar :user="user"></DiscordAvatar>
  </div>
</template>

<style scoped></style>
